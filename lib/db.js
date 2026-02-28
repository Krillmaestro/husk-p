const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'tracker.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initDb(db);
  }
  return db;
}

function initDb(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS apartments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      addr TEXT NOT NULL,
      area TEXT DEFAULT '',
      price INTEGER,
      sqm REAL,
      rooms INTEGER,
      floor TEXT,
      fee INTEGER,
      hiss INTEGER DEFAULT 0,
      status TEXT DEFAULT 'intressant',
      prissankt INTEGER DEFAULT 0,
      note TEXT DEFAULT '',
      url TEXT DEFAULT '',
      contacted INTEGER DEFAULT 0,
      user_notes TEXT DEFAULT '',
      hidden INTEGER DEFAULT 0,
      visning_date TEXT,
      visning_time TEXT,
      visning_intryck TEXT DEFAULT '',
      favorit INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apartment_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE
    );
  `);

  // Migration: add columns if they don't exist (safe for existing DBs)
  const cols = db.prepare("PRAGMA table_info(apartments)").all().map(c => c.name);
  const migrations = [
    ['area', "ALTER TABLE apartments ADD COLUMN area TEXT DEFAULT ''"],
    ['visning_date', "ALTER TABLE apartments ADD COLUMN visning_date TEXT"],
    ['visning_time', "ALTER TABLE apartments ADD COLUMN visning_time TEXT"],
    ['visning_intryck', "ALTER TABLE apartments ADD COLUMN visning_intryck TEXT DEFAULT ''"],
    ['favorit', "ALTER TABLE apartments ADD COLUMN favorit INTEGER DEFAULT 0"],
  ];
  for (const [col, sql] of migrations) {
    if (!cols.includes(col)) {
      try { db.exec(sql); } catch (e) { /* column already exists */ }
    }
  }
}

// --- Query helpers ---

function getAllApartments() {
  return getDb().prepare('SELECT * FROM apartments WHERE hidden = 0 ORDER BY favorit DESC, created_at DESC').all();
}

function getApartment(id) {
  return getDb().prepare('SELECT * FROM apartments WHERE id = ?').get(id);
}

function createApartment(fields) {
  const {
    addr, area = '', price = null, sqm = null, rooms = null, floor = '',
    fee = null, hiss = 0, status = 'intressant', note = '', url = '',
  } = fields;

  const result = getDb().prepare(`
    INSERT INTO apartments (addr, area, price, sqm, rooms, floor, fee, hiss, status, note, url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(addr, area, price, sqm, rooms, floor, fee, hiss, status, note, url);

  getDb().prepare(
    'INSERT INTO activity_log (apartment_id, action, detail) VALUES (?, ?, ?)'
  ).run(result.lastInsertRowid, 'created', JSON.stringify({ addr }));

  return getApartment(result.lastInsertRowid);
}

function updateApartment(id, fields) {
  const allowed = [
    'addr', 'area', 'price', 'sqm', 'rooms', 'floor', 'fee', 'hiss',
    'status', 'prissankt', 'note', 'url', 'contacted', 'user_notes',
    'hidden', 'visning_date', 'visning_time', 'visning_intryck', 'favorit',
  ];
  const updates = [];
  const values = {};

  for (const [key, val] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      updates.push(`${key} = @${key}`);
      values[key] = val;
    }
  }

  if (updates.length === 0) return null;

  values.id = id;
  updates.push("updated_at = datetime('now')");

  const sql = `UPDATE apartments SET ${updates.join(', ')} WHERE id = @id`;
  getDb().prepare(sql).run(values);

  getDb().prepare(
    'INSERT INTO activity_log (apartment_id, action, detail) VALUES (?, ?, ?)'
  ).run(id, 'update', JSON.stringify(fields));

  return getApartment(id);
}

function deleteApartment(id) {
  getDb().prepare('DELETE FROM activity_log WHERE apartment_id = ?').run(id);
  const result = getDb().prepare('DELETE FROM apartments WHERE id = ?').run(id);
  return result.changes > 0;
}

function getActivityLog(apartmentId) {
  if (apartmentId) {
    return getDb().prepare(
      'SELECT * FROM activity_log WHERE apartment_id = ? ORDER BY created_at DESC LIMIT 50'
    ).all(apartmentId);
  }
  return getDb().prepare(
    'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 100'
  ).all();
}

module.exports = { getDb, getAllApartments, getApartment, createApartment, updateApartment, deleteApartment, getActivityLog };
