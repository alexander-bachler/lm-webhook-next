import { randomUUID } from 'crypto';
import { getAppDatabase } from './app-db';

export function insertDispatchLog(input: {
  webhookId: string;
  deviceId: string;
  adapterId: string;
  status: 'ok' | 'error';
  error?: string;
  metadata?: Record<string, unknown>;
}): void {
  const db = getAppDatabase();
  const id = randomUUID();
  const sentAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO dispatch_log (id, webhook_id, device_id, adapter_id, status, error, sent_at, metadata)
     VALUES (@id, @webhook_id, @device_id, @adapter_id, @status, @error, @sent_at, @metadata)`
  ).run({
    id,
    webhook_id: input.webhookId,
    device_id: input.deviceId,
    adapter_id: input.adapterId,
    status: input.status,
    error: input.error ?? null,
    sent_at: sentAt,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}
