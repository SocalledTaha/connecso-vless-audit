import https from 'node:https';
import { readFile, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import { fileURLToPath } from 'node:url';
import { parseSubscription } from './src/vless.mjs';
import { geoMap, publicAddresses, recommendedXrayWorkerPlan, testBatch, testOne, testDownload, openProbeSession } from './src/probe.mjs';
import { loadJobs, saveJob } from './src/store.mjs';
import { SERVICES, SERVICE_GROUPS } from './src/services.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const RESULTS = process.env.RESULTS_DIR || '/opt/vless-audit/results';
const UPDATE_REQUEST = path.join(RESULTS, 'update-request.json');
const UPDATE_STATUS = path.join(RESULTS, 'update-status.json');
const CERT = process.env.CERT_FILE || '/etc/vless-audit/server.crt';
const KEY = process.env.KEY_FILE || '/etc/vless-audit/server.key';
const PORT = Number(process.env.PORT || 3006);
const HOST = process.env.HOST || '0.0.0.0';
const PASSWORD = process.env.PANEL_PASSWORD || '';
const MAX_BODY = 12_000_000;
const CHUNK_SIZE = 100;
const AUTO_BATCH_SIZE = 10;
const MAX_ROUTES_PER_XRAY = 10;
const MAX_CONFIGS_PER_AUDIT = 2500;
const SUPPORTED_PROTOCOL_IDS = new Set(['vless','vmess','trojan','shadowsocks','hysteria2','wireguard','masque']);
function filterProtocols(configs, ids) {
  if (!Array.isArray(ids)) return configs;
  const selected = new Set(ids.filter((id) => SUPPORTED_PROTOCOL_IDS.has(String(id).toLowerCase())).map((id) => String(id).toLowerCase()));
  return configs.filter((config) => selected.has(config.protocol));
}
const jobs = await loadJobs(RESULTS);
const MAX_RECOVERY_RETRIES = 5;
let activeJob = null;
let activeOperation = null;
let activeInteractiveId = null;
const interactiveTasks = new Map();
const sessions = new Map();

if (!PASSWORD) throw new Error('PANEL_PASSWORD تنظیم نشده است.');

function authorized(request) {
  const cookie = request.headers.cookie || '';
  const sessionId = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('vless_audit_session='))?.slice('vless_audit_session='.length);
  if (sessionId) {
    const expires = sessions.get(sessionId);
    if (expires && expires > Date.now()) return true;
    if (expires) sessions.delete(sessionId);
  }
  return false;
}

function redirect(response, location, extraHeaders = {}) {
  response.writeHead(303, { Location: location, 'Cache-Control': 'no-store', ...extraHeaders });
  response.end();
}

function headers(response, type) {
  response.setHeader('Content-Type', type);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  headers(response, 'application/json; charset=utf-8');
  response.writeHead(status, { 'Content-Length': Buffer.byteLength(body) });
  response.end(body);
}

function fail(response, status, message, code = '') {
  sendJson(response, status, { error: message, ...(code ? { code } : {}) });
}

async function readBody(request) {
  const contentLength = Number(request.headers['content-length'] || 0);
  if (contentLength > MAX_BODY) throw Object.assign(new Error('اندازهٔ ورودی بیش از حد مجاز است.'), { status: 413 });
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('اندازهٔ ورودی بیش از حد مجاز است.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function assertPublicUrl(target) {
  if (target.protocol !== 'https:') throw new Error('برای دریافت ساب فقط لینک HTTPS پذیرفته می‌شود.');
  const host = target.hostname.replace(/^\[|\]$/g, '');
  let addresses;
  try {
    addresses = await publicAddresses(host);
  } catch {
    throw new Error('دامنهٔ لینک ساب قابل resolve نیست.');
  }
  if (!addresses.length) throw new Error('دامنهٔ لینک ساب باید به IP عمومی برسد.');
  return addresses;
}

async function fetchSubscription(rawUrl) {
  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new Error('لینک ساب معتبر نیست.');
  }
  for (let redirect = 0; redirect <= 4; redirect += 1) {
    await assertPublicUrl(target);
    let response;
    try {
      response = await fetch(target, {
        redirect: 'manual',
        headers: { 'user-agent': 'VlessAudit/2.0' },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error('دریافت لینک ساب ناموفق بود.');
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || redirect === 4) throw new Error('تعداد انتقال‌های لینک ساب بیش از حد مجاز است.');
      target = new URL(location, target);
      continue;
    }
    if (!response.ok) throw new Error('سرور ساب پاسخ HTTP ' + response.status + ' داد.');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BODY) {
        await reader.cancel();
        throw Object.assign(new Error('حجم متن ساب بیش از حد مجاز است.'), { status: 413 });
      }
      chunks.push(Buffer.from(value));
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (!looksLikeSubscriptionList(text)) throw new Error('لینک باز شد، اما محتوای آن فهرست کانفیگ قابل‌شناسایی نیست.');
    return text;
  }
  throw new Error('دریافت لینک ساب ناموفق بود.');
}

function looksLikeSubscriptionList(text) {
  const raw = String(text || '').trim();
  if (!raw || /^<(?:!doctype|html|head|body)\b/i.test(raw)) return false;
  let decoded = raw;
  if (!/(?:vless|vmess|trojan|ss|ssr|hysteria2?|tuic|wireguard):\/\//i.test(decoded) && !/^\s*(?:proxies|outbounds)\s*:/im.test(decoded)) {
    try {
      const normalized = raw.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
      const candidate = Buffer.from(normalized + '='.repeat((4 - normalized.length % 4) % 4), 'base64').toString('utf8');
      if (candidate && candidate !== '\u0000') decoded = candidate;
    } catch {}
  }
  return /(?:vless|vmess|trojan|ss|ssr|hysteria2?|tuic|wireguard):\/\//i.test(decoded)
    || /^\s*(?:proxies|outbounds)\s*:/im.test(decoded);
}

