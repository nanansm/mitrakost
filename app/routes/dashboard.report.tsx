import { redirect, useFetcher } from 'react-router';
import type { Route } from './+types/dashboard.report';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { syncProfitLossToSheet } from '~/lib/sheets.server';
import { RefreshCw, Printer } from 'lucide-react';
import { Button } from '~/components/ui/button';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const url = new URL(request.url);
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const filterMonth = url.searchParams.get('month') || defaultMonth;
  const filterLocation = url.searchParams.get('location') || '';

  const locations = db.prepare('SELECT * FROM Location').all() as any[];

  const targetLocations = filterLocation
    ? locations.filter((l: any) => l.id === filterLocation)
    : locations;

  const report = targetLocations.map((loc: any) => {
    const sewa = (db.prepare(`SELECT COALESCE(SUM(p.amount),0) as t FROM Payment p JOIN User u ON u.id=p.userId LEFT JOIN Room r ON r.id=u.roomId WHERE p.month=? AND p.type='rent' AND p.status='paid' AND r.locationId=?`).get(filterMonth, loc.id) as any).t;
    const laundry = (db.prepare(`SELECT COALESCE(SUM(l.total),0) as t FROM Laundry l JOIN User u ON u.id=l.userId LEFT JOIN Room r ON r.id=u.roomId WHERE l.createdAt LIKE ? AND r.locationId=?`).get(`${filterMonth}%`, loc.id) as any).t;
    const gaji = (db.prepare(`SELECT COALESCE(SUM(kl.takeHome),0) as t FROM KpiLog kl JOIN User u ON u.id=kl.guardId WHERE kl.month=? AND u.locationId=?`).get(filterMonth, loc.id) as any).t;
    const listrik = (db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM Expense WHERE locationId=? AND category='listrik' AND date LIKE ?`).get(loc.id, `${filterMonth}%`) as any).t;
    const air = (db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM Expense WHERE locationId=? AND category='air' AND date LIKE ?`).get(loc.id, `${filterMonth}%`) as any).t;
    const maint = (db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM Expense WHERE locationId=? AND category='maintenance' AND date LIKE ?`).get(loc.id, `${filterMonth}%`) as any).t;
    const lain = (db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM Expense WHERE locationId=? AND category='lainnya' AND date LIKE ?`).get(loc.id, `${filterMonth}%`) as any).t;

    const pemasukan = sewa + laundry;
    const pengeluaran = gaji + listrik + air + maint + lain;
    const laba = pemasukan - pengeluaran;

    return { loc, sewa, laundry, pemasukan, gaji, listrik, air, maint, lain, pengeluaran, laba };
  });

  const totalPemasukan = report.reduce((s: number, r: any) => s + r.pemasukan, 0);
  const totalPengeluaran = report.reduce((s: number, r: any) => s + r.pengeluaran, 0);
  const totalLaba = totalPemasukan - totalPengeluaran;

  return { report, locations, filterMonth, filterLocation, totalPemasukan, totalPengeluaran, totalLaba };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const formData = await request.formData();
  const month = String(formData.get('month'));
  await syncProfitLossToSheet(month);
  return { success: 'Laporan disinkronkan ke Google Sheets' };
}

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function Row({ label, value, className = '' }: { label: string; value: number; className?: string }) {
  return (
    <div className={`flex justify-between py-1.5 text-sm ${className}`}>
      <span className="text-gray-600">{label}</span>
      <span className="font-medium">{formatRp(value)}</span>
    </div>
  );
}

export default function Report({ loaderData, actionData }: Route.ComponentProps) {
  const { report, locations, filterMonth, filterLocation, totalPemasukan, totalPengeluaran, totalLaba } = loaderData;
  const fetcher = useFetcher();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Laporan Laba Rugi</h1>
          <p className="text-sm text-gray-500">Bulan {filterMonth}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <fetcher.Form method="post">
            <input type="hidden" name="month" value={filterMonth} />
            <Button type="submit" variant="outline" className="gap-2 text-sm">
              <RefreshCw className="w-4 h-4" /> Sync Sheets
            </Button>
          </fetcher.Form>
          <Button
            variant="outline"
            className="gap-2 text-sm"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4" /> Cetak
          </Button>
        </div>
      </div>

      {(actionData as any)?.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 print:hidden">
          {(actionData as any).success}
        </div>
      )}

      <form className="flex gap-3 print:hidden">
        <input type="month" name="month" defaultValue={filterMonth} onChange={(e) => e.currentTarget.form?.submit()}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        <select name="location" defaultValue={filterLocation} onChange={(e) => e.currentTarget.form?.submit()}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="">Semua Lokasi</option>
          {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </form>

      {report.map((r: any) => (
        <div key={r.loc.id} className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-bold text-gray-900">{r.loc.name}</h2>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pemasukan</h3>
            <Row label="Sewa" value={r.sewa} />
            <Row label="Laundry" value={r.laundry} />
            <div className="flex justify-between py-1.5 text-sm border-t mt-1">
              <span className="font-semibold">Total Pemasukan</span>
              <span className="font-bold text-green-700">{formatRp(r.pemasukan)}</span>
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pengeluaran</h3>
            <Row label="Gaji Penjaga" value={r.gaji} />
            <Row label="Listrik" value={r.listrik} />
            <Row label="Air" value={r.air} />
            <Row label="Maintenance" value={r.maint} />
            <Row label="Lainnya" value={r.lain} />
            <div className="flex justify-between py-1.5 text-sm border-t mt-1">
              <span className="font-semibold">Total Pengeluaran</span>
              <span className="font-bold text-red-700">{formatRp(r.pengeluaran)}</span>
            </div>
          </div>
          <div className={`rounded-xl p-4 ${r.laba >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex justify-between text-base font-bold">
              <span>Laba Bersih</span>
              <span className={r.laba >= 0 ? 'text-green-700' : 'text-red-700'}>{formatRp(r.laba)}</span>
            </div>
          </div>
        </div>
      ))}

      {report.length > 1 && (
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-bold text-gray-900 mb-4">Ringkasan Semua Lokasi</h2>
          <Row label="Total Pemasukan" value={totalPemasukan} />
          <Row label="Total Pengeluaran" value={totalPengeluaran} />
          <div className={`mt-3 rounded-xl p-4 ${totalLaba >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex justify-between text-base font-bold">
              <span>Total Laba Bersih</span>
              <span className={totalLaba >= 0 ? 'text-green-700' : 'text-red-700'}>{formatRp(totalLaba)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
