import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';

test('healthy workers process actual queued jobs', () => {
  const sim = new Simulation(0); sim.advance(5000);
  const { metrics: m } = sim.snapshot();
  assert.ok(m.submitted >= 14); assert.ok(m.completed >= 12);
  assert.equal(m.backlog, m.submitted - m.completed);
  assert.equal(m.successRate, 100);
});
test('worker outage retains accepted jobs and recovery drains them', () => {
  const sim = new Simulation(0);
  sim.configure({ paused: true, rate: 12 }); sim.advance(5000);
  const failed = sim.snapshot();
  assert.equal(failed.metrics.completed, 0); assert.ok(failed.metrics.backlog >= 59);
  sim.configure({ paused: false, rate: 0, workers: 6 }); sim.advance(6000);
  const recovered = sim.snapshot();
  assert.equal(recovered.metrics.backlog, 0);
  assert.equal(recovered.metrics.completed, failed.metrics.submitted);
});
test('gateway outage rejects jobs instead of pretending to queue them', () => {
  const sim = new Simulation(0); sim.configure({ gatewayDown: true, rate: 10 }); sim.advance(2000);
  assert.equal(sim.snapshot().metrics.submitted, 0);
  assert.equal(sim.snapshot().metrics.successRate, 0);
  assert.equal(sim.submit('manual').status, 503);
});
test('idempotent submission does not create duplicate work', () => {
  const sim = new Simulation(0); sim.configure({ rate: 0 });
  const first = sim.submit('one'); const second = sim.submit('one');
  assert.equal(first.id, second.id); assert.equal(second.duplicate, true);
  sim.advance(1000); assert.equal(sim.snapshot().metrics.completed, 1);
});
test('slower workers build backlog and latency includes waiting', () => {
  const sim = new Simulation(0); sim.configure({ delayMs: 1600, rate: 8, workers: 1 }); sim.advance(10000);
  assert.ok(sim.snapshot().metrics.backlog > 60);
  assert.ok(sim.snapshot().metrics.p95LatencyMs > 1600);
});
test('invalid controls and backwards time are rejected', () => {
  const sim = new Simulation(0);
  for (const patch of [{ rate: -1 }, { rate: 31 }, { workers: 0 }, { workers: 7 }, { delayMs: 1 }, { paused: 'yes' }])
    assert.throws(() => sim.configure(patch));
  assert.throws(() => sim.advance(-1));
});
test('history is bounded without discarding pending jobs', () => {
  const sim = new Simulation(0); sim.configure({ rate: 30, workers: 6, delayMs: 120 }); sim.advance(120000);
  const s = sim.snapshot();
  assert.equal(s.series.length, 60); assert.ok(s.events.length <= 80); assert.ok(s.jobs.length <= 40);
  assert.equal(s.metrics.submitted - s.metrics.completed, s.metrics.backlog);
});
