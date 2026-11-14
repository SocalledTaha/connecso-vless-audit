import https from 'node:https';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import { fileURLToPath } from 'node:url';
import { parseSubscription } from './src/vless.mjs';
import { geoMap, publicAddresses, testBatch, testOne, testDownload } from './src/probe.mjs';
import { loadJobs, saveJob } from './src/store.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const RESULTS = process.env.RESULTS_DIR || '/opt/vless-audit/results';
const CERT = process.env.CERT_FILE || '/etc/vless-audit/server.crt';
const KEY = process.env.KEY_FILE || '/etc/vless-audit/server.key';
const PORT = Number(process.env.PORT || 3006);
const HOST = process.env.HOST || '0.0.0.0';
const PASSWORD = process.env.PANEL_PASSWORD || '';
const MAX_BODY = 2_500_000;
const CHUNK_SIZE = 12;
const MAX_CONCURRENT_CHECKS = 20;
const jobs = await loadJobs(RESULTS);
let activeJob = null;
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

function fail(response, status, message) {
  sendJson(response, status, { error: message });
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
    total: job.total,
    available: job.available,
    offset: job.offset,
    batchSize: Math.min(MAX_CONCURRENT_CHECKS, Math.max(1, Number(job.batchSize) || MAX_CONCURRENT_CHECKS)),
    done: job.done,
    success: job.success,
    failed: Math.max(0, job.done - job.success),
    finished: Boolean(job.finished),
    interrupted: Boolean(job.interrupted),
    canRescan: true,
    needsRescanUrl: Boolean(!job.subscriptionUrl && !job.results.some((item) => item.uri)),
    message: job.message || '',
  };
}

async function beginJob(configs, offset, batchSize, subscriptionUrl = '', message = '', scanOptions = {}) {
  batchSize = Math.min(MAX_CONCURRENT_CHECKS, Math.max(1, Number.parseInt(batchSize, 10) || MAX_CONCURRENT_CHECKS));
  const selected = configs.slice(offset, offset + 250);
  const id = crypto.randomBytes(9).toString('base64url');
  const job = {
    id,
    created: new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC'),
    total: selected.length,
    available: configs.length,
    offset,
    batchSize,
    checkExit: scanOptions.checkExit !== false,
    serviceIds: Array.isArray(scanOptions.serviceIds) ? scanOptions.serviceIds : ['gemini', 'youtube', 'instagram', 'telegram'],
    done: 0,
    success: 0,
    finished: selected.length === 0,
    interrupted: false,
    results: [],
    ...(message ? { message } : {}),
    ...(subscriptionUrl ? { subscriptionUrl } : {}),
  };
  jobs.set(id, job);
  await saveJob(RESULTS, job);
  if (selected.length) {
    activeJob = id;
    runJob(job, selected);
  }
  return summary(job);
}

async function runJob(job, configs) {
  try {
    const addresses = [];
    for (const config of configs) {
      try {
        addresses.push(...await publicAddresses(config.host));
      } catch {}
    }
    const countries = await geoMap(addresses);
    const batchSize = Math.min(MAX_CONCURRENT_CHECKS, Math.max(1, Number(job.batchSize) || MAX_CONCURRENT_CHECKS));
    for (let start = 0; start < configs.length; start += batchSize) {
      const batch = configs.slice(start, start + batchSize);
      const results = await testBatch(batch, countries, { checkExit: job.checkExit, serviceIds: job.serviceIds });
      job.results.push(...results);
      job.done += batch.length;
      job.success = job.results.reduce((count, item) => count + (item.ok ? 1 : 0), 0);
      await saveJob(RESULTS, job);
    }
  } catch (error) {
    job.error = error.message || 'بررسی با خطا روبه‌رو شد.';
  } finally {
    job.finished = true;
    activeJob = null;
    await saveJob(RESULTS, job);
  }
}

