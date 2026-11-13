import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

const dataDir = process.env.AI_TASK_HUB_DATA_DIR ?? join(homedir(), '.ai-task-hub');
mkdirSync(dataDir, { recursive: true });

export const dbPath = join(dataDir, 'data.db');

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

export function runMigrations(): void {
  migrate(db, { migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url)) });
}