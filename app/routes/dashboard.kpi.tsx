import { redirect, useFetcher } from 'react-router';
import type { Route } from './+types/dashboard.kpi';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { syncKpiToSheet } from '~/lib/sheets.server';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import crypto from 'crypto';

function computeKpi(guardId: string, month: string) {
  const now = new Date();
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const currentDay = (now.getFullYear() === year && now.getMonth() + 1 === mon) ? now.getDate() : daysInMonth;

  const dailyTasks = db.prepare("SELECT COUNT(*) as c FROM KpiTask WHERE type = 'daily'").get() as any;
  const monthlyTasks = db.prepare("SELECT COUNT(*) as c FROM KpiTask WHERE type = 'monthly'").get() as any;

  const totalDailyTarget = dailyTasks.c * currentDay;
  const totalMonthlyTarget = monthlyTasks.c;
  const totalTarget = totalDailyTarget + totalMonthlyTarget;

  const log = db.prepare('SELECT * FROM KpiLog WHERE guardId = ? AND month = ?').get(guardId, month) as any;
  if (!log) return { kpiScore: 0, done: 0, total: totalTarget, baseSalary: 900000, kpiBonus: 0, takeHome: 900000 };

  const done = (db.prepare('SELECT COUNT(*) as c FROM KpiLogItem WHERE kpiLogId = ? AND done = 1').get(log.id) as any).c;
  const kpiScore = totalTarget > 0 ? done / totalTarget : 0;
  const kpiBonus = Math.floor(kpiScore * 270000);
  const takeHome = 900000 + kpiBonus;

  return { kpiScore, done, total: totalTarget, baseSalary: 900000, kpiBonus, takeHome };
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const url = new URL(request.url);
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const filterMonth = url.searchParams.get('month') || defaultMonth;
  const filterLocation = url.searchParams.get('location') || '';

  let guardQuery = `
    SELECT u.*, l.name as locationName
    FROM User u
    LEFT JOIN Location l ON l.id = u.locationId
    WHERE u.role = 'guard' AND u.status = 'active'
  `;
  const gParams: any[] = [];
  if (filterLocation) { guardQuery += ' AND u.locationId = ?'; gParams.push(filterLocation); }

  const guards = db.prepare(guardQuery).all(...gParams) as any[];
  const locations = db.prepare('SELECT * FROM Location').all() as any[];

  const rows = guards.map((g: any) => {
    const kpi = computeKpi(g.id, filterMonth);
    return { ...g, ...kpi };
  });

  return { rows, locations, filterMonth, filterLocation };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const formData = await request.formData();
  const intent = String(formData.get('intent'));
  const month = String(formData.get('month'));

  if (intent === 'sync') {
    // Recalculate and store KpiLog before sync
    const guards = db.prepare("SELECT * FROM User WHERE role = 'guard' AND status = 'active'").all() as any[];
    for (const g of guards) {
      const kpi = computeKpi(g.id, month);
      const existing = db.prepare('SELECT id FROM KpiLog WHERE guardId = ? AND month = ?').get(g.id, month) as any;
      if (existing) {
        db.prepare('UPDATE KpiLog SET kpiScore=?, kpiBonus=?, takeHome=? WHERE id=?')
          .run(kpi.kpiScore, kpi.kpiBonus, kpi.takeHome, existing.id);
      } else {
        db.prepare('INSERT INTO KpiLog (id, guardId, month, kpiScore, baseSalary, kpiBonus, takeHome) VALUES (?,?,?,?,?,?,?)')
          .run(crypto.randomUUID(), g.id, month, kpi.kpiScore, kpi.baseSalary, kpi.kpiBonus, kpi.takeHome);
      }
    }
    await syncKpiToSheet(month);
    return { success: 'KPI disinkronkan ke Google Sheets' };
  }

  return null;
}

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function KpiPage({ loaderData, actionData }: Route.ComponentProps) {
  const { rows, locations, filterMonth, filterLocation } = loaderData;
  const fetcher = useFetcher();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">KPI Penjaga</h1>
          <p className="text-sm text-gray-500">Kinerja penjaga bulan {filterMonth}</p>
        </div>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="sync" />
          <input type="hidden" name="month" value={filterMonth} />
          <Button type="submit" variant="outline" className="gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Sync Sheets
          </Button>
        </fetcher.Form>
      </div>

      {(actionData as any)?.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {(actionData as any).success}
        </div>
      )}

      <form className="flex flex-wrap gap-3">
        <input type="month" name="month" defaultValue={filterMonth} onChange={(e) => e.currentTarget.form?.submit()}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        <select name="location" defaultValue={filterLocation} onChange={(e) => e.currentTarget.form?.submit()}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="">Semua Lokasi</option>
          {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </form>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
          Belum ada data penjaga
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Nama</th>
                  <th className="text-left px-4 py-3 font-medium">Lokasi</th>
                  <th className="text-left px-4 py-3 font-medium">Selesai</th>
                  <th className="text-left px-4 py-3 font-medium">% KPI</th>
                  <th className="text-left px-4 py-3 font-medium">Gaji Pokok</th>
                  <th className="text-left px-4 py-3 font-medium">Tunjangan KPI</th>
                  <th className="text-left px-4 py-3 font-medium">Take Home</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.locationName || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{r.done}/{r.total}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div className="h-1.5 bg-red-500 rounded-full" style={{ width: `${Math.round(r.kpiScore * 100)}%` }} />
                        </div>
                        <span className="text-xs font-medium">{Math.round(r.kpiScore * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{formatRp(r.baseSalary)}</td>
                    <td className="px-4 py-3 text-green-700">{formatRp(r.kpiBonus)}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">{formatRp(r.takeHome)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
