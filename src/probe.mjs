import dns from 'node:dns/promises';
import { createServer, connect } from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { mkdir, rename as renameFile, stat as statFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import maxmind from 'maxmind';
import { buildXrayBatchConfig, buildXrayConfig, isPublicAddress, toPanelOutbound } from './vless.mjs';
import { SERVICES, SERVICE_BY_ID } from './services.mjs';

const execFileAsync = promisify(execFile);
const XRAY = process.env.XRAY_BIN || '/usr/local/x-ui/bin/xray-linux-amd64';
const RTT_TARGET = 'https://www.youtube.com/generate_204';
const GEO_DB_PATH = process.env.GEOIP_DB_FILE || path.join(path.dirname(process.env.RESULTS_DIR || '/opt/vless-audit/results'), 'geo', 'dbip-country-lite.mmdb');
const GEO_DB_MAX_AGE = 35 * 24 * 60 * 60 * 1000;
let geoReader = null;
let geoReaderPromise = null;

export async function recommendedXrayWorkers() {
  const MiB = 1024 * 1024;
  let available = os.freemem();
  try {
    const memoryInfo = await readFile('/proc/meminfo', 'utf8');
    const match = memoryInfo.match(/^MemAvailable:\s+(\d+)\s+kB$/m);
    if (match) available = Number(match[1]) * 1024;
  } catch {}
  // Respect container limits when the panel runs inside a cgroup.
  try {
    const [limitText, currentText] = await Promise.all([
      readFile('/sys/fs/cgroup/memory.max', 'utf8'),
      readFile('/sys/fs/cgroup/memory.current', 'utf8'),
    ]);
    const limit = Number(limitText.trim());
    const current = Number(currentText.trim());
    if (Number.isFinite(limit) && limit > 0 && Number.isFinite(current)) available = Math.min(available, Math.max(0, limit - current));
  } catch {
    try {
      const [limitText, usageText] = await Promise.all([
        readFile('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf8'),
        readFile('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf8'),
      ]);
      const limit = Number(limitText.trim());
      const usage = Number(usageText.trim());
      if (Number.isFinite(limit) && limit < 2 ** 60 && Number.isFinite(usage)) available = Math.min(available, Math.max(0, limit - usage));
    } catch {}
  }
  // Xray's worker process is shared by up to ten route checks. Keep a real
  // system reserve, but don't budget hundreds of MiB for each lightweight worker.
  // Keep headroom for one dedicated interactive Xray while a background scan
  // runs on the automatically selected worker pool.
  const reserved = 640 * MiB;
  const budgetPerWorker = 80 * MiB;
  return Math.max(1, Math.min(3, Math.floor(Math.max(0, available - reserved) / budgetPerWorker) || 1));
}

export async function publicAddresses(host) {
  const literal = host.replace(/^\[|\]$/g, '');
  if (/^[\d.]+$/.test(literal) || literal.includes(':')) {
    return isPublicAddress(literal) ? [literal] : [];
  }
  const values = await dns.lookup(literal, { all: true, verbatim: false });
  const addresses = [...new Set(values.map((item) => item.address))];
  return addresses.length && addresses.every(isPublicAddress) ? addresses : [];
}

async function measureEndpointConnection(address, port, protocol) {
  // These transports use UDP. A TCP connect would measure the wrong path.
  if (!address || !isPublicAddress(address) || ['hysteria2', 'wireguard', 'masque'].includes(protocol)) return null;
  return new Promise((resolve) => {
    const started = performance.now();
    const socket = connect({ host: address, port: Number(port) });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1400);
    socket.once('connect', () => finish(Math.round((performance.now() - started) * 10) / 10));
    socket.once('timeout', () => finish(null));
    socket.once('error', () => finish(null));
  });
}

