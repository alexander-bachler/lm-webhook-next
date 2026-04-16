import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/** Isolated SQLite path for tests so better-sqlite3 singleton sees a fresh DB. */
const dir = mkdtempSync(path.join(tmpdir(), 'lm-webhook-vitest-'));
process.env.DATA_DIR = dir;
