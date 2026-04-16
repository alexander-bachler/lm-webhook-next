import Database from 'better-sqlite3';
import { getWebhookDbPath } from './data-paths.js';
import { applySqliteSchema } from './sqlite-schema';

let dbInstance: Database.Database | null = null;

/**
 * Single shared SQLite connection for webhooks, devices, jobs, dispatch log.
 */
export function getAppDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }
  const file = getWebhookDbPath();
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  applySqliteSchema(db);
  dbInstance = db;
  return db;
}

export function closeAppDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
