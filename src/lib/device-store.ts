import fs from 'fs';
import path from 'path';
import { getAppDatabase } from './app-db';
import { getDataDir, getDevicesFilePath } from './data-paths.js';

export interface DeviceBundle {
  devices: Record<string, Record<string, unknown>>;
  decoders: Record<string, unknown>;
  lastUpdate: string | null;
}

function rowToDevice(row: Record<string, unknown>): Record<string, unknown> {
  const tags = row.tags ? (JSON.parse(String(row.tags)) as string[]) : [];
  const lineMetrics = row.line_metrics_json
    ? (JSON.parse(String(row.line_metrics_json)) as Record<string, unknown>)
    : { enabled: false, dataPoints: {} };
  const metadata = row.metadata_json
    ? (JSON.parse(String(row.metadata_json)) as Record<string, unknown>)
    : {};
  const outputs = row.outputs_json
    ? JSON.parse(String(row.outputs_json))
    : undefined;
  const schedules = row.schedules_json
    ? JSON.parse(String(row.schedules_json))
    : undefined;

  return {
    deviceId: String(row.device_id),
    deviceEUI: String(row.device_eui),
    name: String(row.name),
    description: row.description != null ? String(row.description) : '',
    decoder: row.decoder != null ? String(row.decoder) : 'auto',
    manufacturer: row.manufacturer != null ? String(row.manufacturer) : 'Unknown',
    model: row.model != null ? String(row.model) : 'Unknown',
    image: row.image != null ? String(row.image) : '/images/devices/default.svg',
    location: row.location != null ? String(row.location) : '',
    tags,
    active: Number(row.active) !== 0,
    archived: Number(row.archived) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastSeen: row.last_seen != null ? String(row.last_seen) : null,
    dataCount: row.data_count != null ? Number(row.data_count) : 0,
    metadata,
    lineMetrics,
    ...(outputs ? { outputs } : {}),
    ...(schedules ? { schedules } : {}),
  };
}

function deviceToRow(device: Record<string, unknown>): Record<string, unknown> {
  const deviceId = String(device.deviceId ?? '');
  const tags = Array.isArray(device.tags) ? JSON.stringify(device.tags) : '[]';
  return {
    device_id: deviceId,
    device_eui: String(device.deviceEUI ?? deviceId),
    name: String(device.name ?? deviceId),
    description: device.description != null ? String(device.description) : '',
    decoder: device.decoder != null ? String(device.decoder) : 'auto',
    manufacturer: device.manufacturer != null ? String(device.manufacturer) : 'Unknown',
    model: device.model != null ? String(device.model) : 'Unknown',
    image: device.image != null ? String(device.image) : '/images/devices/default.svg',
    tags,
    archived: device.archived === true ? 1 : 0,
    active: device.active === false ? 0 : 1,
    location: device.location != null ? String(device.location) : '',
    line_metrics_json: JSON.stringify(device.lineMetrics ?? { enabled: false, dataPoints: {} }),
    outputs_json: device.outputs != null ? JSON.stringify(device.outputs) : null,
    schedules_json: device.schedules != null ? JSON.stringify(device.schedules) : null,
    metadata_json: JSON.stringify(device.metadata ?? {}),
    created_at: String(device.createdAt ?? new Date().toISOString()),
    updated_at: String(device.updatedAt ?? new Date().toISOString()),
    last_seen: device.lastSeen != null ? String(device.lastSeen) : null,
    data_count: device.dataCount != null ? Number(device.dataCount) : 0,
  };
}

function migrateFromJsonFileIfNeeded(): void {
  const db = getAppDatabase();
  const count = (
    db.prepare('SELECT COUNT(*) as c FROM devices').get() as { c: number }
  ).c;
  if (count > 0) {
    return;
  }

  const legacyPath = getDevicesFilePath();
  if (!fs.existsSync(legacyPath)) {
    return;
  }

  try {
    const raw = fs.readFileSync(legacyPath, 'utf8');
    const parsed = JSON.parse(raw) as {
      devices?: Record<string, Record<string, unknown>>;
      decoders?: Record<string, unknown>;
      lastUpdate?: string | null;
    };

    const tx = db.transaction(() => {
      if (parsed.devices) {
        for (const dev of Object.values(parsed.devices)) {
          const row = deviceToRow(dev);
          db.prepare(
            `INSERT INTO devices (
              device_id, device_eui, name, description, decoder, manufacturer, model, image,
              tags, archived, active, location, line_metrics_json, outputs_json, schedules_json, metadata_json,
              created_at, updated_at, last_seen, data_count
            ) VALUES (
              @device_id, @device_eui, @name, @description, @decoder, @manufacturer, @model, @image,
              @tags, @archived, @active, @location, @line_metrics_json, @outputs_json, @schedules_json, @metadata_json,
              @created_at, @updated_at, @last_seen, @data_count
            )`
          ).run(row as Record<string, unknown>);
        }
      }
      if (parsed.decoders) {
        db.prepare('INSERT OR REPLACE INTO app_kv (key, value) VALUES (?, ?)').run(
          'decoders',
          JSON.stringify(parsed.decoders)
        );
      }
      if (parsed.lastUpdate) {
        db.prepare('INSERT OR REPLACE INTO app_kv (key, value) VALUES (?, ?)').run(
          'lastUpdate',
          String(parsed.lastUpdate)
        );
      }
    });
    tx();

    const migratedPath = path.join(getDataDir(), 'devices.json.migrated');
    fs.renameSync(legacyPath, migratedPath);
    console.info('[device-store] Migrated devices.json to SQLite; renamed to devices.json.migrated');
  } catch (e) {
    console.warn('[device-store] Migration from devices.json failed:', e);
  }
}

