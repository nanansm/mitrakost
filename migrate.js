import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace('file:', '')
  : path.join(__dirname, 'data/mitrakost.db');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS Location (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS Room (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    type TEXT NOT NULL,
    price INTEGER NOT NULL,
    priceDouble INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'available',
    locationId TEXT NOT NULL,
    FOREIGN KEY (locationId) REFERENCES Location(id)
  );

  CREATE TABLE IF NOT EXISTS User (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'tenant',
    status TEXT NOT NULL DEFAULT 'pending',
    password TEXT,
    roomId TEXT,
    locationId TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS Session (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    expiresAt DATETIME NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id)
  );

  CREATE TABLE IF NOT EXISTS TenantForm (
    id TEXT PRIMARY KEY,
    userId TEXT UNIQUE NOT NULL,
    ktpNumber TEXT NOT NULL,
    ktpImage TEXT,
    occupation TEXT NOT NULL,
    emergencyName TEXT NOT NULL,
    emergencyPhone TEXT NOT NULL,
    paymentProof TEXT,
    roomId TEXT NOT NULL,
    locationId TEXT NOT NULL,
    roomType TEXT NOT NULL,
    occupancy INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',
    note TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS Payment (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    month TEXT,
    status TEXT NOT NULL DEFAULT 'unpaid',
    proofImage TEXT,
    note TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS Laundry (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    weight REAL NOT NULL,
    pricePerKg INTEGER NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS Complaint (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    image TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS SiteInfo (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    label TEXT NOT NULL,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS Guard (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    phone TEXT,
    locationId TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS KpiTask (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    taskOrder INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS KpiLog (
    id TEXT PRIMARY KEY,
    guardId TEXT NOT NULL,
    month TEXT NOT NULL,
    kpiScore REAL NOT NULL DEFAULT 0,
    baseSalary INTEGER NOT NULL DEFAULT 900000,
    kpiBonus INTEGER NOT NULL DEFAULT 0,
    takeHome INTEGER NOT NULL DEFAULT 0,
    synced INTEGER NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guardId, month)
  );

  CREATE TABLE IF NOT EXISTS KpiLogItem (
    id TEXT PRIMARY KEY,
    kpiLogId TEXT NOT NULL,
    taskId TEXT NOT NULL,
    date TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    UNIQUE(kpiLogId, taskId, date)
  );

  CREATE TABLE IF NOT EXISTS Expense (
    id TEXT PRIMARY KEY,
    locationId TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount INTEGER NOT NULL,
    date TEXT NOT NULL,
    inputBy TEXT NOT NULL,
    inputRole TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_session_userId ON Session(userId);
  CREATE INDEX IF NOT EXISTS idx_room_status ON Room(status);
  CREATE INDEX IF NOT EXISTS idx_user_email ON User(email);
`);

// Seed KPI Tasks if empty
const taskCount = db.prepare('SELECT COUNT(*) as c FROM KpiTask').get().c;
if (taskCount === 0) {
  const tasksHarian = [
    'Membuka gerbang/pintu utama (06.00)',
    'Mematikan lampu',
    'Mengecek listrik, meteran air dan fasilitas umum lainnya',
    'Mengumpulkan & membuang sampah',
    'Menyapu area parkiran',
    'Menyapu seluruh area kost',
    'Pel seluruh area kost',
    'Merawat tanaman',
    'Melaporkan kerusakan ke pengelola',
    'Perawatan gedung ringan (jika ada)',
    'Menerima & mencatat keluhan penghuni (jika ada)',
    'Standby via Telp/WA',
    'Menangani keluhan penting (jika ada)',
    'Berkeliling dan melakukan pembersihan ringan sambil menyalakan lampu',
    'Jika hujan scrapper lantai sampai tidak ada genangan air',
    'Patroli ringan area kost',
    'Cek dan merapihkan kembali parkir',
    'Pantau aktivitas tamu, penghuni & monitoring kebisingan',
    'Pastikan area dalam kondisi tenang 22.00 ke atas',
    'Kunci gerbang 22.00',
  ];
  const tasksBulanan = [
    'Data penghuni ter-update',
    'Data kamar kosong dan isi ter-update',
    'Buang sampah dan barang tidak terpakai',
    'Bersihkan kamar yang tidak berpenghuni (sapu & pel)',
    'Bersihkan kamar mandi yang tidak berpenghuni (deep cleaning)',
    'Cek kerusakan (tembok, lantai, furniture)',
    'Reset layout kamar (tata ulang, ganti sprei dan sarung bantal) kamar siap',
    'Berkeliling ke tiap kamar untuk laundry sprei dan sarung bantal',
  ];
  const taskStmt = db.prepare('INSERT OR IGNORE INTO KpiTask (id, title, type, taskOrder) VALUES (?, ?, ?, ?)');
  tasksHarian.forEach((t, i) => taskStmt.run(`harian-${i+1}`, t, 'daily', i+1));
  tasksBulanan.forEach((t, i) => taskStmt.run(`bulanan-${i+1}`, t, 'monthly', i+1));
  console.log('[migrate] KPI tasks seeded');
}

console.log('[migrate] Database tables created/verified');
db.close();
