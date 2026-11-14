import { mkdir, readFile, readdir, rename, chmod, writeFile, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseSubscription, toPanelOutbound } from './vless.mjs';

export async function loadJobs(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const names = (await readdir(directory)).filter((name) => name.endsWith('.json'));
  const files = await Promise.all(names.map(async (name) => ({
    name,
    modified: (await stat(path.join(directory, name))).mtimeMs,
  })));
  files.sort((a, b) => b.modified - a.modified);
  const jobs = new Map();
  for (const file of files.slice(0, 20)) {
    try {
      const job = JSON.parse(await readFile(path.join(directory, file.name), 'utf8'));
      if (!job.id || !Array.isArray(job.results)) continue;
      for (const result of job.results) {
        if (result.ok && !result.outbound && result.uri) {
          const [config] = parseSubscription(result.uri);
          if (config) result.outbound = toPanelOutbound(config, result.name || config.name);
        }
      }
      if (!job.finished) {
        job.finished = true;
        job.interrupted = true;
      }
      jobs.set(job.id, job);
    } catch {}
  }
  return jobs;
}

export async function saveJob(directory, job) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const target = path.join(directory, job.id + '.json');
  const temporary = target + '.tmp';
  const saved = {
    id: job.id,
    created: job.created,
    total: job.total,
    available: job.available,
    offset: job.offset,
    batchSize: job.batchSize || 10,
    checkExit: job.checkExit !== false,
    serviceIds: Array.isArray(job.serviceIds) ? job.serviceIds : ['gemini', 'youtube', 'instagram', 'telegram'],
    ...(job.subscriptionUrl ? { subscriptionUrl: job.subscriptionUrl } : {}),
    done: job.done,
    success: job.success,
    finished: job.finished,
    interrupted: Boolean(job.interrupted),
    ...(job.message ? { message: job.message } : {}),
    results: job.results.filter((item) => item.ok),
  };
  await writeFile(temporary, JSON.stringify(saved), { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, target);
  const names = (await readdir(directory)).filter((name) => name.endsWith('.json'));
  const files = await Promise.all(names.map(async (name) => ({
    name,
    modified: (await stat(path.join(directory, name))).mtimeMs,
  })));
  files.sort((a, b) => b.modified - a.modified);
  await Promise.all(files.slice(20).map((item) => unlink(path.join(directory, item.name)).catch(() => {})));
}