function summary(job) {
  return {
    id: job.id,
    created: job.created,
    title: job.title || '',
    tags: Array.isArray(job.tags) ? job.tags : [],
    favorite: Boolean(job.favorite),
    total: job.total,
    available: job.available,
    batchSize: AUTO_BATCH_SIZE,
    workerCount: Number(job.workerCount) || 0,
    done: job.done,
    success: job.success,
    failed: Math.max(0, job.done - job.success),
    finished: Boolean(job.finished),
    interrupted: Boolean(job.interrupted),
    error: job.error || '',
    canRescan: true,
    canResume: Boolean(job.finished && job.interrupted && job.done < job.total
      && ((Array.isArray(job.scanConfigs) && job.scanConfigs.length) || job.subscriptionUrl)),
    hasSubscriptionUrl: Boolean(job.subscriptionUrl),
    subscriptionUrl: job.subscriptionUrl || '',
    needsRescanUrl: Boolean(!job.subscriptionUrl && !job.results.some((item) => item.uri)),
    message: job.message || '',
  };
}

async function beginJob(configs, offset, subscriptionUrl = '', message = '', scanOptions = {}) {
  const selected = configs.slice(offset, offset + MAX_CONFIGS_PER_AUDIT);
  const id = crypto.randomBytes(9).toString('base64url');
  const job = {
    id,
    created: new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC'),
    total: selected.length,
    available: configs.length,
    offset,
    batchSize: AUTO_BATCH_SIZE,
    workerCount: 0,
    // The bulk pass is intentionally lightweight: route RTT and direct
    // endpoint-connect time only. Service checks run on explicit interaction.
    checkExit: false,
    serviceIds: [],
    protocolIds: Array.isArray(scanOptions.protocolIds) ? scanOptions.protocolIds.filter((id) => SUPPORTED_PROTOCOL_IDS.has(id)) : [...SUPPORTED_PROTOCOL_IDS],
    done: 0,
    success: 0,
    finished: selected.length === 0,
    interrupted: false,
    resumeEligible: selected.length > 0,
    recoveryRetries: 0,
    checkedIndexes: [],
    results: [],
    scanConfigs: selected,
    ...(message ? { message } : {}),
    ...(subscriptionUrl ? { subscriptionUrl } : {}),
  };
  jobs.set(id, job);
  await saveJob(RESULTS, job);
  if (selected.length) {
    launchAudit(job, selected);
  }
  return summary(job);
}

function launchAudit(job, configs) {
  let finish;
  const operation = {
    kind: 'audit', jobId: job.id, controller: new AbortController(), replaceRequested: false,
    done: new Promise((resolve) => { finish = resolve; }),
  };
  operation.finish = finish;
  activeJob = job.id;
  activeOperation = operation;
  runJob(job, configs, operation).catch((error) => {
    console.error('audit worker failed unexpectedly:', job.id, error.message);
  }).finally(() => {
    if (activeOperation === operation) {
      activeOperation = null;
      activeJob = null;
    }
    operation.finish();
  });
}

async function repairSavedCountries() {
  for (const job of jobs.values()) {
    if (!job.finished) continue;
    const missing = job.results.filter((item) => item.ip && (!item.country || !item.countryCode));
    if (!missing.length) continue;
    const countries = await geoMap(missing.map((item) => item.ip));
    let changed = false;
    for (const item of missing) {
      const location = countries[item.ip];
      if (!location) continue;
      item.country = typeof location === 'string' ? location : location.country || item.country || '';
      item.countryCode = typeof location === 'object' ? location.countryCode || item.countryCode || '' : item.countryCode || '';
      changed = true;
    }
    if (changed) await saveJob(RESULTS, job);
  }
}

async function resumeJob(job) {
  let configs = Array.isArray(job.scanConfigs) && job.scanConfigs.length ? job.scanConfigs : null;
  if (!configs && job.subscriptionUrl) {
    const text = await fetchSubscription(job.subscriptionUrl);
    configs = filterProtocols(parseSubscription(text), job.protocolIds || [...SUPPORTED_PROTOCOL_IDS])
      .slice(job.offset || 0, (job.offset || 0) + MAX_CONFIGS_PER_AUDIT);
  }
  if (!configs?.length) throw new Error('دادهٔ لازم برای ادامهٔ این بررسی در سابقه پیدا نشد.');
  job.scanConfigs = configs;
  job.total = configs.length;
  job.done = Math.min(Number(job.done) || 0, configs.length);
  job.checkedIndexes = Array.isArray(job.checkedIndexes)
    ? job.checkedIndexes.filter((index) => Number.isInteger(index) && index >= 0 && index < configs.length)
    : Array.from({ length: job.done }, (_, index) => index);
  job.done = new Set(job.checkedIndexes).size;
  job.error = '';
  job.finished = false;
  job.interrupted = false;
  job.cancelled = false;
  job.resumeEligible = true;
  job.recoveryRetries = 0;
  await saveJob(RESULTS, job);
  launchAudit(job, configs);
  return summary(job);
}

