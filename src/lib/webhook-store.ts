import { randomUUID } from 'crypto';
import { getAppDatabase, closeAppDatabase } from './app-db';

export type ProcessingStatus = 'ok' | 'partial' | 'error';

export interface StoredWebhookRow {
  id: string;
  timestamp: string;
  device_eui: string;
  payload_hex: string | null;
  fport: number | null;
  decoded_data: Record<string, unknown> | null;
  raw_content: Record<string, unknown>;
  processing_status: ProcessingStatus;
  created_at: string;
  line_metrics_sent: number;
  metadata?: Record<string, unknown> | null;
}

export interface WebhookQueryOptions {
  limit?: number;
  startDate?: string;
  endDate?: string;
  deviceId?: string;
  deviceEui?: string;
}

function getDb() {
  return getAppDatabase();
}

export function closeWebhookDb(): void {
  closeAppDatabase();
}

/** Lightweight DB connectivity check for /api/health */
export function pingWebhookDb(): boolean {
  try {
    const db = getDb();
    db.prepare('SELECT 1').get();
    return true;
  } catch {
    return false;
  }
}

export interface StoreWebhookInput {
  id?: string;
  timestamp: string;
  deviceEui: string;
  payloadHex: string | null;
  fPort: number | null;
  decodedData: Record<string, unknown> | null;
  rawContent: Record<string, unknown>;
  processingStatus: ProcessingStatus;
  lineMetricsSent?: boolean;
  metadata?: Record<string, unknown> | null;
}

export function storeWebhook(input: StoreWebhookInput): string {
  const db = getDb();
  const id = input.id ?? randomUUID();
  const createdAt = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO webhooks (
      id, timestamp, device_eui, payload_hex, fport, decoded_data, raw_content,
      processing_status, created_at, line_metrics_sent, metadata
    ) VALUES (
      @id, @timestamp, @device_eui, @payload_hex, @fport, @decoded_data, @raw_content,
      @processing_status, @created_at, @line_metrics_sent, @metadata
    )
  `);
  stmt.run({
    id,
    timestamp: input.timestamp,
    device_eui: input.deviceEui,
    payload_hex: input.payloadHex,
    fport: input.fPort,
    decoded_data: input.decodedData ? JSON.stringify(input.decodedData) : null,
    raw_content: JSON.stringify(input.rawContent),
    processing_status: input.processingStatus,
    created_at: createdAt,
    line_metrics_sent: input.lineMetricsSent ? 1 : 0,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
  return id;
}

function parseRow(row: Record<string, unknown>): StoredWebhookRow {
  return {
    id: String(row.id),
    timestamp: String(row.timestamp),
    device_eui: String(row.device_eui ?? ''),
    payload_hex: row.payload_hex != null ? String(row.payload_hex) : null,
    fport: row.fport != null ? Number(row.fport) : null,
    decoded_data: row.decoded_data
      ? (JSON.parse(String(row.decoded_data)) as Record<string, unknown>)
      : null,
    raw_content: JSON.parse(String(row.raw_content)) as Record<string, unknown>,
    processing_status: row.processing_status as ProcessingStatus,
    created_at: String(row.created_at),
    line_metrics_sent: Number(row.line_metrics_sent ?? 0),
    metadata: row.metadata
      ? (JSON.parse(String(row.metadata)) as Record<string, unknown>)
      : null,
  };
}

export function queryWebhooks(options: WebhookQueryOptions = {}): StoredWebhookRow[] {
  const db = getDb();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  const conditions: string[] = [];
  const params: Record<string, string | number> = { limit };

  if (options.startDate && options.endDate) {
    conditions.push('timestamp >= @startDate AND timestamp <= @endDate');
    params.startDate = options.startDate;
    params.endDate = options.endDate;
  }
  if (options.deviceEui) {
    conditions.push('(device_eui = @deviceEui OR lower(device_eui) = lower(@deviceEui))');
    params.deviceEui = options.deviceEui;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT * FROM webhooks
    ${where}
    ORDER BY datetime(timestamp) DESC
    LIMIT @limit
  `;
  const stmt = db.prepare(sql);
  const rows = stmt.all(params) as Record<string, unknown>[];
  let result = rows.map(parseRow);

  if (options.deviceId && options.deviceId !== 'all') {
    result = result.filter((w) => {
      const meta = w.metadata as Record<string, unknown> | null | undefined;
      const name =
        meta && typeof meta.deviceDisplayName === 'string'
          ? meta.deviceDisplayName
          : w.device_eui;
      return name === options.deviceId || w.device_eui === options.deviceId;
    });
  }

  return result;
}

