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
      id INTEGER PRIMARY KEY,
      addr TEXT NOT NULL,
      price INTEGER,
      sqm REAL NOT NULL,
      rooms INTEGER NOT NULL,
      floor TEXT,
      fee INTEGER,
      hiss INTEGER,
      status TEXT DEFAULT 'active',
      prissankt INTEGER DEFAULT 0,
      note TEXT,
      url TEXT,
      contacted INTEGER DEFAULT 0,
      user_notes TEXT DEFAULT '',
      hidden INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apartment_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (apartment_id) REFERENCES apartments(id)
    );
  `);

  // Seed if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM apartments').get();
  if (count.c === 0) {
    seedApartments(db);
  }
}

function seedApartments(db) {
  const apartments = [
    { id: 1, addr: "Eskadervägen 46, 3r 85 kvm", price: null, sqm: 85, rooms: 3, floor: "3", fee: 4803, hiss: 1, status: "active", prissankt: 0, note: "Totalrenoverad 2024! Walk-in-closet, köksö, stambytt bad. Brf Torpedbåten 3.", url: "https://www.hemnet.se/bostad/lagenhet-3rum-nasbypark-taby-kommun-eskadervagen-46-21550346" },
    { id: 2, addr: "Eskadervägen 10, 5r 104 kvm", price: 5495000, sqm: 104, rooms: 5, floor: "4", fee: 5789, hiss: 1, status: "active", prissankt: 0, note: "5 rum, vån 4, sjöutsikt & skyroom! Brf Familjehotellet. Toppskick.", url: "https://www.hemnet.se/bostad/lagenhet-5rum-nasbypark-taby-kommun-eskadervagen-10,-4tr-19153211" },
    { id: 3, addr: "Eskadervägen 8, 4r 104,5 kvm (komm.)", price: null, sqm: 104.5, rooms: 4, floor: "-", fee: 5404, hiss: 1, status: "coming", prissankt: 0, note: "KOMMANDE via Svenska Mäklarhuset. Orenoverad original. Stambyte 2008, nya hissar 2012.", url: "https://svenskamaklarhuset.se/objekt/obj21875_2131971784-eskadervagen-8-nasby-park/" },
    { id: 4, addr: "Eskadervägen 34, 4r 94 kvm", price: null, sqm: 94, rooms: 4, floor: "-", fee: null, hiss: 1, status: "active", prissankt: 0, note: "Gavelfyra! Insynsfritt, låg belåning. Solid förening.", url: "https://www.hemnet.se/till-salu/lagenhet/taby-kommun/eskadervagen" },
    { id: 5, addr: "Eskadervägen 30, 6r 137,6 kvm (komm.)", price: null, sqm: 137.6, rooms: 6, floor: "8", fee: null, hiss: 1, status: "coming", prissankt: 0, note: "MONSTER: 137,6 kvm, 6 rum, vån 8! HusmanHagberg. Pris ej satt.", url: "https://www.booli.se/sok/till-salu?areaIds=3397&objectType=L%C3%A4genhet" },
    { id: 6, addr: "Eskadervägen 42, 2r 58,5 kvm", price: 2695000, sqm: 58.5, rooms: 2, floor: "5", fee: 4312, hiss: 1, status: "active", prissankt: 0, note: "Totalrenoverad. Under 75kvm men visar prisnivå: 46 068 kr/m². 23 dagar.", url: "https://www.hemnet.se/till-salu/lagenhet/taby-kommun/eskadervagen" },
    { id: 7, addr: "Eskadervägen 38, 2r 58,5 kvm", price: 2875000, sqm: 58.5, rooms: 2, floor: "1", fee: null, hiss: 1, status: "bidding", prissankt: 0, note: "Budgivning BankID pågår! Under 75kvm. Referensobjekt.", url: "https://www.hemnet.se/till-salu/lagenhet/taby-kommun/eskadervagen" },
    { id: 8, addr: "Källtorpsvägen 6, 3r 80 kvm (BV)", price: 3695000, sqm: 80, rooms: 3, floor: "BV", fee: 4426, hiss: 1, status: "active", prissankt: 0, note: "80 kvm BV med uteplats. Hiss. Sv. Fastighetsförmedling Täby.", url: "https://www.hemnet.se/till-salu/lagenhet/taby-kommun/lahall-nasby-park" },
    { id: 9, addr: "Källtorpsvägen 14, 4r 93 kvm", price: 4995000, sqm: 93, rooms: 4, floor: "2", fee: 6497, hiss: 1, status: "active", prissankt: 0, note: "4 rum, 93 kvm. 53 710 kr/m².", url: "https://www.booli.se/sok/till-salu?areaIds=3397&objectType=L%C3%A4genhet" },
    { id: 10, addr: "Källtorpsvägen 13, 4r 92 kvm", price: 4995000, sqm: 92, rooms: 4, floor: "3", fee: 7088, hiss: 1, status: "active", prissankt: 0, note: "4 rum, 92 kvm. Avgift 7 088 kr. 54 293 kr/m².", url: "https://www.booli.se/sok/till-salu?areaIds=3397&objectType=L%C3%A4genhet" },
    { id: 11, addr: "Källtorpsvägen 19, 4r 87 kvm", price: 4500000, sqm: 87, rooms: 4, floor: "2", fee: 5598, hiss: 1, status: "active", prissankt: 0, note: "Norskogen. 51 724 kr/m². Legat 1+ mån = förhandla!", url: "https://www.booli.se/sok/till-salu?areaIds=3397&objectType=L%C3%A4genhet" },
    { id: 12, addr: "Centralvägen 35, 3r 83 kvm", price: 4995000, sqm: 83, rooms: 3, floor: "5", fee: 4172, hiss: 1, status: "active", prissankt: 1, note: "PRISSÄNKT -300k (-5,7%)! Brf Sjötornet, byggår 2001, vån 5/17. 40 dagar.", url: "https://www.booli.se/annons/5232952" },
    { id: 13, addr: "Kryssarvägen, 6r 129+ kvm", price: null, sqm: 129, rooms: 6, floor: "-", fee: 5480, hiss: null, status: "active", prissankt: 0, note: "6 rum! Öppen spis, stambytta våtrum, sydväst-balkong. VERIFIERA HISS.", url: "https://www.hemnet.se/till-salu/taby-kommun/lahall-nasby-park" },
    { id: 14, addr: "Örnstigen 29, 3r ~75 kvm", price: null, sqm: 75, rooms: 3, floor: "-", fee: null, hiss: null, status: "active", prissankt: 0, note: "Söderläge. Toppskick. Bästa föreningarna i Täby. Solpaneler. HISS?", url: "https://www.hemnet.se/till-salu/lagenhet/taby-kommun/lahall-nasby-park" },
    { id: 15, addr: "Örnstigen 14, 3r 75,7 kvm", price: 3595000, sqm: 75.7, rooms: 3, floor: "-", fee: null, hiss: null, status: "bidding", prissankt: 0, note: "Budgivning pågår! 47 490 kr/m². Kontrollera hiss.", url: "https://www.hemnet.se/till-salu/lagenhet/taby-kommun/lahall-nasby-park" },
    { id: 16, addr: "Kadettens gata 10, 4r 90 kvm", price: 8595000, sqm: 90, rooms: 4, floor: "2", fee: 6468, hiss: 1, status: "active", prissankt: 0, note: "Slottspark. Otrolig rymd och fina material. Premium.", url: "https://www.hemnet.se/till-salu/taby-kommun" },
    { id: 17, addr: "N. Slottspark etage, 90 kvm", price: null, sqm: 90, rooms: 3, floor: "-", fee: null, hiss: 1, status: "active", prissankt: 0, note: "Etagevindsvåning. Kan göras om till 4a. Slottspark.", url: "https://www.hemnet.se/till-salu/taby-kommun/lahall-nasby-park" },
    { id: 18, addr: "N. Slottspark Södra, 3r 90 kvm", price: 5975000, sqm: 90, rooms: 3, floor: "2", fee: 4545, hiss: 1, status: "active", prissankt: 0, note: "55+ boende. Enstavsparkett, balkong söder, sjöutsikt.", url: "https://www.hemnet.se/till-salu/lagenhet/taby-kommun/lahall-nasby-park" },
    { id: 19, addr: "Fänrikens gata 7, 5r 141 kvm", price: 11500000, sqm: 141, rooms: 5, floor: "2", fee: 7182, hiss: 1, status: "active", prissankt: 0, note: "141 kvm etage. Originalgolv. 81 560 kr/m². Sjösidan.", url: "https://www.booli.se/sok/till-salu?areaIds=3397&objectType=L%C3%A4genhet" },
    { id: 20, addr: "Fänrikens gata 3, 3r 85 kvm", price: 7595000, sqm: 85, rooms: 3, floor: "2", fee: 6077, hiss: 1, status: "active", prissankt: 0, note: "Sjösidan nyproduktion. 89 353 kr/m².", url: "https://www.booli.se/sok/till-salu?areaIds=3397&objectType=L%C3%A4genhet" },
    { id: 21, addr: "N. Slottspark Södra, 4r 111 kvm", price: 7775000, sqm: 111, rooms: 4, floor: "3", fee: 5640, hiss: 1, status: "active", prissankt: 0, note: "111 kvm. 70 045 kr/m².", url: "https://www.booli.se/sok/till-salu?areaIds=3397&objectType=L%C3%A4genhet" },
    { id: 22, addr: "N. Slottspark Norra, 4r 90 kvm", price: 6475000, sqm: 90, rooms: 4, floor: "3", fee: 4868, hiss: 1, status: "active", prissankt: 0, note: "Norra Parken. 71 944 kr/m².", url: "https://www.booli.se/sok/till-salu?areaIds=3397&objectType=L%C3%A4genhet" },
    { id: 23, addr: "Nytorpsvägen 52, 5r 108 kvm (komm.)", price: null, sqm: 108, rooms: 5, floor: "2", fee: 6310, hiss: 1, status: "coming", prissankt: 0, note: "108 kvm, 5 rum! Notar. Pris ej publicerat. BEVAKA!", url: "https://www.booli.se/sok/till-salu?areaIds=3397&objectType=L%C3%A4genhet" },
    { id: 24, addr: "Källtorpsvägen (komm.), 72 kvm", price: null, sqm: 72, rooms: 3, floor: "-", fee: null, hiss: 1, status: "coming", prissankt: 0, note: "Kommande. Familjevänlig charm. Strax under 75.", url: "https://www.hemnet.se/kommande/lagenhet/taby-kommun/lahall-nasby-park" },
    { id: 25, addr: "N. Slottspark Södra, 3r 75 kvm", price: 7150000, sqm: 75, rooms: 3, floor: "5", fee: 3811, hiss: 1, status: "active", prissankt: 0, note: "Exakt 75 kvm. Låg avgift men 95 333 kr/m².", url: "https://www.booli.se/sok/till-salu?areaIds=3397&objectType=L%C3%A4genhet" },
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO apartments (id, addr, price, sqm, rooms, floor, fee, hiss, status, prissankt, note, url)
    VALUES (@id, @addr, @price, @sqm, @rooms, @floor, @fee, @hiss, @status, @prissankt, @note, @url)
  `);

  const insertMany = db.transaction((apts) => {
    for (const a of apts) insert.run(a);
  });

  insertMany(apartments);
}

// --- Query helpers ---

function getAllApartments() {
  return getDb().prepare('SELECT * FROM apartments ORDER BY id').all();
}

function getApartment(id) {
  return getDb().prepare('SELECT * FROM apartments WHERE id = ?').get(id);
}

function updateApartment(id, fields) {
  const allowed = ['contacted', 'user_notes', 'hidden', 'price', 'status', 'note'];
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

  // Log activity
  const detail = JSON.stringify(fields);
  getDb().prepare(
    'INSERT INTO activity_log (apartment_id, action, detail) VALUES (?, ?, ?)'
  ).run(id, 'update', detail);

  return getApartment(id);
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

module.exports = { getDb, getAllApartments, getApartment, updateApartment, getActivityLog };
