import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.join(__dirname, '..', 'funnel.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDatabase() {
  const database = getDatabase();
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS funnels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS funnel_steps (
      id TEXT PRIMARY KEY,
      funnel_id TEXT NOT NULL,
      name TEXT NOT NULL,
      event_name TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      FOREIGN KEY (funnel_id) REFERENCES funnels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      event_time TEXT NOT NULL,
      properties TEXT
    );

    CREATE TABLE IF NOT EXISTS user_attributes (
      user_id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      city TEXT NOT NULL,
      register_date TEXT NOT NULL,
      user_level TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      funnel_id TEXT NOT NULL,
      funnel_name TEXT NOT NULL,
      description TEXT,
      analysis_data TEXT NOT NULL,
      share_token TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      FOREIGN KEY (funnel_id) REFERENCES funnels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS monitor_rules (
      id TEXT PRIMARY KEY,
      funnel_id TEXT NOT NULL,
      funnel_name TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      step_name TEXT NOT NULL,
      threshold REAL NOT NULL,
      frequency TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      notify_emails TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (funnel_id) REFERENCES funnels(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_event_logs_user ON event_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_event_logs_event ON event_logs(event_name);
    CREATE INDEX IF NOT EXISTS idx_event_logs_time ON event_logs(event_time);
    CREATE INDEX IF NOT EXISTS idx_funnel_steps_funnel ON funnel_steps(funnel_id);
  `);
}

export default getDatabase;