function publicHistory() {
  return [...jobs.values()]
    .sort((a, b) => String(b.created).localeCompare(String(a.created)))
    .slice(0, 20)
    .map(summary);
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
    response.writeHead(200, { 'Content-Length': body.length });
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
  if (request.method === 'GET' && url.pathname === '/') {
    const body = await readFile(path.join(PUBLIC, 'index.html'));
    headers(response, 'text/html; charset=utf-8');
    response.writeHead(200, { 'Content-Length': body.length });
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
    const asset = assets[url.pathname];
    if (!asset) return fail(response, 404, 'این فایل پیدا نشد.');
    const body = await readFile(path.join(PUBLIC, asset[0]));
    headers(response, asset[1]);
    response.writeHead(200, { 'Content-Length': body.length });
    response.end(body);
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(response, 200, { ok: true, service: 'Connecso Outbound Audit', version: '2.1' });
  }
  if (request.method === 'GET' && url.pathname === '/api/history') {
    return sendJson(response, 200, publicHistory());
  }
  const rescanMatch = url.pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]+)\/rescan$/);
  if (request.method === 'POST' && rescanMatch) {
    if (activeJob) return fail(response, 409, 'یک بررسی دیگر در حال اجراست. پس از پایان آن دوباره تلاش کن.');
    const previous = jobs.get(rescanMatch[1]);
    if (!previous) return fail(response, 404, 'این بررسی در سابقه پیدا نشد.');
    let suppliedUrl = '';
    if (!previous.subscriptionUrl && !previous.results.some((item) => item.uri)) {
      let input;
      try { input = JSON.parse(await readBody(request)); }
      catch (error) { return fail(response, error.status || 400, error.status ? error.message : 'لینک ساب برای اجرای دوباره لازم است.'); }
      suppliedUrl = String(input.subscriptionUrl || '').trim();
      if (!suppliedUrl) return fail(response, 400, 'این سابقه لینک ذخیره‌شده ندارد؛ لینک ساب را وارد کن تا دوباره بررسی شود.');
    }
    let text;
    const subscriptionUrl = previous.subscriptionUrl || suppliedUrl;
    if (subscriptionUrl) {
      try { text = await fetchSubscription(subscriptionUrl); }
      catch (error) { return fail(response, error.status || 400, error.message || 'دریافت لینک ساب ناموفق بود.'); }
    } else {
      // Legacy histories did not keep their original subscription URL. Recheck the configs saved in that result.
      text = previous.results.map((item) => item.uri).filter(Boolean).join('\n');
    }
    const configs = parseSubscription(text);
    if (!configs.length && !subscriptionUrl) return fail(response, 400, 'در ورودی ذخیره‌شده کانفیگ پشتیبانی‌شده‌ای پیدا نشد.');
    const offset = configs.length && subscriptionUrl ? Math.min(previous.offset || 0, configs.length - 1) : 0;
    const message = configs.length ? '' : 'فهرست دریافت شد، اما کانفیگ سازگار برای بررسی در آن نبود.';
    return sendJson(response, 202, await beginJob(configs, offset, previous.batchSize || MAX_CONCURRENT_CHECKS, subscriptionUrl, message, { checkExit: previous.checkExit, serviceIds: previous.serviceIds }));
  }
  const routeAction = url.pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]+)\/results\/(ping|download)$/);
  if (request.method === 'POST' && routeAction) {
    if (activeJob) return fail(response, 409, 'یک بررسی دیگر در حال اجراست. پس از پایان آن دوباره تلاش کن.');
    const job = jobs.get(routeAction[1]);
    if (!job || !job.finished) return fail(response, 404, 'نتیجهٔ آماده‌ای برای این بررسی پیدا نشد.');
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
    activeJob = 'single-' + routeAction[2];
    try {
      if (routeAction[2] === 'ping') {
        const check = await testOne(config, countryMap, { checkExit: false, checkServices: false });
        item.pingCheck = { ok: check.ok, ms: check.ms ?? null, httpStatus: check.httpStatus || 0, timings: check.timings || null, error: check.error || '', checked: new Date().toISOString() };
        await saveJob(RESULTS, job);
        return sendJson(response, 200, item.pingCheck);
      }
      item.speedCheck = { ...(await testDownload(config)), checked: new Date().toISOString() };
      await saveJob(RESULTS, job);
      return sendJson(response, 200, item.speedCheck);
    } catch (error) {
      return fail(response, 502, error.message || 'بررسی کانفیگ انجام نشد.');
    } finally {
      activeJob = null;
    }
  }
  const jobMatch = url.pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]+)$/);
  if (request.method === 'GET' && jobMatch) {
    const job = jobs.get(jobMatch[1]);
    if (!job) return fail(response, 404, 'این بررسی در سابقه پیدا نشد.');
    if (url.searchParams.get('summary') === '1') return sendJson(response, 200, summary(job));
    const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0);
    const limit = Math.min(CHUNK_SIZE, Math.max(1, Number.parseInt(url.searchParams.get('limit') || String(CHUNK_SIZE), 10) || CHUNK_SIZE));
    const results = job.results.filter((item) => item.ok);
    return sendJson(response, 200, { ...summary(job), offset, results: results.slice(offset, offset + limit) });
  }
  if (request.method === 'POST' && url.pathname === '/api/analyze') {
    if (activeJob) return fail(response, 409, 'یک بررسی دیگر در حال اجراست. پس از پایان آن دوباره تلاش کن.');
    let input;
    try {
      input = JSON.parse(await readBody(request));
    } catch (error) {
      return fail(response, error.status || 400, error.status ? error.message : 'متن درخواست JSON معتبر نیست.');
    }
    let text = String(input.text || '');
    if (input.subscriptionUrl) {
      try {
        text = await fetchSubscription(String(input.subscriptionUrl));
      } catch (error) {
        return fail(response, error.status || 400, error.message || 'دریافت لینک ساب ناموفق بود.');
      }
    }
    const configs = parseSubscription(text);
    const subscriptionUrl = input.subscriptionUrl ? String(input.subscriptionUrl).trim() : '';
    if (!configs.length && !subscriptionUrl) return fail(response, 400, 'کانفیگ پشتیبانی‌شده‌ای در ورودی پیدا نشد.');
    const offset = Math.max(0, Number.parseInt(input.offset || '0', 10) || 0);
    if (configs.length && offset >= configs.length) return fail(response, 400, 'شمارهٔ شروع از تعداد کانفیگ‌های امن بیشتر است.');
    const requestedBatch = Number.parseInt(input.batchSize || String(MAX_CONCURRENT_CHECKS), 10);
    const batchSize = Math.min(MAX_CONCURRENT_CHECKS, Math.max(1, Number.isFinite(requestedBatch) ? requestedBatch : MAX_CONCURRENT_CHECKS));
    const message = configs.length ? '' : 'فهرست دریافت شد، اما کانفیگ سازگار برای بررسی پیدا نشد.';
    const serviceIds = Array.isArray(input.serviceIds) ? input.serviceIds.filter((id) => ['gemini', 'youtube', 'instagram', 'telegram'].includes(id)) : ['gemini', 'youtube', 'instagram', 'telegram'];
    return sendJson(response, 202, await beginJob(configs, offset, batchSize, subscriptionUrl, message, { checkExit: input.checkExit !== false, serviceIds }));
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
server.listen(PORT, HOST, () => console.log('Connecso Outbound Audit listening on ' + HOST + ':' + PORT));
