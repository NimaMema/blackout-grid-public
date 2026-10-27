export const DEFAULT_CONTROL = Object.freeze({ rate: 3, paused: false, delayMs: 260, workers: 2, gatewayDown: false });

/** Deterministic, bounded browser model. It never claims to be a running Java service. */
export class Simulation {
  constructor(now = Date.now()) {
    this.now = now; this.started = now; this.control = { ...DEFAULT_CONTROL };
    this.jobs = []; this.queue = []; this.active = []; this.events = []; this.series = [];
    this.keys = new Map(); this.sequence = 0; this.eventSequence = 0;
    this.submitted = 0; this.completed = 0; this.attempts = 0; this.rejected = 0;
    this.credit = 0; this.sampleClock = 0; this.previousSubmitted = 0; this.previousCompleted = 0;
    this.latencies = [];
    this.event('system', 'Browser sandbox initialized. All activity stays in this tab.');
  }
  event(type, message, jobId = null) {
    this.events.unshift({ id: ++this.eventSequence, type, message, at: this.now, jobId });
    this.events.length = Math.min(80, this.events.length);
  }
  configure(patch) {
    const next = { ...this.control, ...patch };
    if (!Number.isInteger(next.rate) || next.rate < 0 || next.rate > 30 ||
        !Number.isInteger(next.workers) || next.workers < 1 || next.workers > 6 ||
        !Number.isFinite(next.delayMs) || next.delayMs < 120 || next.delayMs > 3000 ||
        typeof next.paused !== 'boolean' || typeof next.gatewayDown !== 'boolean') throw new Error('Invalid control settings.');
    const old = this.control;
    this.control = next;
    if (old.paused !== next.paused) this.event(next.paused ? 'outage' : 'recovered', next.paused ? 'Worker consumers stopped. New jobs will queue.' : 'Workers resumed. Backlog is draining.');
    if (old.gatewayDown !== next.gatewayDown) this.event(next.gatewayDown ? 'outage' : 'recovered', next.gatewayDown ? 'Gateway offline. Job submissions return 503.' : 'Gateway restored. Requests accepted.');
    if (old.rate !== next.rate) this.event('control', 'Traffic set to ' + next.rate + ' requests/sec.');
    if (old.delayMs !== next.delayMs) this.event('control', 'Worker delay set to ' + next.delayMs + 'ms.');
    if (old.workers !== next.workers) this.event('control', 'Worker concurrency set to ' + next.workers + '.');
  }
  submit(key = 'auto-' + (++this.sequence)) {
    this.attempts++;
    if (this.control.gatewayDown || this.submitted - this.completed >= 10000) {
      this.rejected++; return { accepted: false, status: 503 };
    }
    if (this.keys.has(key)) return { accepted: true, id: this.keys.get(key), duplicate: true };
    const id = 'sim-' + this.attempts.toString(16).padStart(8, '0');
    const job = { id, createdAt: this.now, completedAt: null, status: 'QUEUED', processingMs: 0, latencyMs: 0, result: null };
    this.keys.set(key, id);
    if (this.keys.size > 12000) this.keys.delete(this.keys.keys().next().value);
    this.jobs.unshift(job); this.queue.push(job); this.submitted++;
    this.event('accepted', 'Request accepted → durable outbox', id);
    return { accepted: true, id, duplicate: false };
  }
  advance(ms) {
    if (ms < 0 || !Number.isFinite(ms)) throw new Error('Time must move forward.');
    // Small steps preserve the same scheduling behaviour when tests or frame rates vary.
    let remaining = ms;
    while (remaining > 0) {
      const step = Math.min(50, remaining); remaining -= step; this.now += step;
      this.credit += this.control.rate * step / 1000;
      while (this.credit >= 1) { this.credit -= 1; this.submit(); }
      const pending = [];
      for (const job of this.active) {
        if (job.finishAt > this.now) { pending.push(job); continue; }
        job.status = 'COMPLETED'; job.completedAt = this.now;
        job.latencyMs = this.now - job.createdAt; job.processingMs = job.finishAt - job.startedAt;
        job.workerId = 'browser-model'; job.result = 'Simulated result — run Java mode for SHA-256 output';
        this.completed++; this.latencies.push(job.latencyMs);
        if (this.latencies.length > 100) this.latencies.shift();
        this.event('completed', 'Job committed → acknowledgement allowed', job.id);
      }
      this.active = pending;
      if (!this.control.paused) {
        while (this.active.length < this.control.workers && this.queue.length) {
          const job = this.queue.shift(); job.status = 'PROCESSING'; job.startedAt = this.now;
          job.finishAt = this.now + this.control.delayMs; this.active.push(job);
        }
      }
      this.sampleClock += step;
      if (this.sampleClock >= 1000) {
        this.sampleClock -= 1000;
        this.series.push({ rps: this.submitted - this.previousSubmitted, cps: this.completed - this.previousCompleted,
          queue: this.submitted - this.completed, latency: this.p95(), success: this.success() });
        this.series = this.series.slice(-60);
        this.previousSubmitted = this.submitted; this.previousCompleted = this.completed;
        // Keep pending jobs and only the most recent completed jobs.
        if (this.jobs.length > 300) {
          let done = 0; this.jobs = this.jobs.filter(j => j.status !== 'COMPLETED' || ++done <= 150);
        }
      }
    }
  }
  p95() {
    if (!this.latencies.length) return 0;
    const values = [...this.latencies].sort((a, b) => a - b);
    return values[Math.ceil(values.length * .95) - 1];
  }
  success() { return this.attempts ? (this.attempts - this.rejected) / this.attempts * 100 : 100; }
  snapshot() {
    const last = this.series.at(-1) || { rps: 0, cps: 0 };
    return { product: 'BLACKOUT', mode: 'simulation', generatedAt: this.now, uptimeSec: (this.now - this.started) / 1000,
      control: { ...this.control },
      services: { gateway: this.control.gatewayDown ? 'offline' : 'online', queue: 'online',
        workers: this.control.paused ? 'offline' : this.control.delayMs > 800 ? 'degraded' : 'online', database: 'online' },
      metrics: { submitted: this.submitted, completed: this.completed, backlog: this.submitted - this.completed,
        requestsPerSecond: last.rps, completionsPerSecond: last.cps, p95LatencyMs: this.p95(),
        successRate: this.success(), activeWorkers: this.active.length, outbox: 0 },
      series: this.series.map(x => ({ ...x })), events: this.events.map(x => ({ ...x })),
      jobs: this.jobs.slice(0, 40).map(x => ({ ...x })) };
  }
}
