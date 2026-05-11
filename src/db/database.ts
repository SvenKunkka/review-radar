import Database from 'better-sqlite3'
import { createSchema } from './schema'

let db: Database.Database | null = null

export function initDb(dbPath: string): Database.Database {
  const instance = new Database(dbPath)
  // WAL mode improves concurrent read performance and write safety
  instance.pragma('journal_mode = WAL')
  createSchema(instance)
  db = instance
  return instance
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}
