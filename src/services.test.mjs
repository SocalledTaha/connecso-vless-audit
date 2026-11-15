import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVICES, SERVICE_GROUPS, SERVICE_BY_ID } from './services.mjs';
import { interpretServiceHttpStatus } from './probe.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('service directory has unique IDs and each public HTTPS target belongs to a group', () => {
  assert.ok(SERVICES.length >= 60);
  assert.equal(SERVICE_BY_ID.size, SERVICES.length);
  const groups = new Set(SERVICE_GROUPS.map(({ id }) => id));
  for (const service of SERVICES) {
    assert.ok(groups.has(service.group), `${service.id} has a known group`);
    assert.equal(new URL(service.url).protocol, 'https:');
    assert.ok(service.host && service.name && service.icon, `${service.id} has complete metadata`);
  }
});

test('every service uses a local icon asset served by the panel', async () => {
  const icons = new Set();
  for (const { icon } of SERVICES) {
    assert.match(icon, /^[a-z0-9-]{1,48}$/);
    icons.add(icon);
  }
  await Promise.all([...icons].map((icon) => access(path.join(root, 'public', 'assets', 'services', `${icon}.svg`))));
});

test('HTTP destination errors are reported as reached, not tunnel failures', () => {
  assert.deepEqual(interpretServiceHttpStatus(200), { ok: true, reachable: true, state: 'ok' });
  assert.deepEqual(interpretServiceHttpStatus(302), { ok: true, reachable: true, state: 'ok' });
  assert.deepEqual(interpretServiceHttpStatus(403), { ok: false, reachable: true, state: 'http-error' });
  assert.deepEqual(interpretServiceHttpStatus(503), { ok: false, reachable: true, state: 'http-error' });
  assert.deepEqual(interpretServiceHttpStatus(0), { ok: false, reachable: false, state: 'route-error' });
});

test('support probes use canonical paths without appending a broken slash', () => {
  assert.equal(SERVICE_BY_ID.get('acer').url, 'https://www.acer.com/us-en/support/drivers-and-manuals');
  assert.equal(SERVICE_BY_ID.get('amd').url, 'https://www.amd.com/en/support/download/drivers.html');
  assert.equal(SERVICE_BY_ID.get('gmail').url, 'https://mail.google.com/mail');
});
