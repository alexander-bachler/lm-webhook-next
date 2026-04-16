import type Database from 'better-sqlite3';

/**
 * Shared DDL for the app SQLite database (single file: webhooks.sqlite).
 */
export function applySqliteSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      device_eui TEXT,
      payload_hex TEXT,
      fport INTEGER,
      decoded_data TEXT,
      raw_content TEXT NOT NULL,
      processing_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      line_metrics_sent INTEGER NOT NULL DEFAULT 0,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_webhooks_timestamp ON webhooks(timestamp);
    CREATE INDEX IF NOT EXISTS idx_webhooks_device_eui ON webhooks(device_eui);

    CREATE TABLE IF NOT EXISTS devices (
      device_id TEXT PRIMARY KEY,
      device_eui TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      decoder TEXT,
      manufacturer TEXT,
      model TEXT,
      image TEXT,
      tags TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      location TEXT,
      line_metrics_json TEXT,
      outputs_json TEXT,
      schedules_json TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_seen TEXT,
      data_count INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_devices_eui ON devices(device_eui);
    CREATE INDEX IF NOT EXISTS idx_devices_archived ON devices(archived);

    CREATE TABLE IF NOT EXISTS app_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dispatch_log (
      id TEXT PRIMARY KEY,
      webhook_id TEXT,
      device_id TEXT,
      adapter_id TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      sent_at TEXT NOT NULL,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_dispatch_webhook ON dispatch_log(webhook_id);

    CREATE TABLE IF NOT EXISTS job_runs (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL,
      device_id TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      message TEXT,
      rows_processed INTEGER DEFAULT 0,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_job_runs_started ON job_runs(started_at);

    CREATE TABLE IF NOT EXISTS webhook_tokens (
      id TEXT PRIMARY KEY,
      label TEXT,
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0
    );
  `);
}
