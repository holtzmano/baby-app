// src/db/db.ts
import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

let _dbPromise: Promise<SQLiteDatabase> | null = null;

/** Lazily open the database once and reuse it. */
export function getDb(): Promise<SQLiteDatabase> {
  if (!_dbPromise) {
    _dbPromise = SQLite.openDatabaseAsync('baby.db');
  }
  return _dbPromise;
}

/** Create tables / indexes. Call once at app start. */
export async function migrate(): Promise<void> {
  const db = await getDb();

  // WAL for better durability/perf
  await db.execAsync('PRAGMA journal_mode=WAL;');

  // Schema
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      baby_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('sleep','wake','feed','diaper','note')),
      ts_ms INTEGER NOT NULL,
      -- JSON-encoded metadata for the event (e.g., additional event details)
      meta TEXT,
      pending_sync INTEGER NOT NULL DEFAULT 1,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    );
  `);

  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS idx_events_baby_ts ON events (baby_id, ts_ms DESC);'
  );
}
