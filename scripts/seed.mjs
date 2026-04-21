import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace('file:', '')
  : path.join(__dirname, '../data/mitrakost.db');

const db = new Database(dbPath);

console.log('Seeding...');

// Locations
db.prepare(`INSERT OR IGNORE INTO Location (id, name, address) VALUES (?, ?, ?)`).run('budiasih', 'Mitra Kost Budi Asih', 'Budi Asih, Sumedang');
db.prepare(`INSERT OR IGNORE INTO Location (id, name, address) VALUES (?, ?, ?)`).run('jatihurip', 'Mitra Kost Jatihurip', 'Jatihurip, Sumedang');

// Users
const ownerPwd = await bcrypt.hash('Owner@123', 10);
const adminPwd = await bcrypt.hash('Admin@123', 10);
const guardPwd = await bcrypt.hash('Guard@123', 10);

db.prepare(`INSERT OR IGNORE INTO User (id, name, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`).run('owner-001', 'Owner', 'owner@mitrakost.com', ownerPwd, 'owner', 'active');
db.prepare(`INSERT OR IGNORE INTO User (id, name, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`).run('admin-001', 'Admin', 'admin@mitrakost.com', adminPwd, 'admin', 'active');
db.prepare(`INSERT OR IGNORE INTO User (id, name, email, password, role, status, locationId) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('guard-001', 'Hilman', 'hilman@mitrakost.com', guardPwd, 'guard', 'active', 'budiasih');

// Rooms Budiasih
const roomsB = [
  ...Array.from({length:9}, (_,i) => [`B-E${String(i+1).padStart(2,'0')}`, `E${String(i+1).padStart(2,'0')}`, 'ekonomi', 800000, 900000]),
  ...Array.from({length:10}, (_,i) => [`B-S${String(i+1).padStart(2,'0')}`, `S${String(i+1).padStart(2,'0')}`, 'standar', 1100000, 1250000]),
  ...Array.from({length:18}, (_,i) => [`B-SU${String(i+1).padStart(2,'0')}`, `SU${String(i+1).padStart(2,'0')}`, 'suite', 1500000, 1700000]),
  ...Array.from({length:4}, (_,i) => [`B-D${String(i+1).padStart(2,'0')}`, `D${String(i+1).padStart(2,'0')}`, 'deluxe', 1800000, 2000000]),
];
const roomStmt = db.prepare(`INSERT OR IGNORE INTO Room (id, number, type, price, priceDouble, status, locationId) VALUES (?, ?, ?, ?, ?, 'available', ?)`);
roomsB.forEach(r => roomStmt.run(r[0], r[1], r[2], r[3], r[4], 'budiasih'));

// Rooms Jatihurip
for (let i = 1; i <= 16; i++) {
  const num = String(i).padStart(2,'0');
  roomStmt.run(`J-D${num}`, `JD${num}`, 'deluxe', 1800000, 2000000, 'jatihurip');
}

// SiteInfo
const siteInfos = [
  ['wifi_password_budiasih', 'Password WiFi Budiasih', 'MitraKost2026'],
  ['wifi_password_jatihurip', 'Password WiFi Jatihurip', 'MitraKost2026'],
  ['kontak_admin', 'Nomor Admin', '+62 822-3300-5808'],
  ['whatsapp_admin', 'WhatsApp Admin', '6282233005808'],
  ['email_admin', 'Email Admin', 'mitrakostsumedang@gmail.com'],
  ['kontak_darurat', 'Nomor Darurat', '112'],
  ['harga_laundry_per_kg', 'Harga Laundry per Kg', '7000'],
];
const siStmt = db.prepare(`INSERT OR IGNORE INTO SiteInfo (id, key, label, value) VALUES (?, ?, ?, ?)`);
siteInfos.forEach(s => siStmt.run(s[0], s[0], s[1], s[2]));

// KPI Tasks Harian
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
const taskStmt = db.prepare(`INSERT OR IGNORE INTO KpiTask (id, title, type, taskOrder) VALUES (?, ?, ?, ?)`);
tasksHarian.forEach((t, i) => taskStmt.run(`harian-${i+1}`, t, 'daily', i+1));
tasksBulanan.forEach((t, i) => taskStmt.run(`bulanan-${i+1}`, t, 'monthly', i+1));

console.log('Seed selesai!');
console.log('Owner: owner@mitrakost.com / Owner@123');
console.log('Admin: admin@mitrakost.com / Admin@123');
console.log('Guard: hilman@mitrakost.com / Guard@123');
db.close();
