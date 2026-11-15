import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVICES, SERVICE_GROUPS, SERVICE_BY_ID } from './services.mjs';

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