export async function geoMap(addresses) {
  const countries = {};
  const unique = [...new Set(addresses)];
  const reader = await getGeoReader();
  if (reader) {
    for (const address of unique) {
      try {
        const record = reader.get(address);
        const countryCode = record?.country?.iso_code || '';
        const country = record?.country?.names?.en || '';
        if (countryCode && country) countries[address] = { country, countryCode };
      } catch {}
    }
  }
  const missing = unique.filter((address) => !countries[address]);
  for (let offset = 0; offset < missing.length; offset += 100) {
    try {
      const response = await fetch('http://ip-api.com/batch?fields=status,query,country,countryCode', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'VlessAudit/2.0' },
        body: JSON.stringify(missing.slice(offset, offset + 100)),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const values = await response.json();
      for (const item of values) {
        if (item.status === 'success' && item.query && item.countryCode) countries[item.query] = { country: item.country || '', countryCode: item.countryCode || '' };
      }
    } catch (error) {
      console.warn(`GeoIP fallback failed for batch ${Math.floor(offset / 100) + 1}: ${error.message}`);
    }
  }
  const unresolved = unique.length - Object.keys(countries).length;
  if (unresolved) console.warn(`GeoIP could not identify ${unresolved}/${unique.length} destination IPs.`);
  return countries;
}

async function getGeoReader() {
  if (geoReader) {
    try {
      const info = await statFile(GEO_DB_PATH);
      if (Date.now() - info.mtimeMs <= GEO_DB_MAX_AGE) return geoReader;
      refreshGeoDatabase().catch((error) => console.warn(`GeoIP database refresh failed: ${error.message}`));
    } catch {}
    return geoReader;
  }
  if (!geoReaderPromise) {
    geoReaderPromise = (async () => {
      try {
        geoReader = await maxmind.open(GEO_DB_PATH);
        const info = await statFile(GEO_DB_PATH);
        if (Date.now() - info.mtimeMs > GEO_DB_MAX_AGE) {
          try { await refreshGeoDatabase(); }
          catch (error) { console.warn(`GeoIP database refresh failed; using the cached copy: ${error.message}`); }
        }
        return geoReader;
      } catch {
        try { return await refreshGeoDatabase(); }
        catch (error) {
          console.warn(`Local GeoIP database unavailable: ${error.message}`);
          return null;
        }
      }
    })().finally(() => { geoReaderPromise = null; });
  }
  return geoReaderPromise;
}

