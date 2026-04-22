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

// Room Types
const roomTypeStmt = db.prepare(`INSERT OR IGNORE INTO RoomType (id, slug, name, basePrice, basePriceDouble, description, isActive, sortOrder) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`);
roomTypeStmt.run('rt-ekonomi', 'ekonomi', 'Ekonomi', 800000, 900000, 'Kamar hemat dengan fasilitas lengkap untuk kebutuhan dasar.', 1);
roomTypeStmt.run('rt-standar', 'standar', 'Standar', 1100000, 1250000, 'Kamar nyaman dengan AC untuk kenyamanan optimal.', 2);
roomTypeStmt.run('rt-suite', 'suite', 'Suite', 1500000, 1700000, 'Kamar suite lengkap dengan water heater.', 3);
roomTypeStmt.run('rt-deluxe', 'deluxe', 'Deluxe', 1800000, 2000000, 'Kamar deluxe premium dengan kamar yang lebih luas.', 4);

// Room Type Features
const rtfStmt = db.prepare(`INSERT OR IGNORE INTO RoomTypeFeature (id, roomTypeId, label, isIncluded, sortOrder) VALUES (?, ?, ?, ?, ?)`);
const ekonomiFeatures = [
  ['Kamar 3x4', 1], ['Mandi Dalam', 1], ['Toilet Jongkok', 1], ['AC', 0],
  ['Water Heater', 0], ['Lemari', 1], ['WiFi', 1], ['CCTV', 1], ['Parkir', 1],
];
const standarFeatures = [
  ['Kamar 3x4', 1], ['Mandi Dalam', 1], ['Toilet Duduk', 1], ['AC', 1],
  ['Water Heater', 0], ['Lemari', 1], ['WiFi', 1], ['CCTV', 1], ['Parkir', 1],
];
const suiteFeatures = [
  ['Kamar 3x4', 1], ['Mandi Dalam', 1], ['Toilet Duduk', 1], ['AC', 1],
  ['Water Heater', 1], ['Lemari', 1], ['WiFi', 1], ['CCTV', 1], ['Parkir', 1],
];
const deluxeFeatures = [
  ['Kamar Besar', 1], ['Mandi Dalam', 1], ['Toilet Duduk', 1], ['AC', 1],
  ['Water Heater', 1], ['Lemari', 1], ['WiFi', 1], ['CCTV', 1], ['Parkir', 1],
];
ekonomiFeatures.forEach(([label, inc], i) => rtfStmt.run(`rtf-e-${i}`, 'rt-ekonomi', label, inc, i));
standarFeatures.forEach(([label, inc], i) => rtfStmt.run(`rtf-s-${i}`, 'rt-standar', label, inc, i));
suiteFeatures.forEach(([label, inc], i) => rtfStmt.run(`rtf-su-${i}`, 'rt-suite', label, inc, i));
deluxeFeatures.forEach(([label, inc], i) => rtfStmt.run(`rtf-d-${i}`, 'rt-deluxe', label, inc, i));

// Bank Account
db.prepare(`INSERT OR IGNORE INTO BankAccount (id, bankName, accountNumber, accountHolder, isActive) VALUES (?, ?, ?, ?, ?)`).run(
  'bank-001', 'BCA', '1234567890', 'Mitra Kost Sumedang', 1
);

// Landing Content
const lcStmt = db.prepare(`INSERT OR IGNORE INTO LandingContent (id, section, key, value, sortOrder) VALUES (?, ?, ?, ?, ?)`);
lcStmt.run('lc-hero-1', 'hero', 'headline', 'Kos Premium di Jantung Kota Sumedang', 1);
lcStmt.run('lc-hero-2', 'hero', 'subheadline', '1 menit ke Alun-Alun Sumedang. Nyaman untuk profesional, dokter koas, dan mahasiswa.', 2);

