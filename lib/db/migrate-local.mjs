import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../local.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      customer_name TEXT,
      phone_number TEXT,
      item_name TEXT,
      quantity INTEGER,
      amount INTEGER,
      due_date TEXT,
      notes TEXT,
      raw_parsed TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `, (err) => {
    if (err) {
      console.error('Migration error:', err.message);
      db.close();
      process.exit(1);
    }
    console.log('✅ Local SQLite database created at', dbPath);
    db.close();
  });
});

