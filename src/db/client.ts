import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function openDatabase(absPath: string): Promise<Database> {
  await closeDatabase();
  const conn = await Database.load(`sqlite:${absPath}`);
  // The folder is synced by Google Drive: keep everything in a single .db file (no -wal/-shm).
  await conn.execute("PRAGMA journal_mode = DELETE");
  await conn.execute("PRAGMA foreign_keys = ON");
  db = conn;
  return conn;
}

export async function closeDatabase(): Promise<void> {
  if (!db) return;
  const conn = db;
  db = null;
  try {
    await conn.close();
  } catch (e) {
    console.warn("Failed to close database", e);
  }
}

export function getDb(): Database {
  if (!db) throw new Error("The database is not open. Pick a data folder first.");
  return db;
}

export function select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return getDb().select<T[]>(sql, params);
}

export async function execute(sql: string, params: unknown[] = []): Promise<number> {
  const res = await getDb().execute(sql, params);
  return res.rowsAffected;
}