// Facilities
const facilityStmt = db.prepare(`INSERT OR IGNORE INTO Facility (id, label, icon, sortOrder, isActive) VALUES (?, ?, ?, ?, 1)`);
facilityStmt.run('fac-1', 'WiFi Kencang', 'Wifi', 1);
facilityStmt.run('fac-2', 'CCTV 24 Jam', 'ShieldCheck', 2);
facilityStmt.run('fac-3', 'Parkir Mobil', 'Car', 3);
facilityStmt.run('fac-4', 'Kamar Mandi Dalam', 'Bath', 4);
facilityStmt.run('fac-5', 'AC', 'Wind', 5);
facilityStmt.run('fac-6', 'Water Heater', 'Flame', 6);

// How To Steps
const stepStmt = db.prepare(`INSERT OR IGNORE INTO HowToStep (id, stepNumber, title, description, icon) VALUES (?, ?, ?, ?, ?)`);
stepStmt.run('step-1', 1, 'Pilih Kamar', 'Pilih tipe dan lokasi kamar yang sesuai kebutuhanmu dari daftar unit tersedia.', 'Home');
stepStmt.run('step-2', 2, 'Kunjungi atau Hubungi', 'Kunjungi langsung lokasi kami atau hubungi admin via WhatsApp di +62-822-3300-5808.', 'MapPin');
stepStmt.run('step-3', 3, 'Isi Form & Bayar', 'Isi form pendaftaran lengkap dan bayar bulan pertama untuk konfirmasi kamar.', 'ClipboardList');
stepStmt.run('step-4', 4, 'Akses Dashboard', 'Setelah disetujui, akses dashboard penghuni untuk cek tagihan, komplain, dan info kost.', 'Smartphone');

// FAQs
const faqStmt = db.prepare(`INSERT OR IGNORE INTO Faq (id, question, answer, sortOrder, isActive) VALUES (?, ?, ?, ?, 1)`);
faqStmt.run('faq-1', 'Apakah bisa ditempati 2 orang?', 'Bisa. Tersedia harga untuk 1 orang dan 2 orang per tipe kamar.', 1);
faqStmt.run('faq-2', 'Apakah ada kontrak minimum?', 'Minimum sewa 1 bulan, bayar di awal setiap bulan.', 2);
faqStmt.run('faq-3', 'Bagaimana cara pembayaran?', 'Transfer bank, lalu konfirmasi ke admin via WhatsApp.', 3);
faqStmt.run('faq-4', 'Apakah bisa survey lokasi dulu?', 'Tentu! Datang langsung atau hubungi admin untuk jadwal kunjungan.', 4);
faqStmt.run('faq-5', 'Apakah ada layanan laundry?', 'Ada, layanan laundry kiloan terpisah dari biaya sewa.', 5);
faqStmt.run('faq-6', 'Apa keunggulan Mitra Kost?', 'Dilengkapi dashboard digital — penghuni bisa cek tagihan, komplain, dan info kost lewat smartphone.', 6);
faqStmt.run('faq-7', 'Apakah parkir mobil tersedia?', 'Ya, parkir mobil tersedia di kedua lokasi tanpa biaya tambahan.', 7);
faqStmt.run('faq-8', 'Bagaimana keamanan?', 'CCTV 24 jam di area strategis.', 8);

// Update Location mapsEmbed
try {
  db.prepare(`UPDATE Location SET mapsEmbed = ? WHERE id = 'budiasih'`).run(
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3961.2564698602127!2d107.91953837608081!3d-6.859834893138678!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e68d18ddcd2cc3f%3A0x512c4e81fbdcee5b!2sMitra%20Kost%20-%20Budi%20Asih%20Sumedang!5e0!3m2!1sen!2sid!4v1776659473067!5m2!1sen!2sid'
  );
  db.prepare(`UPDATE Location SET mapsEmbed = ? WHERE id = 'jatihurip'`).run(
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3961.5282352217832!2d107.91829725089536!3d-6.827082449210693!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e68d7fa62e3d775%3A0xbe82b2db8891e1a2!2sMitra%20Kost%20-%20Jatihurip%20Sumedang!5e0!3m2!1sen!2sid!4v1776659497496!5m2!1sen!2sid'
  );
} catch (_e) {}

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
