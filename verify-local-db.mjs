import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve('local.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('DB open error:', err.message);
    process.exit(1);
  }
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
    )
  `, (err) => {
    if (err) {
      console.error('CREATE TABLE error:', err.message);
      db.close();
      process.exit(1);
    }

    db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (queryErr, rows) => {
      if (queryErr) {
        console.error('QUERY error:', queryErr.message);
        db.close();
        process.exit(1);
      }

      console.log('tables:', JSON.stringify(rows));
      db.close();
    });
  });
});
