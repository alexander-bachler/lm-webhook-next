import { randomUUID } from 'crypto';
import { getAppDatabase } from './app-db';

export function insertJobRun(input: {
  jobType: string;
  deviceId?: string;
  status: string;
  message?: string;
  rowsProcessed?: number;
  metadata?: Record<string, unknown>;
}): string {
  const db = getAppDatabase();
  const id = randomUUID();
  const startedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO job_runs (id, job_type, device_id, started_at, finished_at, status, message, rows_processed, metadata)
     VALUES (@id, @job_type, @device_id, @started_at, @finished_at, @status, @message, @rows_processed, @metadata)`
  ).run({
    id,
    job_type: input.jobType,
    device_id: input.deviceId ?? null,
    started_at: startedAt,
    finished_at: startedAt,
    status: input.status,
    message: input.message ?? null,
    rows_processed: input.rowsProcessed ?? 0,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
  return id;
}

export function listRecentJobRuns(limit = 100): Record<string, unknown>[] {
  const db = getAppDatabase();
  return db
    .prepare(
      `SELECT * FROM job_runs ORDER BY datetime(started_at) DESC LIMIT ?`
    )
    .all(limit) as Record<string, unknown>[];
}
