CREATE TABLE IF NOT EXISTS jobs (
  id VARCHAR(36) PRIMARY KEY,
  idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  payload VARCHAR(500) NOT NULL,
  created_at BIGINT NOT NULL,
  completed_at BIGINT,
  result VARCHAR(64),
  worker_id VARCHAR(100),
  processing_ms BIGINT
);
CREATE TABLE IF NOT EXISTS outbox (
  job_id VARCHAR(36) PRIMARY KEY REFERENCES jobs(id),
  published BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_jobs_completed ON jobs(completed_at);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox(published);