async function runJob(job, configs, operation = null) {
  const signal = operation?.controller.signal;
  job.error = '';
  job.interrupted = false;
  try {
    const addresses = [];
    for (const config of configs) {
      if (signal?.aborted) throw signal.reason || new Error('بررسی لغو شد.');
      try {
        addresses.push(...await publicAddresses(config.host));
      } catch {}
    }
    const countries = await geoMap(addresses);
    if (signal?.aborted) throw signal.reason || new Error('بررسی لغو شد.');
    let countryRepairChanged = false;
    for (const item of job.results) {
      if (!item.ip || (item.country && item.countryCode)) continue;
      const location = countries[item.ip];
      if (!location) continue;
      item.country = typeof location === 'string' ? location : location.country || item.country || '';
      item.countryCode = typeof location === 'object' ? location.countryCode || item.countryCode || '' : item.countryCode || '';
      countryRepairChanged = true;
    }
    if (countryRepairChanged) await saveJob(RESULTS, job);
    const batchSize = AUTO_BATCH_SIZE;
    const checked = new Set(Array.isArray(job.checkedIndexes)
      ? job.checkedIndexes.filter((index) => Number.isInteger(index) && index >= 0 && index < configs.length)
      : Array.from({ length: Math.min(configs.length, Number(job.done) || 0) }, (_, index) => index));
    job.checkedIndexes = [...checked].sort((a, b) => a - b);
    job.done = checked.size;
    const remaining = configs.map((config, index) => ({ config, index })).filter((item) => !checked.has(item.index));
    const workerPlan = await recommendedXrayWorkerPlan();
    const workerLimit = Math.max(1, Math.min(3, Number(job.workerLimit) || 3));
    const workerCount = Math.min(workerPlan.count, workerLimit, Math.max(1, remaining.length));
    job.workerCount = workerCount;
    await saveJob(RESULTS, job);
    console.log(`Audit ${job.id}: ${workerCount} Xray worker(s), ${remaining.length} routes pending (RAM available ${workerPlan.availableMiB} MiB; reserve ${workerPlan.reserveMiB} MiB; ${workerPlan.workerBudgetMiB} MiB per worker).`);
    const partitionSize = Math.ceil(remaining.length / workerCount);
    const partitions = Array.from({ length: workerCount }, (_, index) => remaining.slice(index * partitionSize, (index + 1) * partitionSize)).filter((items) => items.length);
    let saveQueue = Promise.resolve();
    const persistBatch = (batchResults, indexes) => {
      saveQueue = saveQueue.then(async () => {
        if (signal?.aborted) return;
        job.results.push(...batchResults);
        indexes.forEach((index) => checked.add(index));
        job.checkedIndexes = [...checked].sort((a, b) => a - b);
        job.done = checked.size;
        job.recoveryRetries = 0;
        job.success = job.results.reduce((count, item) => count + (item.ok ? 1 : 0), 0);
        await saveJob(RESULTS, job);
      });
      return saveQueue;
    };
    const failures = await Promise.all(partitions.map(async (partition, workerIndex) => {
      try {
        for (let start = 0; start < partition.length; start += batchSize) {
          if (signal?.aborted) throw signal.reason || new Error('بررسی لغو شد.');
          const batch = partition.slice(start, start + batchSize);
          let loggedReady = false;
          const results = await testBatch(batch.map((item) => item.config), countries, {
            checkExit: false,
            serviceIds: [],
            concurrency: Math.min(batch.length, MAX_ROUTES_PER_XRAY),
            signal,
            throwBatchErrors: true,
            onXrayReady: (routeCount) => {
              if (loggedReady) return;
              loggedReady = true;
              console.log(`Audit ${job.id}: worker ${workerIndex + 1}/${partitions.length} Xray ready for ${routeCount} routes.`);
            },
          });
          await persistBatch(results, batch.map((item) => item.index));
        }
        return null;
      } catch (error) {
        return error;
      }
    }));
    await saveQueue;
    if (signal?.aborted) throw signal.reason || new Error('بررسی لغو شد.');
    const failure = failures.find(Boolean);
    if (failure) throw failure;
  } catch (error) {
    if (signal?.aborted) {
      job.error = '';
      job.finished = true;
      job.interrupted = true;
      job.resumeEligible = false;
      job.cancelled = true;
      await saveJob(RESULTS, job);
      if (activeOperation === operation) {
        activeOperation = null;
        activeJob = null;
      }
      if (!operation?.replaceRequested) resumePendingJobs().catch((resumeError) => console.error('audit resume failed:', resumeError.message));
      return;
    }
    job.error = error.message || 'بررسی با خطا روبه‌رو شد.';
    console.error('audit job failed:', job.id, job.error);
    if (error.code === 'XRAY_STARTUP' && Number(job.workerCount) > 1) {
      job.workerLimit = Math.max(1, Number(job.workerCount) - 1);
      console.warn(`Audit ${job.id}: reducing Xray worker limit to ${job.workerLimit} after a worker startup failure.`);
    }
    if (job.done < job.total && Number(job.recoveryRetries || 0) < MAX_RECOVERY_RETRIES) {
      job.recoveryRetries = Number(job.recoveryRetries || 0) + 1;
      job.finished = false;
      job.interrupted = false;
      await saveJob(RESULTS, job).catch((saveError) => console.error('could not save interrupted audit:', saveError.message));
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return runJob(job, configs, operation);
    }
  }
  job.finished = true;
  job.interrupted = Boolean(job.error && job.done < job.total);
  job.resumeEligible = job.done < job.total && Boolean(job.scanConfigs?.length)
    && Number(job.recoveryRetries || 0) < MAX_RECOVERY_RETRIES;
  if (activeOperation === operation) {
    activeOperation = null;
    activeJob = null;
  }
  await saveJob(RESULTS, job);
  if (job.done >= job.total) {
    job.scanConfigs = null;
    await unlink(path.join(RESULTS, `${job.id}.scan.json`)).catch(() => {});
  }
  resumePendingJobs().catch((error) => console.error('audit resume failed:', error.message));
}

