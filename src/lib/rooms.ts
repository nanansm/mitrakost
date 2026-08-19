import snapshot from '../data/rooms-snapshot.json';

export type Status = 'kosong' | 'terisi' | 'perbaikan';

export type Room = {
  kode: string;
  lokasi: string;
  tipe: string;
  nomor: string;
  status: Status;
  harga_1_orang: number;
  harga_2_orang: number;
};

const SHEET_CSV_URL =
  process.env.SHEET_CSV_URL ?? import.meta.env.SHEET_CSV_URL ?? '';

/** Pemisah baris CSV yang menghormati tanda kutip. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; }
      } else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }

  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim() !== ''));
  if (!header) return [];
  return body.map((r) =>
    Object.fromEntries(header.map((h, i) => [h.trim().toLowerCase(), (r[i] ?? '').trim()]))
  );
}

function normalise(raw: Record<string, string>): Room | null {
  const kode = raw.kode;
  if (!kode) return null;
  const s = (raw.status || '').toLowerCase();
  const status: Status = s === 'kosong' ? 'kosong' : s === 'perbaikan' ? 'perbaikan' : 'terisi';
  return {
    kode,
    lokasi: raw.lokasi || '',
    tipe: raw.tipe || '',
    nomor: raw.nomor || '',
    status,
    harga_1_orang: Number(String(raw.harga_1_orang).replace(/\D/g, '')) || 0,
    harga_2_orang: Number(String(raw.harga_2_orang).replace(/\D/g, '')) || 0,
  };
}

/**
 * Dibaca saat build. Sheet gagal / kosong / belum diisi -> pakai snapshot di repo.
 * Situs TIDAK PERNAH gagal build hanya karena Google sedang bermasalah.
 */
export async function getRooms(): Promise<{ rooms: Room[]; sumber: 'sheet' | 'snapshot' }> {
  const fallback = { rooms: snapshot as Room[], sumber: 'snapshot' as const };
  if (!SHEET_CSV_URL) return fallback;

  try {
    const res = await fetch(SHEET_CSV_URL, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = parseCsv(await res.text()).map(normalise).filter((r): r is Room => r !== null);
    if (rows.length === 0) throw new Error('sheet kosong');
    return { rooms: rows, sumber: 'sheet' };
  } catch (err) {
    console.warn(`[rooms] Sheet tidak terbaca (${(err as Error).message}) — pakai snapshot repo.`);
    return fallback;
  }
}

export const rupiah = (n: number) => 'Rp' + n.toLocaleString('id-ID');
