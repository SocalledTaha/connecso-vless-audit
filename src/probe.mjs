import dns from 'node:dns/promises';
import { createServer, connect } from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { buildXrayBatchConfig, buildXrayConfig, isPublicAddress, toPanelOutbound } from './vless.mjs';

const execFileAsync = promisify(execFile);
const XRAY = process.env.XRAY_BIN || '/usr/local/x-ui/bin/xray-linux-amd64';
const SERVICE_TARGETS = [
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/' },
  { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/generate_204' },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/robots.txt' },
  { id: 'telegram', name: 'Telegram', url: 'https://telegram.org/' },
];
const RTT_TARGET = 'https://www.youtube.com/generate_204';

export async function publicAddresses(host) {
  const literal = host.replace(/^\[|\]$/g, '');
  if (/^[\d.]+$/.test(literal) || literal.includes(':')) {
    return isPublicAddress(literal) ? [literal] : [];
  }
  const values = await dns.lookup(literal, { all: true, verbatim: false });
  const addresses = [...new Set(values.map((item) => item.address))];
  return addresses.length && addresses.every(isPublicAddress) ? addresses : [];
}

async function directEndpointPing(address) {
  if (!address || !isPublicAddress(address)) return null;
  try {
    const { stdout } = await execFileAsync('ping', ['-n', '-c', '1', '-W', '1', address], { timeout: 1800, maxBuffer: 16_384 });
    const match = String(stdout).match(/time\s*([=<])\s*([\d.]+)\s*ms/i);
    if (!match) return null;
    const value = Number(match[2]);
    if (!Number.isFinite(value)) return null;
    return match[1] === '<' ? Math.min(value, 0.5) : value;
  } catch {
    return null;
  }
}

export async function geoMap(addresses) {
  const countries = {};
  const unique = [...new Set(addresses)];
  for (let offset = 0; offset < unique.length; offset += 100) {
    try {
      const response = await fetch('http://ip-api.com/batch?fields=status,query,country,countryCode', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'VlessAudit/2.0' },
        body: JSON.stringify(unique.slice(offset, offset + 100)),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const values = await response.json();
      for (const item of values) {
        if (item.status === 'success') countries[item.query] = { country: item.country || '', countryCode: item.countryCode || '' };
      }
    } catch {}
  }
  return countries;
}

async function checkService(target, port) {
  try {
    const result = await execFileAsync('curl', [
      '-sS', '-o', '/dev/null', '--connect-timeout', '4', '--max-time', '7',
      '-x', 'socks5h://127.0.0.1:' + port,
      '-w', '%{http_code}\t%{time_total}', target.url,
    ], { timeout: 8000, maxBuffer: 1024 * 1024 });
    const [rawStatus, rawSeconds] = String(result.stdout).trim().split('\t');
    const status = Number(rawStatus) || 0;
    const seconds = Number(rawSeconds);
    return {
      id: target.id,
      name: target.name,
      ok: status >= 200 && status < 400,
      status,
      ms: Number.isFinite(seconds) ? Math.round(seconds * 1000) : null,
    };
  } catch {
    return { id: target.id, name: target.name, ok: false, status: 0, ms: null };
  }
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

function waitForSocks(child, port, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      child.off('exit', onExit);
      error ? reject(error) : resolve();
    };
    const onExit = () => finish(new Error('Xray outbound راه نیفتاد.'));
    child.once('exit', onExit);
    const timer = setInterval(() => {
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
  const serviceIds = Array.isArray(options.serviceIds) ? new Set(options.serviceIds) : options.checkServices === false ? new Set() : new Set(SERVICE_TARGETS.map((item) => item.id));
  try {
    const started = performance.now();
    const result = await execFileAsync('curl', [
      '-sS', '-o', '/dev/null', '--connect-timeout', '5', '--max-time', '9',
      '-x', 'socks5h://127.0.0.1:' + port,
      '-w', '%{http_code}\t%{time_connect}\t%{time_appconnect}\t%{time_starttransfer}',
      RTT_TARGET,
    ], { timeout: 10500, maxBuffer: 1024 * 1024 });
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
      const ipResult = await execFileAsync('curl', [
        '-fsS', '--connect-timeout', '5', '--max-time', '9',
        '-x', 'socks5h://127.0.0.1:' + port, 'https://api.ipify.org',
      ], { timeout: 10500, maxBuffer: 1024 * 1024 });
      base.exit = String(ipResult.stdout).trim();
    }
    base.ok = base.httpStatus >= 200 && base.httpStatus < 400 && (!checkExit || Boolean(base.exit));
    if (!base.ok) base.error = 'پاسخ HTTPS از مسیر این کانفیگ دریافت نشد.';
    else if (serviceIds.size) base.services = await Promise.all(SERVICE_TARGETS.filter((target) => serviceIds.has(target.id)).map((target) => checkService(target, port)));
  } catch (error) {
    base.error = error.message || 'اتصال HTTPS از مسیر کانفیگ ناموفق بود.';
  }
  return base;
}

async function stopXray(child, directory) {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 900)),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  await rm(directory, { recursive: true, force: true });
}

export async function testOne(config, countries, options = {}) {
  const base = resultBase(config, countries);
  let addresses;
  try {
    addresses = await publicAddresses(config.host);
  } catch {
    base.error = 'DNS مقصد پاسخ نداد.';
    return base;
  }
  if (!addresses.length) {
    base.error = 'IP عمومی برای مقصد پیدا نشد.';
    return base;
  }
  base.ip = addresses.slice().sort()[0];
  base.endpointPingMs = await directEndpointPing(base.ip);
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
    await waitForSocks(child, port);
    return await testThroughSocks(config, base, port, options);
  } catch (error) {
    base.error = error.message || 'Xray outbound راه نیفتاد.';
    return base;
  } finally {
    await stopXray(child, directory);
  }
}

export async function testBatch(configs, countries, options = {}) {
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
      base.endpointPingMs = await directEndpointPing(base.ip);
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
  try {
    const configPath = path.join(directory, 'config.json');
    await writeFile(configPath, JSON.stringify(buildXrayBatchConfig(entries.map((item) => item.config), ports)));
    child = spawn(XRAY, ['run', '-c', configPath], { stdio: 'ignore' });
    child.setMaxListeners(Math.max(10, ports.length + 2));
    await Promise.all(ports.map((port) => waitForSocks(child, port)));
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
    for (const item of entries) {
      if (!results[item.index]) {
        item.base.error = error.message || 'اجرای دستهٔ Xray ناموفق بود.';
        results[item.index] = item.base;
      }
    }
  } finally {
    await stopXray(child, directory);
  }
  return results;
}

export async function testDownload(config) {
  const connections = 4;
  const port = await reservePort();
  const directory = await mkdtemp(path.join(tmpdir(), 'vless-audit-speed-'));
  let child;
  const downloads = [];
  try {
    const configPath = path.join(directory, 'config.json');
    await writeFile(configPath, JSON.stringify(buildXrayConfig(config, port)));
    child = spawn(XRAY, ['run', '-c', configPath], { stdio: 'ignore' });
    await waitForSocks(child, port);
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
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(durationTimer);
        clearTimeout(guardTimer);
        if (error) reject(error); else resolve();
      };
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
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        new Promise((resolve) => setTimeout(resolve, 900)),
      ]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    await rm(directory, { recursive: true, force: true });
  }
}
