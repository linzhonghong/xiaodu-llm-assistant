import Database from 'better-sqlite3';
import { dirname } from 'node:path';
import { accessSync, constants, mkdirSync, statSync } from 'node:fs';

export type AppDatabase = Database.Database;

function describeDirectory(path: string): string {
  try {
    const stat = statSync(path);
    let writable = false;
    try {
      accessSync(path, constants.W_OK);
      writable = true;
    } catch {
      writable = false;
    }
    return JSON.stringify({
      path,
      exists: true,
      isDirectory: stat.isDirectory(),
      mode: `0${(stat.mode & 0o777).toString(8)}`,
      uid: stat.uid,
      gid: stat.gid,
      writable
    });
  } catch (error) {
    return JSON.stringify({
      path,
      exists: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export function createDb(dbPath: string): AppDatabase {
  const dbDir = dirname(dbPath);
  mkdirSync(dbDir, { recursive: true });
  console.log(`Opening SQLite database at ${dbPath}; directory=${describeDirectory(dbDir)}`);
  let db: Database.Database;
  try {
    db = new Database(dbPath);
  } catch (error) {
    throw new Error(
      `Unable to open SQLite database at ${dbPath}; directory=${describeDirectory(dbDir)}; original=${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
  }
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_key TEXT NOT NULL,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_key, id);

    CREATE TABLE IF NOT EXISTS pending_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_key TEXT NOT NULL,
      session_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pending_user_expires ON pending_confirmations(user_key, expires_at);
  `);
  return db;
}