async function resumePendingJobs() {
  if (activeJob) return;
  const pending = [...jobs.values()]
    .filter((job) => job.resumeEligible && !job.finished)
    .sort((a, b) => String(b.created).localeCompare(String(a.created)));
  const latest = pending[0];
  for (const job of pending.slice(1)) {
    job.resumeEligible = false;
    job.finished = true;
    job.interrupted = true;
    await saveJob(RESULTS, job);
  }
  for (const job of latest ? [latest] : []) {
    activeJob = job.id;
    let configs = Array.isArray(job.scanConfigs) ? job.scanConfigs : null;
    if ((!configs || !configs.length) && job.subscriptionUrl) {
      try {
        const text = await fetchSubscription(job.subscriptionUrl);
        configs = filterProtocols(parseSubscription(text), job.protocolIds || [...SUPPORTED_PROTOCOL_IDS])
          .slice(job.offset || 0, (job.offset || 0) + MAX_CONFIGS_PER_AUDIT);
        job.scanConfigs = configs;
        job.total = configs.length;
        job.done = Math.min(Number(job.done) || 0, configs.length);
        await saveJob(RESULTS, job);
      } catch (error) {
        job.error = `بازیابی لینک اشتراک ناموفق بود: ${error.message || 'خطای دریافت'}`;
      }
    }
    if (!configs?.length) {
      job.finished = true;
      job.interrupted = true;
      job.resumeEligible = false;
      activeJob = null;
      await saveJob(RESULTS, job);
      continue;
    }
    if (job.done >= configs.length) {
      job.finished = true;
      job.interrupted = false;
      job.resumeEligible = false;
      job.scanConfigs = null;
      activeJob = null;
      await saveJob(RESULTS, job);
      await unlink(path.join(RESULTS, `${job.id}.scan.json`)).catch(() => {});
      continue;
    }
    if (Number(job.recoveryRetries || 0) >= MAX_RECOVERY_RETRIES) {
      job.finished = true;
      job.interrupted = true;
      job.resumeEligible = false;
      activeJob = null;
      await saveJob(RESULTS, job);
      continue;
    }
    job.interrupted = false;
    console.log(`Resuming audit ${job.id} from ${job.done}/${job.total}`);
    launchAudit(job, configs);
    return;
  }
}

function publicHistory() {
  return [...jobs.values()]
    .sort((a, b) => String(b.created).localeCompare(String(a.created)))
    .slice(0, 20)
    .map(summary);
}

function interactiveSummary(task) {
  return {
    id: task.id, kind: task.kind, jobId: task.jobId,
    status: task.status, done: task.done || 0, total: task.total || 0,
    serviceId: task.serviceId || '', result: task.result || null,
    samples: task.samples || [], error: task.error || '',
    updated: task.updated || new Date().toISOString(),
  };
}

function pauseFor(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason || new Error('پایش متوقف شد.'));
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(signal.reason || new Error('پایش متوقف شد.'));
    }
    signal.addEventListener('abort', abort, { once: true });
  });
}

function startInteractiveTask(kind, job, item, config, options = {}) {
  if (activeInteractiveId) return null;
  const task = {
    id: crypto.randomBytes(12).toString('base64url'), kind, jobId: job.id,
    uri: item.uri, serviceId: options.serviceId || '',
    status: 'starting', done: 0, total: 0, result: null, samples: [],
    controller: new AbortController(), updated: new Date().toISOString(),
    ...(Array.isArray(options.entries) ? { entries: options.entries } : {}),
  };
  interactiveTasks.set(task.id, task);
  activeInteractiveId = task.id;
  while (interactiveTasks.size > 100) {
    const [oldestId, oldest] = interactiveTasks.entries().next().value;
    if (oldestId === activeInteractiveId) break;
    interactiveTasks.delete(oldestId);
  }
  runInteractiveTask(task, job, item, config).catch((error) => {
    task.error = error.message || 'بررسی تعاملی ناموفق بود.';
    task.status = 'failed';
  });
  return task;
}

async function runInteractiveTask(task, job, item, config) {
  const { signal } = task.controller;
  let session;
  try {
    task.status = 'starting';
    task.updated = new Date().toISOString();
    const countries = item.ip ? { [item.ip]: { country: item.country || '', countryCode: item.countryCode || '' } } : {};
    if (task.kind === 'ping-all') {
      const entries = task.entries || [];
      task.status = 'running';
      task.total = entries.length;
      for (let start = 0; start < entries.length; start += MAX_ROUTES_PER_XRAY) {
        if (signal.aborted) throw signal.reason || new Error('بررسی لغو شد.');
        const chunk = entries.slice(start, start + MAX_ROUTES_PER_XRAY);
        const countryMap = Object.fromEntries(chunk.filter(({ item }) => item.ip).map(({ item }) => [item.ip, { country: item.country || '', countryCode: item.countryCode || '' }]));
        const checks = await testBatch(chunk.map(({ config }) => config), countryMap, {
          checkExit: false, checkServices: false, concurrency: Math.min(chunk.length, MAX_ROUTES_PER_XRAY), signal, throwBatchErrors: true,
        });
        checks.forEach((check, index) => {
          const { item } = chunk[index];
          item.endpointConnectMs = check.endpointConnectMs ?? null;
          item.pingCheck = {
            ok: check.ok, ms: check.ms ?? null, endpointConnectMs: check.endpointConnectMs ?? null,
            httpStatus: check.httpStatus || 0, timings: check.timings || null,
            error: check.error || '', checked: new Date().toISOString(),
          };
        });
        task.done += chunk.length;
        task.result = { updated: task.done };
        task.updated = new Date().toISOString();
        await saveJob(RESULTS, job);
      }
    } else if (task.kind === 'download') {
      task.status = 'running';
      task.total = 5;
      task.result = await testDownload(config, { signal });
      item.speedCheck = { ...task.result, checked: new Date().toISOString() };
      task.done = 5;
      await saveJob(RESULTS, job);
    } else {
      session = await openProbeSession(config, countries, { signal });
      const routePing = await session.route({ checkExit: false, checkServices: false, signal });
      if (!routePing.ok) throw new Error(routePing.error || 'اتصال HTTPS از مسیر این کانفیگ برقرار نشد.');
      item.endpointConnectMs = session.base.endpointConnectMs ?? null;
      item.pingCheck = {
        ok: routePing.ok, ms: routePing.ms ?? null,
        endpointConnectMs: session.base.endpointConnectMs ?? null,
        httpStatus: routePing.httpStatus || 0, timings: routePing.timings || null,
        error: routePing.error || '', checked: new Date().toISOString(),
      };
      if (task.kind === 'services') {
        task.status = 'running';
        task.total = SERVICES.length;
        task.liveServices = [];
        item.services = [];
        item.servicesChecked = null;
        const checks = await session.checkServices(SERVICES.map(({ id }) => id), signal, (done, total, check) => {
          const checked = new Date().toISOString();
          const result = { ...check, checked };
          task.done = done; task.total = total; task.liveServices.push(result); task.result = { serviceResults: task.liveServices }; task.updated = checked;
          const serviceIndex = (item.services || []).findIndex((entry) => entry.id === result.id);
          if (serviceIndex >= 0) item.services[serviceIndex] = result;
          else item.services = [...(item.services || []), result];
        });
        item.services = checks.map((check) => ({ ...check, checked: new Date().toISOString() }));
        item.servicesChecked = new Date().toISOString();
        task.result = { pingCheck: item.pingCheck, endpointConnectMs: item.endpointConnectMs, services: item.services };
        task.done = checks.length;
        await saveJob(RESULTS, job);
      } else if (task.kind === 'monitor') {
        task.status = 'running';
        task.total = 0;
        const history = [];
        let nextSampleAt = Date.now();
        while (!signal.aborted) {
          const waitMs = nextSampleAt - Date.now();
          if (waitMs > 0) await pauseFor(waitMs, signal);
          const check = await session.checkService(task.serviceId, signal);
          const checked = new Date().toISOString();
          const sample = { ...check, checked };
          history.push(sample);
          if (history.length > 120) history.shift();
          task.samples = history;
          task.done += 1;
          task.result = sample;
          task.updated = checked;
          const serviceIndex = (item.services || []).findIndex((entry) => entry.id === task.serviceId);
          if (serviceIndex >= 0) item.services[serviceIndex] = sample;
          else item.services = [...(item.services || []), sample];
          item.servicesChecked = checked;
          await saveJob(RESULTS, job);
          if (signal.aborted) break;
          nextSampleAt += 5000;
        }
        task.status = 'stopped';
        task.updated = new Date().toISOString();
      }
    }
    if (!signal.aborted && task.status !== 'stopped') task.status = 'complete';
  } catch (error) {
    if (signal.aborted) {
      task.status = 'stopped';
    } else {
      task.status = 'failed';
      task.error = error.message || 'بررسی تعاملی ناموفق بود.';
    }
  } finally {
    await session?.close();
    task.updated = new Date().toISOString();
    if (activeInteractiveId === task.id) activeInteractiveId = null;
    await saveJob(RESULTS, job).catch((error) => console.error('could not save interactive result:', error.message));
  }
}

