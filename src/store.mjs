import { mkdir, readFile, readdir, rename, chmod, writeFile, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseSubscription, toPanelOutbound } from './vless.mjs';

export async function loadJobs(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const names = (await readdir(directory)).filter((name) => name.endsWith('.json') && !name.endsWith('.scan.json'));
  const files = await Promise.all(names.map(async (name) => ({ name, modified: (await stat(path.join(directory, name))).mtimeMs })));
  files.sort((a, b) => b.modified - a.modified);
  const jobs = new Map();
  for (const file of files.slice(0, 20)) {
    try {
      const job = JSON.parse(await readFile(path.join(directory, file.name), 'utf8'));
      if (!job.id || !Array.isArray(job.results)) continue;
      try { job.scanConfigs = JSON.parse(await readFile(path.join(directory, `${job.id}.scan.json`), 'utf8')); }
      catch { job.scanConfigs = null; }
      job.title = String(job.title || '');
      job.tags = Array.isArray(job.tags) ? job.tags : [];
      job.favorite = Boolean(job.favorite);
      job.protocolIds = Array.isArray(job.protocolIds) ? job.protocolIds : null;
      for (const result of job.results) {
        if (result.ok && !result.outbound && result.uri) {
          const [config] = parseSubscription(result.uri);
          if (config) result.outbound = toPanelOutbound(config, result.name || config.name);
        }
      }
      if (Number(job.done) < Number(job.total) && Array.isArray(job.scanConfigs) && job.scanConfigs.length) {
        job.finished = false;
        job.interrupted = true;
      } else if (!job.finished) job.interrupted = true;
      jobs.set(job.id, job);
    } catch {}
  }
  return jobs;
}

export async function saveJob(directory, job) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (Array.isArray(job.scanConfigs) && job.scanConfigs.length) {
    const scanTarget = path.join(directory, job.id + '.scan.json');
    try { await stat(scanTarget); }
    catch {
      const scanTemporary = scanTarget + '.tmp';
      await writeFile(scanTemporary, JSON.stringify(job.scanConfigs), { mode: 0o600 });
      await chmod(scanTemporary, 0o600);
      await rename(scanTemporary, scanTarget);
    }
  }
  const target = path.join(directory, job.id + '.json');
  const temporary = target + '.tmp';
  const saved = {
    id: job.id, created: job.created,
    ...(job.title ? { title: String(job.title).slice(0, 80) } : {}),
    tags: Array.isArray(job.tags) ? [...new Set(job.tags.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 8).map((tag) => tag.slice(0, 24)) : [],
    favorite: Boolean(job.favorite),
    total: job.total, available: job.available, offset: job.offset,
    batchSize: job.batchSize || 10, checkExit: job.checkExit !== false,
    serviceIds: Array.isArray(job.serviceIds) ? job.serviceIds : ['gemini', 'youtube', 'instagram', 'telegram'],
    protocolIds: Array.isArray(job.protocolIds) ? job.protocolIds : undefined,
    ...(job.subscriptionUrl ? { subscriptionUrl: job.subscriptionUrl } : {}),
    done: job.done, success: job.success, finished: job.finished,
    interrupted: Boolean(job.interrupted), ...(job.message ? { message: job.message } : {}),
    ...(job.error ? { error: String(job.error).slice(0, 500) } : {}),
    results: job.results.filter((item) => item.ok),
  };
  await writeFile(temporary, JSON.stringify(saved), { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, target);
  const names = (await readdir(directory)).filter((name) => name.endsWith('.json') && !name.endsWith('.scan.json'));
  const files = await Promise.all(names.map(async (name) => ({ name, modified: (await stat(path.join(directory, name))).mtimeMs })));
  files.sort((a, b) => b.modified - a.modified);
  await Promise.all(files.slice(20).flatMap((item) => [
    unlink(path.join(directory, item.name)).catch(() => {}),
    unlink(path.join(directory, item.name.replace(/\.json$/, '.scan.json'))).catch(() => {}),
  ]));
}