/**
 * Same shape as legacy DeviceManager JSON root.
 */
export function loadDeviceBundle(): DeviceBundle {
  migrateFromJsonFileIfNeeded();
  const db = getAppDatabase();

  const rows = db.prepare('SELECT * FROM devices').all() as Record<string, unknown>[];
  const devices: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    const d = rowToDevice(row);
    devices[String(d.deviceId)] = d;
  }

  let decoders: Record<string, unknown> = {};
  const decRow = db.prepare('SELECT value FROM app_kv WHERE key = ?').get('decoders') as
    | { value: string }
    | undefined;
  if (decRow?.value) {
    try {
      decoders = JSON.parse(decRow.value) as Record<string, unknown>;
    } catch {
      decoders = {};
    }
  }

  let lastUpdate: string | null = null;
  const luRow = db.prepare('SELECT value FROM app_kv WHERE key = ?').get('lastUpdate') as
    | { value: string }
    | undefined;
  if (luRow?.value) {
    lastUpdate = luRow.value;
  }

  return { devices, decoders, lastUpdate };
}

export function persistDeviceBundle(bundle: DeviceBundle): void {
  const db = getAppDatabase();
  const tx = db.transaction(() => {
    const ids = Object.keys(bundle.devices);
    const existing = db.prepare('SELECT device_id FROM devices').all() as { device_id: string }[];
    for (const r of existing) {
      if (!ids.includes(r.device_id)) {
        db.prepare('DELETE FROM devices WHERE device_id = ?').run(r.device_id);
      }
    }
    const upsert = db.prepare(
      `INSERT INTO devices (
        device_id, device_eui, name, description, decoder, manufacturer, model, image,
        tags, archived, active, location, line_metrics_json, outputs_json, schedules_json, metadata_json,
        created_at, updated_at, last_seen, data_count
      ) VALUES (
        @device_id, @device_eui, @name, @description, @decoder, @manufacturer, @model, @image,
        @tags, @archived, @active, @location, @line_metrics_json, @outputs_json, @schedules_json, @metadata_json,
        @created_at, @updated_at, @last_seen, @data_count
      )
      ON CONFLICT(device_id) DO UPDATE SET
        device_eui = excluded.device_eui,
        name = excluded.name,
        description = excluded.description,
        decoder = excluded.decoder,
        manufacturer = excluded.manufacturer,
        model = excluded.model,
        image = excluded.image,
        tags = excluded.tags,
        archived = excluded.archived,
        active = excluded.active,
        location = excluded.location,
        line_metrics_json = excluded.line_metrics_json,
        outputs_json = excluded.outputs_json,
        schedules_json = excluded.schedules_json,
        metadata_json = excluded.metadata_json,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        last_seen = excluded.last_seen,
        data_count = excluded.data_count`
    );

    for (const dev of Object.values(bundle.devices)) {
      const row = deviceToRow(dev);
      upsert.run(row);
    }

    db.prepare('INSERT OR REPLACE INTO app_kv (key, value) VALUES (?, ?)').run(
      'decoders',
      JSON.stringify(bundle.decoders ?? {})
    );
    db.prepare('INSERT OR REPLACE INTO app_kv (key, value) VALUES (?, ?)').run(
      'lastUpdate',
      bundle.lastUpdate ?? new Date().toISOString()
    );
  });
  tx();
}

export function listDevicesForApi(includeArchived: boolean): Record<string, unknown>[] {
  migrateFromJsonFileIfNeeded();
  const db = getAppDatabase();
  const sql = includeArchived
    ? 'SELECT * FROM devices ORDER BY datetime(updated_at) DESC'
    : 'SELECT * FROM devices WHERE archived = 0 ORDER BY datetime(updated_at) DESC';
  const rows = db.prepare(sql).all() as Record<string, unknown>[];
  return rows.map((row) => rowToDevice(row));
}