async function route(request, response) {
  const url = new URL(request.url, 'https://localhost');

  if (request.method === 'GET' && url.pathname === '/login') {
    if (authorized(request)) return redirect(response, '/');
    const body = await readFile(path.join(PUBLIC, 'login.html'));
    headers(response, 'text/html; charset=utf-8');
    response.writeHead(200, { 'Content-Length': body.length });
    response.end(body);
    return;
  }
  if (request.method === 'GET' && url.pathname === '/assets/connecso-mark-pair.png') {
    const body = await readFile(path.join(PUBLIC, 'assets/connecso-mark-pair.png'));
    headers(response, 'image/png');
    response.writeHead(200, { 'Content-Length': body.length, 'Cache-Control': 'public, max-age=86400' });
    response.end(body);
    return;
  }
  if (request.method === 'GET' && url.pathname === '/assets/login.css') {
    const body = await readFile(path.join(PUBLIC, 'login.css'));
    headers(response, 'text/css; charset=utf-8');
    response.writeHead(200, { 'Content-Length': body.length });
    response.end(body);
    return;
  }
  if (request.method === 'GET' && url.pathname === '/assets/login.js') {
    const body = await readFile(path.join(PUBLIC, 'login.js'));
    headers(response, 'text/javascript; charset=utf-8');
    response.writeHead(200, { 'Content-Length': body.length, 'Cache-Control': 'no-cache, must-revalidate' });
    response.end(body);
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/login') {
    let form;
    try { form = new URLSearchParams(await readBody(request)); }
    catch { return redirect(response, '/login?error=1'); }
    const username = form.get('username') || '';
    const given = Buffer.from(form.get('password') || '');
    const expected = Buffer.from(PASSWORD);
    const valid = username === 'admin' && given.length === expected.length && crypto.timingSafeEqual(given, expected);
    if (!valid) return redirect(response, '/login?error=1');
    const sessionId = crypto.randomBytes(32).toString('base64url');
    const remember = form.get('remember') === '1';
    const maxAge = remember ? 30 * 24 * 60 * 60 : 12 * 60 * 60;
    sessions.set(sessionId, Date.now() + maxAge * 1000);
    const cookie = `vless_audit_session=${sessionId}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
    return redirect(response, '/', { 'Set-Cookie': cookie });
  }
  // Used by the installer and external health monitors; it must not require
  // an interactive browser session.
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(response, 200, { ok: true, service: 'Connecso Outbound Audit', version: '2.1' });
  }

  if (!authorized(request)) {
    if (request.method === 'GET' && !url.pathname.startsWith('/api/')) return redirect(response, '/login');
    return fail(response, 401, 'برای ادامه وارد پنل شو.');
  }
  if (request.method === 'POST' && url.pathname === '/api/logout') {
    const cookie = request.headers.cookie || '';
    const sessionId = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('vless_audit_session='))?.slice('vless_audit_session='.length);
    if (sessionId) sessions.delete(sessionId);
    return redirect(response, '/login', { 'Set-Cookie': 'vless_audit_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict' });
  }
  if (request.method === 'GET' && url.pathname === '/api/update/status') {
    try { return sendJson(response, 200, JSON.parse(await readFile(UPDATE_STATUS, 'utf8'))); }
    catch (error) { if (error.code === 'ENOENT') return sendJson(response, 200, { state: 'idle' }); throw error; }
  }
  const resumeMatch = url.pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]+)\/resume$/);
  if (request.method === 'POST' && resumeMatch) {
    const job = jobs.get(resumeMatch[1]);
    if (!job) return fail(response, 404, 'این بررسی در سابقه پیدا نشد.');
    if (activeJob) return fail(response, 409, 'یک بررسی دیگر در حال اجراست. پس از پایان آن دوباره تلاش کن.');
    if (!(job.finished && job.interrupted && job.done < job.total)) return fail(response, 409, 'این بررسی مورد ناتمامی برای ادامه ندارد.');
    try { return sendJson(response, 202, await resumeJob(job)); }
    catch (error) { return fail(response, 400, error.message || 'ادامهٔ بررسی ممکن نشد.'); }
  }
  if (request.method === 'POST' && url.pathname === '/api/update') {
    try { await readFile('/etc/systemd/system/vless-audit-self-update.path'); }
    catch { return fail(response, 503, 'به‌روزرسانی داخل پنل هنوز در نصب این نسخه فعال نشده است.'); }
    if (activeJob) return fail(response, 409, 'ابتدا بررسی جاری را تمام کن.');
    let status = {};
    try { status = JSON.parse(await readFile(UPDATE_STATUS, 'utf8')); } catch {}
    if (['queued','checking','downloading','installing','restarting'].includes(status.state)) return fail(response, 409, 'به‌روزرسانی دیگری در حال اجراست.');
    const id = crypto.randomBytes(10).toString('hex');
    const temporary = UPDATE_REQUEST + '.' + id + '.tmp';
    await writeFile(temporary, JSON.stringify({ id, requestedAt: new Date().toISOString() }), { mode: 0o600, flag: 'wx' });
    await writeFile(UPDATE_STATUS, JSON.stringify({ id, state:'queued', message:'updateQueued', updatedAt:new Date().toISOString() }), { mode:0o600 });
    try { await rename(temporary, UPDATE_REQUEST); }
    catch (error) { await unlink(temporary).catch(() => {}); await writeFile(UPDATE_STATUS, JSON.stringify({ id, state:'failed', error:'درخواست به‌روزرسانی ثبت نشد.', updatedAt:new Date().toISOString() }), { mode:0o600 }); throw error; }
    return sendJson(response, 202, { id, state:'queued' });
  }
  if (request.method === 'GET' && url.pathname === '/') {
    const body = await readFile(path.join(PUBLIC, 'index.html'));
    headers(response, 'text/html; charset=utf-8');
    response.writeHead(200, { 'Content-Length': body.length, 'Cache-Control': 'no-cache, must-revalidate' });
    response.end(body);
    return;
  }
  if (request.method === 'GET' && url.pathname.startsWith('/assets/')) {
    const assets = {
      '/assets/app.css': ['app.css', 'text/css; charset=utf-8'],
      '/assets/app.js': ['app.js', 'text/javascript; charset=utf-8'],
      '/assets/favicon.svg': ['favicon.svg', 'image/svg+xml'],
      '/assets/connecso-mark-pair.png': ['assets/connecso-mark-pair.png', 'image/png'],
    };
    const flagMatch = url.pathname.match(/^\/assets\/flags\/(?:[a-z]{2}|globe)\.svg$/);
    const serviceIconMatch = url.pathname.match(/^\/assets\/services\/[a-z0-9-]{1,48}\.svg$/);
    const asset = assets[url.pathname];
    if (!asset && !flagMatch && !serviceIconMatch) return fail(response, 404, 'این فایل پیدا نشد.');
    const body = await readFile(path.join(PUBLIC, asset ? asset[0] : url.pathname.slice(1)));
    headers(response, asset ? asset[1] : 'image/svg+xml');
    response.writeHead(200, { 'Content-Length': body.length, 'Cache-Control': 'no-cache, must-revalidate' });
    response.end(body);
    return;
  }
  const interactiveMatch = url.pathname.match(/^\/api\/interactive\/([A-Za-z0-9_-]+)$/);
  if (request.method === 'GET' && interactiveMatch) {
    const task = interactiveTasks.get(interactiveMatch[1]);
    return task ? sendJson(response, 200, interactiveSummary(task)) : fail(response, 404, 'این بررسی تعاملی پیدا نشد.');
  }
  const interactiveStopMatch = url.pathname.match(/^\/api\/interactive\/([A-Za-z0-9_-]+)\/stop$/);
  if (request.method === 'POST' && interactiveStopMatch) {
    const task = interactiveTasks.get(interactiveStopMatch[1]);
    if (!task) return fail(response, 404, 'این بررسی تعاملی پیدا نشد.');
    if (task.status === 'running' || task.status === 'starting') {
      task.controller.abort(new Error('پایش توسط کاربر متوقف شد.'));
      task.status = 'stopping';
      task.updated = new Date().toISOString();
    }
    return sendJson(response, 202, interactiveSummary(task));
  }
  if (request.method === 'GET' && url.pathname === '/api/history') {
    return sendJson(response, 200, publicHistory());
  }
  const auditStopMatch = url.pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]+)\/stop$/);
  if (request.method === 'POST' && auditStopMatch) {
    const operation = activeOperation;
    if (!operation || operation.kind !== 'audit' || operation.jobId !== auditStopMatch[1]) return fail(response, 404, 'این اسکن در حال اجرا نیست.');
    operation.controller.abort(new Error('اسکن با درخواست کاربر متوقف شد.'));
    return sendJson(response, 202, { ok: true, stopping: true, id: auditStopMatch[1] });
  }
  const metadataMatch = url.pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]+)\/meta$/);
  if (request.method === 'PATCH' && metadataMatch) {
    const job = jobs.get(metadataMatch[1]);
    if (!job) return fail(response, 404, 'این بررسی در سابقه پیدا نشد.');
    let input;
    try { input = JSON.parse(await readBody(request)); }
    catch (error) { return fail(response, error.status || 400, error.status ? error.message : 'متن درخواست معتبر نیست.'); }
    const title = String(input.title || '').trim();
    if (title.length > 80) return fail(response, 400, 'نام حداکثر ۸۰ نویسه باشد.');
    const tags = [...new Set((Array.isArray(input.tags) ? input.tags : String(input.tags || '').split(',')).map((tag) => String(tag).trim()).filter(Boolean))];
    if (tags.length > 8 || tags.some((tag) => tag.length > 24)) return fail(response, 400, 'حداکثر ۸ برچسب، هرکدام تا ۲۴ نویسه مجاز است.');
    let subscriptionUrl = job.subscriptionUrl || '';
    if (Object.hasOwn(input, 'subscriptionUrl')) {
      subscriptionUrl = String(input.subscriptionUrl || '').trim();
      if (subscriptionUrl.length > 2048) return fail(response, 400, 'لینک اشتراک بیش از حد طولانی است.');
      if (subscriptionUrl) {
        try {
          const parsedUrl = new URL(subscriptionUrl);
          if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) throw new Error();
        } catch { return fail(response, 400, 'لینک اشتراک باید یک آدرس HTTP یا HTTPS معتبر باشد.'); }
      }
    }
    job.title = title;
    job.tags = tags;
    job.favorite = Boolean(input.favorite);
    job.subscriptionUrl = subscriptionUrl;
    await saveJob(RESULTS, job);
    return sendJson(response, 200, { id: job.id, title: job.title, tags: job.tags, favorite: job.favorite, hasSubscriptionUrl: Boolean(job.subscriptionUrl) });
  }
  const rescanMatch = url.pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]+)\/rescan$/);
  if (request.method === 'POST' && rescanMatch) {
    if (activeJob) return fail(response, 409, 'یک بررسی دیگر در حال اجراست. پس از پایان آن دوباره تلاش کن.');
    const previous = jobs.get(rescanMatch[1]);
    if (!previous) return fail(response, 404, 'این بررسی در سابقه پیدا نشد.');
    let input = {};
    try { input = JSON.parse(await readBody(request)); }
    catch (error) { return fail(response, error.status || 400, error.status ? error.message : 'تنظیمات اجرای دوباره معتبر نیست.'); }
    const protocolIds = Array.isArray(input.protocolIds)
      ? [...new Set(input.protocolIds.map((id) => String(id).toLowerCase()).filter((id) => SUPPORTED_PROTOCOL_IDS.has(id)))]
      : [...SUPPORTED_PROTOCOL_IDS];
    if (!protocolIds.length) return fail(response, 400, 'حداقل یک پروتکل را برای اجرای دوباره انتخاب کن.');
    const suppliedUrl = String(input.subscriptionUrl || '').trim();
    const subscriptionUrl = suppliedUrl || previous.subscriptionUrl || '';
    let text;
    if (subscriptionUrl) {
      try { text = await fetchSubscription(subscriptionUrl); }
      catch (error) { return fail(response, error.status || 400, error.message || 'دریافت لینک ساب ناموفق بود.'); }
    } else {
      // Pasted config lists have no subscription URL; recheck their saved source configs.
      text = previous.results.map((item) => item.uri).filter(Boolean).join('\n');
    }
    const parsedConfigs = parseSubscription(text);
    const configs = filterProtocols(parsedConfigs, protocolIds);
    if (!configs.length && !subscriptionUrl) return fail(response, 400, 'در ورودی ذخیره‌شده کانفیگ پشتیبانی‌شده‌ای پیدا نشد.');
    const offset = 0;
    const message = configs.length ? '' : parsedConfigs.length ? 'در این اشتراک از پروتکل‌های انتخاب‌شده کانفیگی پیدا نشد.' : 'فهرست دریافت شد، اما کانفیگ سازگار برای بررسی در آن نبود.';
    return sendJson(response, 202, await beginJob(configs, offset, subscriptionUrl, message, { checkExit: false, serviceIds: [], protocolIds }));
  }
  const pingAllMatch = url.pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]+)\/results\/ping-all$/);
  if (request.method === 'POST' && pingAllMatch) {
    if (activeInteractiveId) return fail(response, 409, 'یک بررسی تعاملی دیگر در حال اجراست.');
    const job = jobs.get(pingAllMatch[1]);
    if (!job) return fail(response, 404, 'No audit was found.');
    let input;
    try { input = JSON.parse(await readBody(request)); }
    catch (error) { return fail(response, error.status || 400, error.message || 'Invalid request.'); }
    const uris = [...new Set(Array.isArray(input.uris) ? input.uris.map((uri) => String(uri)) : [])];
    if (!uris.length || uris.length > MAX_CONFIGS_PER_AUDIT) return fail(response, 400, `Provide between 1 and ${MAX_CONFIGS_PER_AUDIT} routes.`);
    const selected = [];
    for (const uri of uris) {
      const item = job.results.find((result) => result.ok && result.uri === uri);
      const [config] = parseSubscription(uri);
      if (!item || !config) return fail(response, 400, 'A route does not belong to this audit.');
      selected.push({ uri, item, config });
    }
    const task = startInteractiveTask('ping-all', job, selected[0].item, selected[0].config, { entries: selected });
    return task ? sendJson(response, 202, interactiveSummary(task)) : fail(response, 409, 'یک بررسی تعاملی دیگر در حال اجراست.');
  }
  const routeAction = url.pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]+)\/results\/(ping|download)$/);
  if (request.method === 'POST' && routeAction) {
    if (activeInteractiveId) return fail(response, 409, 'یک بررسی تعاملی دیگر در حال اجراست.');
    const job = jobs.get(routeAction[1]);
    if (!job) return fail(response, 404, 'نتیجه‌ای برای این بررسی پیدا نشد.');
    let input;
    try { input = JSON.parse(await readBody(request)); }
    catch (error) { return fail(response, error.status || 400, error.status ? error.message : 'درخواست معتبر نیست.'); }
    const uri = String(input.uri || '');
    const resultIndex = job.results.findIndex((item) => item.ok && item.uri === uri);
    if (resultIndex < 0) return fail(response, 404, 'این کانفیگ در نتیجه‌های موفق این بررسی نیست.');
    const [config] = parseSubscription(uri);
    if (!config) return fail(response, 400, 'کانفیگ معتبر نیست.');
    const item = job.results[resultIndex];
    const countryMap = item.ip ? { [item.ip]: item.country || '' } : {};
    if (routeAction[2] === 'download') {
      const task = startInteractiveTask('download', job, item, config);
      return task ? sendJson(response, 202, interactiveSummary(task)) : fail(response, 409, 'یک بررسی تعاملی دیگر در حال اجراست.');
    }
    activeInteractiveId = 'ping-' + crypto.randomBytes(8).toString('hex');
    try {
      const check = await testOne(config, countryMap, { checkExit: false, checkServices: false });
      item.endpointConnectMs = check.endpointConnectMs ?? null;
      item.pingCheck = { ok: check.ok, ms: check.ms ?? null, endpointConnectMs: check.endpointConnectMs ?? null, httpStatus: check.httpStatus || 0, timings: check.timings || null, error: check.error || '', checked: new Date().toISOString() };
      await saveJob(RESULTS, job);
      return sendJson(response, 200, item.pingCheck);
    } catch (error) {
      return fail(response, 502, error.message || 'بررسی کانفیگ انجام نشد.');
    } finally {
      activeInteractiveId = null;
    }
  }
  const jobMatch = url.pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]+)$/);
  if (request.method === 'GET' && jobMatch) {
    const job = jobs.get(jobMatch[1]);
    if (!job) return fail(response, 404, 'این بررسی در سابقه پیدا نشد.');
    if (url.searchParams.get('subscription-url') === '1') return sendJson(response, 200, { subscriptionUrl: job.subscriptionUrl || '' });
    if (url.searchParams.get('summary') === '1') return sendJson(response, 200, summary(job));
    const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0);
    const limit = Math.min(CHUNK_SIZE, Math.max(1, Number.parseInt(url.searchParams.get('limit') || String(CHUNK_SIZE), 10) || CHUNK_SIZE));
    const results = job.results.filter((item) => item.ok);
    return sendJson(response, 200, { ...summary(job), offset, results: results.slice(offset, offset + limit) });
  }
  if (request.method === 'POST' && url.pathname === '/api/analyze') {
    let input;
    try {
      input = JSON.parse(await readBody(request));
    } catch (error) {
      return fail(response, error.status || 400, error.status ? error.message : 'متن درخواست JSON معتبر نیست.');
    }
    if (activeJob && ['audit', 'ping-all'].includes(activeOperation?.kind)
      && input.replaceCheck !== true && input.replacePingAll !== true) {
      return fail(response, 409, 'یک بررسی هنوز در حال اجراست.', 'CHECK_ACTIVE');
    }
    if (activeJob && !['audit', 'ping-all'].includes(activeOperation?.kind)) {
      return fail(response, 409, 'یک بررسی دیگر در حال اجراست. پس از پایان آن دوباره تلاش کن.');
    }
    let text = String(input.text || '');
    if (input.subscriptionUrl) {
      try {
        text = await fetchSubscription(String(input.subscriptionUrl));
      } catch (error) {
        return fail(response, error.status || 400, error.message || 'دریافت لینک ساب ناموفق بود.');
      }
    }
    const parsedConfigs = parseSubscription(text);
    const protocolIds = Array.isArray(input.protocolIds) ? input.protocolIds.filter((id) => SUPPORTED_PROTOCOL_IDS.has(String(id).toLowerCase())).map((id) => String(id).toLowerCase()) : [...SUPPORTED_PROTOCOL_IDS];
    const configs = filterProtocols(parsedConfigs, protocolIds);
    const subscriptionUrl = input.subscriptionUrl ? String(input.subscriptionUrl).trim() : '';
    if (!parsedConfigs.length && !subscriptionUrl) return fail(response, 400, 'کانفیگ پشتیبانی‌شده‌ای در ورودی پیدا نشد.');
    const offset = Math.max(0, Number.parseInt(input.offset || '0', 10) || 0);
    if (configs.length && offset >= configs.length) return fail(response, 400, 'شمارهٔ شروع از تعداد کانفیگ‌های انتخاب‌شده بیشتر است.');
    const message = configs.length ? '' : parsedConfigs.length ? 'No configs match the selected protocols.' : 'No supported configs were found in this subscription.';
    const serviceIds = [];
    if (activeJob) {
      if (['audit', 'ping-all'].includes(activeOperation?.kind) && (input.replaceCheck === true || input.replacePingAll === true)) {
        const previousOperation = activeOperation;
        previousOperation.replaceRequested = true;
        previousOperation.controller.abort(new Error('بررسی قبلی با فهرست جدید جایگزین شد.'));
        await previousOperation.done;
      } else if (['audit', 'ping-all'].includes(activeOperation?.kind)) {
        return fail(response, 409, 'یک بررسی هنوز در حال اجراست.', 'CHECK_ACTIVE');
      } else {
        return fail(response, 409, 'یک بررسی دیگر در حال اجراست. پس از پایان آن دوباره تلاش کن.');
      }
    }
    return sendJson(response, 202, await beginJob(configs, offset, subscriptionUrl, message, { checkExit: input.checkExit !== false, serviceIds, protocolIds }));
  }
  return fail(response, 404, 'این مسیر پیدا نشد.');
}

await mkdir(RESULTS, { recursive: true, mode: 0o700 });
const server = https.createServer({
  key: await readFile(KEY),
  cert: await readFile(CERT),
  minVersion: 'TLSv1.2',
  maxHeaderSize: 16 * 1024,
}, (request, response) => {
  route(request, response).catch((error) => {
    console.error('request failed:', error.message);
    if (!response.headersSent) fail(response, 500, 'درخواست کامل نشد. دوباره تلاش کن.');
    else response.destroy();
  });
});
server.headersTimeout = 12_000;
server.requestTimeout = 20_000;
server.keepAliveTimeout = 5_000;
server.listen(PORT, HOST, () => {
  console.log('Connecso Outbound Audit listening on ' + HOST + ':' + PORT);
  repairSavedCountries().catch((error) => console.error('saved country repair failed:', error.message));
  resumePendingJobs().catch((error) => console.error('audit resume failed:', error.message));
});
