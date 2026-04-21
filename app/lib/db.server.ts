import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace('file:', '')
  : path.join(process.cwd(), 'data/mitrakost.db');

const globalForDb = globalThis as unknown as { db?: Database.Database };
export const db = globalForDb.db ?? new Database(dbPath);
if (process.env.NODE_ENV !== 'production') globalForDb.db = db;
