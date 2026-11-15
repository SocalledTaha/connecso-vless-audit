import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateXrayWorkerPlan } from './probe.mjs';

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

test('worker plan uses spare RAM on a typical 1.87 GiB VPS instead of pinning it to one worker', () => {
  const plan = calculateXrayWorkerPlan(790 * MiB, 1.87 * GiB);
  assert.equal(plan.count, 3);
  assert.equal(plan.reserveMiB, 320);
  assert.equal(plan.workerBudgetMiB, 128);
});

test('worker plan stays at one worker when the host is under memory pressure', () => {
  const plan = calculateXrayWorkerPlan(100 * MiB, 961 * MiB);
  assert.equal(plan.count, 1);
});

test('worker plan never exceeds the supported three independent Xray processes', () => {
  const plan = calculateXrayWorkerPlan(8 * GiB, 16 * GiB);
  assert.equal(plan.count, 3);
});
