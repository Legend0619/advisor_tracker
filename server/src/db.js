import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from './config.js';
import { importDataset } from './importer.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS students (
  id            TEXT PRIMARY KEY,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT,
  major         TEXT,
  class_year    TEXT,
  credits       INTEGER,
  gpa           REAL,
  advisor       TEXT,
  risk_flag     TEXT,
  -- Kept only as a fallback; the app derives last contact from notes.
  csv_last_contact TEXT
);

CREATE TABLE IF NOT EXISTS notes (
  id            TEXT PRIMARY KEY,
  student_id    TEXT NOT NULL REFERENCES students(id),
  contact_date  TEXT NOT NULL,          -- ISO yyyy-mm-dd
  contact_type  TEXT NOT NULL,
  advisor       TEXT NOT NULL,
  text          TEXT NOT NULL,
  sensitive     INTEGER NOT NULL DEFAULT 0,
  follow_up_date TEXT,                  -- ISO, optional
  source        TEXT NOT NULL,          -- 'import' | 'app'
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS notes_student ON notes(student_id, contact_date);

-- Problems found while importing the CSVs, surfaced on the Data issues page.
CREATE TABLE IF NOT EXISTS data_issues (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,
  severity   TEXT NOT NULL,             -- 'info' | 'warning' | 'action'
  student_id TEXT,
  note_id    TEXT,
  detail     TEXT NOT NULL
);
`;

export function openDb(dbPath = DB_PATH) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM students').get();
  if (n === 0) {
    db.exec('BEGIN');
    try {
      importDataset(db);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
  return db;
}
