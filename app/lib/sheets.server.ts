import { google } from 'googleapis';
import { db } from './db.server';

function getSheetsClient() {
  const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '';

async function ensureSheet(sheetName: string, headers: string[]) {
  if (!SHEET_ID) return;
  const sheets = getSheetsClient();
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  } catch {
    // Sheet already exists, skip
  }
}

export async function syncSilent(syncFn: () => Promise<void>) {
  try {
    await syncFn();
  } catch (err) {
    console.error('[sheets-sync] error (silent):', err);
  }
}

export async function syncTenantsToSheet() {
  if (!SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.log('[sheets] Not configured, skip Tenants sync');
    return;
  }
  await ensureSheet('Data_Penghuni', ['ID', 'Nama', 'Email', 'HP', 'Kamar', 'Lokasi', 'Tipe', 'Status', 'Tgl Masuk']);

  const tenants = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, r.number as roomNumber, l.name as locationName, r.type as roomType, u.status, u.createdAt
    FROM User u
    LEFT JOIN Room r ON r.id = u.roomId
    LEFT JOIN Location l ON l.id = r.locationId
    WHERE u.role = 'tenant'
  `).all() as any[];

  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: 'Data_Penghuni!A2:I',
  });

  const rows = tenants.map(t => [
    t.id, t.name, t.email, t.phone || '-',
    t.roomNumber || '-', t.locationName || '-', t.roomType || '-',
    t.status, t.createdAt,
  ]);

  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Data_Penghuni!A2',
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
  }
}

export async function syncKpiToSheet(month: string) {
  if (!SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.log('[sheets] Not configured, skip KPI sync');
    return;
  }
  await ensureSheet('KPI_Penjaga', [
    'Bulan', 'Nama Penjaga', 'Lokasi', 'Total Tugas', 'Selesai', '% KPI',
    'Gaji Pokok', 'Tunjangan KPI', 'Take Home Pay',
  ]);

  const logs = db.prepare(`
    SELECT kl.*, u.name as guardName, l.name as locationName
    FROM KpiLog kl
    JOIN User u ON u.id = kl.guardId
    LEFT JOIN Location l ON l.id = u.locationId
    WHERE kl.month = ?
  `).all(month) as any[];

  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `KPI_Penjaga!A2:I`,
  });

  const rows = logs.map((log) => [
    month,
    log.guardName,
    log.locationName || '-',
    '-',
    '-',
    Math.round(log.kpiScore * 100) + '%',
    log.baseSalary,
    log.kpiBonus,
    log.takeHome,
  ]);

  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'KPI_Penjaga!A2',
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
  }

  db.prepare('UPDATE KpiLog SET synced = 1 WHERE month = ?').run(month);
}

export async function syncExpensesToSheet(month: string) {
  if (!SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.log('[sheets] Not configured, skip Expense sync');
    return;
  }
  await ensureSheet('Pengeluaran', [
    'Tanggal', 'Lokasi', 'Kategori', 'Keterangan', 'Jumlah', 'Input Oleh',
  ]);

  const expenses = db.prepare(`
    SELECT e.*, l.name as locationName
    FROM Expense e
    JOIN Location l ON l.id = e.locationId
    WHERE e.date LIKE ?
  `).all(`${month}%`) as any[];

  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: 'Pengeluaran!A2:F',
  });

  const rows = expenses.map((e) => [
    e.date, e.locationName, e.category, e.description, e.amount,
    e.inputRole + ': ' + e.inputBy,
  ]);

  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Pengeluaran!A2',
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
  }

  db.prepare("UPDATE Expense SET synced = 1 WHERE date LIKE ?").run(`${month}%`);
}

export async function syncIncomeToSheet(month: string) {
  if (!SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.log('[sheets] Not configured, skip Income sync');
    return;
  }
  await ensureSheet('Pemasukan', [
    'Bulan', 'Lokasi', 'No Kamar', 'Penghuni', 'Tipe', 'Sewa', 'Laundry', 'Total',
  ]);

  const data = db.prepare(`
    SELECT u.name, r.number, r.type, l.name as locationName,
      (SELECT COALESCE(SUM(amount),0) FROM Payment WHERE userId = u.id AND month = ? AND type = 'rent') as sewa,
      (SELECT COALESCE(SUM(total),0) FROM Laundry WHERE userId = u.id AND createdAt LIKE ?) as laundry
    FROM User u
    LEFT JOIN Room r ON r.id = u.roomId
    LEFT JOIN Location l ON l.id = r.locationId
    WHERE u.role = 'tenant' AND u.status = 'active'
  `).all(month, `${month}%`) as any[];

  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: 'Pemasukan!A2:H',
  });

  const rows = data.map((d) => [
    month, d.locationName || '-', d.number || '-', d.name, d.type || '-',
    d.sewa, d.laundry, d.sewa + d.laundry,
  ]);

  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Pemasukan!A2',
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
  }
}

export async function syncProfitLossToSheet(month: string) {
  if (!SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.log('[sheets] Not configured, skip P&L sync');
    return;
  }
  await ensureSheet('Laba_Rugi', [
    'Bulan', 'Lokasi', 'Pemasukan', 'Pengeluaran', 'Gaji', 'Listrik',
    'Air', 'Maintenance', 'Lainnya', 'Laba Bersih',
  ]);

  const locations = db.prepare('SELECT * FROM Location').all() as any[];
  const rows: any[][] = [];

  for (const loc of locations) {
    const sewa = (db.prepare(`SELECT COALESCE(SUM(p.amount),0) as t FROM Payment p JOIN User u ON u.id=p.userId LEFT JOIN Room r ON r.id=u.roomId WHERE p.month=? AND p.type='rent' AND p.status='paid' AND r.locationId=?`).get(month, loc.id) as any).t;
    const laundry = (db.prepare(`SELECT COALESCE(SUM(l.total),0) as t FROM Laundry l JOIN User u ON u.id=l.userId LEFT JOIN Room r ON r.id=u.roomId WHERE l.createdAt LIKE ? AND r.locationId=?`).get(`${month}%`, loc.id) as any).t;
    const gaji = (db.prepare(`SELECT COALESCE(SUM(takeHome),0) as t FROM KpiLog kl JOIN User u ON u.id=kl.guardId WHERE kl.month=? AND u.locationId=?`).get(month, loc.id) as any).t;
    const listrik = (db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM Expense WHERE locationId=? AND category='listrik' AND date LIKE ?`).get(loc.id, `${month}%`) as any).t;
    const air = (db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM Expense WHERE locationId=? AND category='air' AND date LIKE ?`).get(loc.id, `${month}%`) as any).t;
    const maint = (db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM Expense WHERE locationId=? AND category='maintenance' AND date LIKE ?`).get(loc.id, `${month}%`) as any).t;
    const lain = (db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM Expense WHERE locationId=? AND category='lainnya' AND date LIKE ?`).get(loc.id, `${month}%`) as any).t;

    const pemasukan = sewa + laundry;
    const pengeluaran = gaji + listrik + air + maint + lain;
    const laba = pemasukan - pengeluaran;

    rows.push([month, loc.name, pemasukan, pengeluaran, gaji, listrik, air, maint, lain, laba]);
  }

  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: 'Laba_Rugi!A2:J',
  });

  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Laba_Rugi!A2',
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
  }
}

export async function syncLogAdmin(admin: string, action: string, target: string, detail: string) {
  if (!SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return;
  await ensureSheet('Log_Admin', ['Tanggal', 'Admin', 'Aksi', 'Target', 'Detail']);
  const sheets = getSheetsClient();
  const now = new Date().toISOString();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Log_Admin!A:E',
    valueInputOption: 'RAW',
    requestBody: { values: [[now, admin, action, target, detail]] },
  });
}