export function getLatestWebhookForEui(deviceEui: string): StoredWebhookRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM webhooks WHERE device_eui = ? OR lower(device_eui) = lower(?) ORDER BY datetime(timestamp) DESC LIMIT 1`
    )
    .get(deviceEui, deviceEui) as Record<string, unknown> | undefined;
  return row ? parseRow(row) : null;
}

export function listWebhooksPendingDispatch(limit = 50): StoredWebhookRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM webhooks WHERE line_metrics_sent = 0 AND processing_status IN ('ok','partial') ORDER BY datetime(timestamp) DESC LIMIT ?`
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map(parseRow);
}

export function updateWebhookLineMetricsSent(id: string, sent: boolean): void {
  const db = getDb();
  db.prepare('UPDATE webhooks SET line_metrics_sent = ? WHERE id = ?').run(sent ? 1 : 0, id);
}

export function queryWebhooksInWindow(
  deviceEui: string,
  startIso: string,
  endIso: string
): StoredWebhookRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM webhooks WHERE device_eui = ? AND datetime(timestamp) >= datetime(?) AND datetime(timestamp) <= datetime(?) ORDER BY datetime(timestamp) ASC`
    )
    .all(deviceEui, startIso, endIso) as Record<string, unknown>[];
  return rows.map(parseRow);
}

export function getWebhookStatsFromDb(): {
  totalWebhooks: number;
  activeDevices: number;
  successRate: number;
  avgProcessingTime: number;
  todayWebhooks: number;
  weeklyGrowth: number;
} {
  const db = getDb();
  const total = (
    db.prepare('SELECT COUNT(*) as c FROM webhooks').get() as { c: number }
  ).c;
  const devices = (
    db.prepare('SELECT COUNT(DISTINCT device_eui) as c FROM webhooks WHERE device_eui != ""').get() as {
      c: number;
    }
  ).c;
  const ok = (
    db.prepare("SELECT COUNT(*) as c FROM webhooks WHERE processing_status = 'ok'").get() as {
      c: number;
    }
  ).c;
  const successRate = total > 0 ? Math.round((ok / total) * 1000) / 10 : 0;

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const todayWebhooks = (
    db
      .prepare('SELECT COUNT(*) as c FROM webhooks WHERE datetime(timestamp) >= datetime(?)')
      .get(oneDayAgo) as { c: number }
  ).c;

  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const thisWeek = (
    db
      .prepare('SELECT COUNT(*) as c FROM webhooks WHERE datetime(timestamp) >= datetime(?)')
      .get(oneWeekAgo) as { c: number }
  ).c;
  const lastWeek = (
    db
      .prepare(
        'SELECT COUNT(*) as c FROM webhooks WHERE datetime(timestamp) >= datetime(?) AND datetime(timestamp) < datetime(?)'
      )
      .get(twoWeeksAgo, oneWeekAgo) as { c: number }
  ).c;
  const weeklyGrowth =
    lastWeek > 0
      ? Math.round(((thisWeek - lastWeek) / lastWeek) * 1000) / 10
      : thisWeek > 0
        ? 100
        : 0;

  return {
    totalWebhooks: total,
    activeDevices: devices,
    successRate,
    avgProcessingTime: total > 0 ? 120 : 0,
    todayWebhooks,
    weeklyGrowth,
  };
}