async function refreshGeoDatabase() {
  await mkdir(path.dirname(GEO_DB_PATH), { recursive: true });
  const now = new Date();
  for (let age = 0; age < 3; age += 1) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - age, 1));
    const release = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`;
    const url = `https://download.db-ip.com/free/dbip-country-lite-${release}.mmdb.gz`;
    const temporary = `${GEO_DB_PATH}.download-${process.pid}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { 'user-agent': 'ConnecsoOutboundAudit/1.0' } });
      if (!response.ok || !response.body) throw new Error(`download returned HTTP ${response.status}`);
      await pipeline(Readable.fromWeb(response.body), createGunzip(), createWriteStream(temporary, { mode: 0o640 }));
      const reader = await maxmind.open(temporary);
      if (!reader.get('8.8.8.8')?.country?.iso_code) throw new Error('downloaded database did not pass validation');
      await renameFile(temporary, GEO_DB_PATH);
      geoReader = reader;
      return reader;
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => {});
      if (age === 2) throw error;
    }
  }
  return geoReader;
}

export function interpretServiceHttpStatus(status) {
  const code = Number(status);
  const hasResponse = Number.isInteger(code) && code >= 100 && code <= 599;
  return {
    ok: hasResponse && code >= 200 && code < 400,
    reachable: hasResponse,
    state: !hasResponse ? 'route-error' : code >= 200 && code < 400 ? 'ok' : 'http-error',
  };
}

async function checkService(target, port, signal) {
  try {
    const result = await execFileAsync('curl', [
      '-sS', '-L', '--max-redirs', '10', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', '-o', '/dev/null', '--connect-timeout', '5', '--max-time', '12',
      '-x', 'socks5h://127.0.0.1:' + port,
      '-w', '%{http_code}\t%{time_total}', target.url,
    ], { timeout: 13000, maxBuffer: 1024 * 1024, ...(signal ? { signal } : {}) });
    const [rawStatus, rawSeconds] = String(result.stdout).trim().split('\t');
    const status = Number(rawStatus) || 0;
    const seconds = Number(rawSeconds);
    // HTTP responses prove that the route reached the service's web edge.
    // 5xx responses are still reachability; they may be an origin/service issue.
    return {
      id: target.id,
      name: target.name,
      group: target.group,
      ...interpretServiceHttpStatus(status),
      status,
      ms: Number.isFinite(seconds) ? Math.round(seconds * 1000) : null,
      error: '',
    };
  } catch (error) {
    if (signal?.aborted) throw signal.reason || error;
    const detail = String(error?.stderr || error?.message || 'request failed').trim();
    const category = /timed out|timeout/i.test(detail) ? 'timeout'
      : /Could not resolve|resolve host|name or service not known/i.test(detail) ? 'dns'
        : /SSL|TLS|certificate/i.test(detail) ? 'tls'
          : /Connection refused/i.test(detail) ? 'refused' : 'network';
    return { id: target.id, name: target.name, group: target.group, ok: false, reachable: false, state: 'route-error', status: 0, ms: null, error: category };
  }
}

export async function checkServiceAtPort(port, serviceId, signal) {
  const target = SERVICE_BY_ID.get(serviceId);
  if (!target) throw new Error('سرویس انتخاب‌شده در فهرست وجود ندارد.');
  return checkService(target, port, signal);
}

export async function checkServicesAtPort(port, serviceIds = SERVICES.map(({ id }) => id), signal, onProgress = () => {}) {
  const ids = [...new Set(serviceIds)].filter((id) => SERVICE_BY_ID.has(id));
  const targets = ids.map((id) => SERVICE_BY_ID.get(id));
  const results = new Array(targets.length);
  let cursor = 0;
  let completed = 0;
  const workers = Math.min(8, targets.length);
  await Promise.all(Array.from({ length: workers }, async () => {
    while (cursor < targets.length) {
      if (signal?.aborted) throw signal.reason || new Error('بررسی لغو شد.');
      const index = cursor++;
      results[index] = await checkService(targets[index], port, signal);
      completed += 1;
      onProgress(completed, targets.length, results[index]);
    }
  }));
  return results;
}

async function reservePort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

function waitForSocks(child, port, timeoutMs = 3500, signal) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let settled = false;
    let timer;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      child.off('exit', onExit);
      signal?.removeEventListener('abort', onAbort);
      error ? reject(error) : resolve();
    };
    const onExit = () => finish(new Error('Xray outbound راه نیفتاد.'));
    const onAbort = () => finish(signal.reason || new Error('بررسی لغو شد.'));
    if (signal?.aborted) return onAbort();
    child.once('exit', onExit);
    signal?.addEventListener('abort', onAbort, { once: true });
    timer = setInterval(() => {
      if (Date.now() - started > timeoutMs) return finish(new Error('مهلت راه‌اندازی Xray تمام شد.'));
      const socket = connect({ host: '127.0.0.1', port });
      socket.setTimeout(200);
      socket.once('connect', () => { socket.destroy(); finish(); });
      socket.once('error', () => socket.destroy());
    }, 100);
  });
}

function resultBase(config, countries) {
  let outbound = null;
  try { outbound = toPanelOutbound(config); } catch {}
  return {
    name: config.name,
    endpoint: config.host + ':' + config.port,
    protocol: config.protocol,
    transport: config.transport,
    security: String(config.security || 'none').toUpperCase(),
    plugin: config.params?.plugin || '',
    outbound,
    ip: '',
    country: '',
    ok: false,
    uri: config.uri,
  };
}

async function testThroughSocks(config, base, port, options = {}) {
  const checkExit = options.checkExit !== false;
  const serviceIds = Array.isArray(options.serviceIds) ? new Set(options.serviceIds) : new Set();
  try {
    const started = performance.now();
    const result = await execFileAsync('curl', [
      '-sS', '-o', '/dev/null', '--connect-timeout', '5', '--max-time', '9',
      '-x', 'socks5h://127.0.0.1:' + port,
      '-w', '%{http_code}\t%{time_connect}\t%{time_appconnect}\t%{time_starttransfer}',
      RTT_TARGET,
    ], { timeout: 10500, maxBuffer: 1024 * 1024, ...(options.signal ? { signal: options.signal } : {}) });
    const [statusRaw, proxyRaw, tlsRaw, firstByteRaw] = String(result.stdout).trim().split('\t').map(Number);
    const proxyConnectMs = Number.isFinite(proxyRaw) ? Math.round(proxyRaw * 1000) : null;
    const tlsConnectMs = Number.isFinite(tlsRaw) ? Math.round(tlsRaw * 1000) : null;
    const firstByteMs = Number.isFinite(firstByteRaw) ? Math.round(firstByteRaw * 1000) : null;
    base.httpStatus = Number.isFinite(statusRaw) ? statusRaw : 0;
    base.timings = {
      proxyConnectMs,
      tlsViaOutboundMs: proxyConnectMs !== null && tlsConnectMs !== null ? Math.max(0, tlsConnectMs - proxyConnectMs) : null,
      firstByteMs,
    };
    // Curl's time_starttransfer is the end-to-end HTTPS response time through Xray.
    // Keep the display honest: this is an HTTP RTT/TTFB measurement, not ICMP ping.
    base.ms = firstByteMs ?? Math.round(performance.now() - started);
    if (checkExit) {
      try {
        const ipResult = await execFileAsync('curl', [
          '-fsS', '--connect-timeout', '5', '--max-time', '9',
          '-x', 'socks5h://127.0.0.1:' + port, 'https://api.ipify.org',
        ], { timeout: 10500, maxBuffer: 1024 * 1024, ...(options.signal ? { signal: options.signal } : {}) });
        base.exit = String(ipResult.stdout).trim();
      } catch (error) {
        if (options.signal?.aborted) throw options.signal.reason || error;
        // Exit-IP lookup is supplementary; a successful HTTPS RTT still proves
        // that the route works even if the IP echo service is unavailable.
        base.exit = '';
      }
    }
    base.ok = base.httpStatus >= 200 && base.httpStatus < 400;
    if (!base.ok) base.error = 'پاسخ HTTPS از مسیر این کانفیگ دریافت نشد.';
    else if (serviceIds.size) base.services = await checkServicesAtPort(port, [...serviceIds], options.signal);
  } catch (error) {
    if (options.signal?.aborted) throw options.signal.reason || error;
    base.error = error.message || 'اتصال HTTPS از مسیر کانفیگ ناموفق بود.';
  }
  return base;
}

async function stopXray(child, directory) {
  if (child?.pid && child.exitCode === null && child.signalCode === null) {
    const waitForClose = (timeoutMs = 0) => new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve(true);
      let timer;
      const done = (closed) => {
        if (timer) clearTimeout(timer);
        child.off('close', onClose);
        resolve(closed);
      };
      const onClose = () => done(true);
      child.once('close', onClose);
      if (timeoutMs) timer = setTimeout(() => done(false), timeoutMs);
    });
    child.kill('SIGTERM');
    if (!await waitForClose(1200) && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await waitForClose();
    }
  }
  await rm(directory, { recursive: true, force: true });
}

export async function openProbeSession(config, countries = {}, options = {}) {
  const base = resultBase(config, countries);
  let addresses;
  try {
    addresses = await publicAddresses(config.host);
  } catch {
    throw new Error('DNS مقصد پاسخ نداد.');
  }
  if (!addresses.length) {
    throw new Error('IP عمومی برای مقصد پیدا نشد.');
  }
  base.ip = addresses.slice().sort()[0];
  base.endpointConnectMs = await measureEndpointConnection(base.ip, config.port, config.protocol);
  const location = countries[base.ip];
  base.country = typeof location === 'string' ? location : location?.country || '';
  base.countryCode = typeof location === 'object' ? location?.countryCode || '' : '';
  const port = await reservePort();
  const directory = await mkdtemp(path.join(tmpdir(), 'vless-audit-'));
  let child;
  try {
    const configPath = path.join(directory, 'config.json');
    await writeFile(configPath, JSON.stringify(buildXrayConfig(config, port)));
    child = spawn(XRAY, ['run', '-c', configPath], { stdio: 'ignore' });
    await waitForSocks(child, port, 3500, options.signal);
    return {
      base,
      port,
      route: (routeOptions = {}) => testThroughSocks(config, base, port, routeOptions),
      checkService: (serviceId, signal = options.signal) => checkServiceAtPort(port, serviceId, signal),
      checkServices: (serviceIds = SERVICES.map(({ id }) => id), signal = options.signal, onProgress) => checkServicesAtPort(port, serviceIds, signal, onProgress),
      close: () => stopXray(child, directory),
    };
  } catch (error) {
    await stopXray(child, directory);
    throw error;
  }
}

export async function testOne(config, countries, options = {}) {
  let session;
  try {
    session = await openProbeSession(config, countries, options);
    return await session.route(options);
  } catch (error) {
    const base = resultBase(config, countries);
    base.error = error.message || 'Xray outbound راه نیفتاد.';
    return base;
  } finally {
    await session?.close();
  }
}

export async function testBatch(configs, countries, options = {}) {
  if (options.signal?.aborted) throw options.signal.reason || new Error('بررسی لغو شد.');
  const results = new Array(configs.length);
  const entries = [];
  await Promise.all(configs.map(async (config, index) => {
    const base = resultBase(config, countries);
    try {
      const addresses = await publicAddresses(config.host);
      if (!addresses.length) {
        base.error = 'IP عمومی برای مقصد پیدا نشد.';
        results[index] = base;
        return;
      }
      base.ip = addresses.slice().sort()[0];
      base.endpointConnectMs = await measureEndpointConnection(base.ip, config.port, config.protocol);
      const location = countries[base.ip];
      base.country = typeof location === 'string' ? location : location?.country || '';
      base.countryCode = typeof location === 'object' ? location?.countryCode || '' : '';
      // Validate transport/security independently so one malformed config does not fail the batch.
      buildXrayConfig(config, 1);
      entries.push({ config, base, index });
    } catch (error) {
      base.error = error.message || 'DNS یا تنظیمات کانفیگ معتبر نیست.';
      results[index] = base;
    }
  }));
  if (!entries.length) return results;

  const ports = await Promise.all(entries.map(() => reservePort()));
  const directory = await mkdtemp(path.join(tmpdir(), 'vless-audit-batch-'));
  let child;
  const abortChild = () => {
    if (child?.pid && child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  };
  options.signal?.addEventListener('abort', abortChild, { once: true });
  try {
    if (options.signal?.aborted) throw options.signal.reason || new Error('بررسی لغو شد.');
    const configPath = path.join(directory, 'config.json');
    await writeFile(configPath, JSON.stringify(buildXrayBatchConfig(entries.map((item) => item.config), ports)));
    child = spawn(XRAY, ['run', '-c', configPath], { stdio: 'ignore' });
    child.setMaxListeners(Math.max(10, ports.length + 2));
    if (options.signal?.aborted) abortChild();
    await Promise.all(ports.map((port) => waitForSocks(child, port, 3500, options.signal)));
    const checked = new Array(entries.length);
    const concurrency = Math.min(entries.length, Math.max(1, Number(options.concurrency) || entries.length));
    let cursor = 0;
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (cursor < entries.length) {
        const index = cursor++;
        checked[index] = await testThroughSocks(entries[index].config, entries[index].base, ports[index], options);
      }
    }));
    checked.forEach((result, index) => { results[entries[index].index] = result; });
  } catch (error) {
    if (options.signal?.aborted) throw options.signal.reason || error;
    if (options.throwBatchErrors) throw error;
    for (const item of entries) {
      if (!results[item.index]) {
        item.base.error = error.message || 'اجرای دستهٔ Xray ناموفق بود.';
        results[item.index] = item.base;
      }
    }
  } finally {
    options.signal?.removeEventListener('abort', abortChild);
    await stopXray(child, directory);
  }
  return results;
}

export async function testDownload(config, options = {}) {
  const { signal } = options;
  if (signal?.aborted) throw signal.reason || new Error('آزمون دانلود متوقف شد.');
  const connections = 4;
  const port = await reservePort();
  const directory = await mkdtemp(path.join(tmpdir(), 'vless-audit-speed-'));
  let child;
  const downloads = [];
  try {
    const configPath = path.join(directory, 'config.json');
    await writeFile(configPath, JSON.stringify(buildXrayConfig(config, port)));
    child = spawn(XRAY, ['run', '-c', configPath], { stdio: 'ignore' });
    await waitForSocks(child, port, 3500, signal);
    let bytes = 0;
    const statuses = [];
    const errors = [];
    let firstByteAt = 0;
    let measuredSeconds = 0;
    let measurementEnded = false;
    let durationTimer;
    await new Promise((resolve, reject) => {
      let settled = false;
      let remaining = connections;
      const guardTimer = setTimeout(() => {
        for (const download of downloads) if (download.exitCode === null) download.kill('SIGTERM');
        finish(new Error(errors.join(' · ') || 'دانلود آزمایشی پس از مهلت اتصال متوقف شد.'));
      }, 24_000);
      const onAbort = () => {
        for (const download of downloads) if (download.exitCode === null && download.signalCode === null) download.kill('SIGTERM');
        finish(signal.reason || new Error('آزمون دانلود متوقف شد.'));
      };
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(durationTimer);
        clearTimeout(guardTimer);
        signal?.removeEventListener('abort', onAbort);
        if (error) reject(error); else resolve();
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) return onAbort();
      for (let index = 0; index < connections; index += 1) {
        const headersPath = path.join(directory, `response-headers-${index}.txt`);
        const args = [
          '-sS', '-L', '--connect-timeout', '12', '--max-time', '22',
          '-D', headersPath,
          '-x', 'socks5h://127.0.0.1:' + port,
          'https://proof.ovh.net/files/1Gb.dat',
        ];
        const download = spawn('curl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
        downloads.push(download);
        download.stdout.on('data', (chunk) => {
          if (measurementEnded) return;
          if (!firstByteAt) {
            firstByteAt = performance.now();
            durationTimer = setTimeout(() => {
              measuredSeconds = 5;
              measurementEnded = true;
              for (const active of downloads) if (active.exitCode === null) active.kill('SIGTERM');
            }, 5_000);
          }
          bytes += chunk.length;
        });
        download.stderr.on('data', (chunk) => { if (chunk.length) errors.push(chunk.toString().trim()); });
        download.once('error', (error) => { errors.push(error.message); });
        download.once('close', async () => {
          let headerText = '';
          try { headerText = await readFile(headersPath, 'utf8'); } catch {}
          const headerStatuses = [...headerText.matchAll(/^HTTP\/\S+\s+(\d{3})/gm)];
          if (headerStatuses.length) statuses.push(Number(headerStatuses.at(-1)[1]));
          remaining -= 1;
          if (remaining === 0) {
            if (firstByteAt && !measuredSeconds) measuredSeconds = Math.max(0, (performance.now() - firstByteAt) / 1000);
            finish();
          }
        });
      }
    });
    const status = statuses.includes(200) ? 200 : (statuses.find((value) => value !== 0) || 0);
    const errorText = errors.join(' · ');
    const seconds = measuredSeconds;
    // When the five-second cutoff sends SIGTERM, curl may exit before flushing its
    // final status metadata. A substantial streamed body confirms the payload.
    if (!status && bytes > 1_048_576) statuses.push(200);
    const finalStatus = status || (statuses.includes(200) ? 200 : 0);
    return {
      ok: finalStatus === 200 && bytes > 0 && seconds > 0,
      status: Number.isFinite(finalStatus) ? finalStatus : 0,
      bytes,
      seconds: Math.round(seconds * 100) / 100,
      megabytesPerSecond: seconds > 0 ? Math.round((bytes / 1024 / 1024 / seconds) * 100) / 100 : 0,
      connections,
      error: finalStatus && finalStatus !== 200
        ? `سرور تست پاسخ HTTP ${finalStatus} داد.`
        : bytes === 0
          ? errorText || 'در مهلت اتصال داده‌ای از مسیر این کانفیگ دریافت نشد.'
          : '',
    };
  } finally {
    for (const download of downloads) if (download.exitCode === null) download.kill('SIGTERM');
    await Promise.all(downloads.map((download) => download.exitCode !== null || download.signalCode !== null
      ? Promise.resolve()
      : new Promise((resolve) => {
        const timer = setTimeout(() => { if (download.exitCode === null && download.signalCode === null) download.kill('SIGKILL'); }, 900);
        download.once('close', () => { clearTimeout(timer); resolve(); });
      })));
    await stopXray(child, directory);
  }
}
