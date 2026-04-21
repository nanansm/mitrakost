import { redirect, useFetcher } from 'react-router';
import type { Route } from './+types/dashboard.expenses';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { syncExpensesToSheet, syncSilent, syncProfitLossToSheet } from '~/lib/sheets.server';
import { Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import crypto from 'crypto';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const url = new URL(request.url);
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const filterMonth = url.searchParams.get('month') || defaultMonth;
  const filterLocation = url.searchParams.get('location') || '';
  const filterCategory = url.searchParams.get('category') || '';

  let query = `
    SELECT e.*, l.name as locationName
    FROM Expense e JOIN Location l ON l.id = e.locationId
    WHERE e.date LIKE ?
  `;
  const params: any[] = [`${filterMonth}%`];
  if (filterLocation) { query += ' AND e.locationId = ?'; params.push(filterLocation); }
  if (filterCategory) { query += ' AND e.category = ?'; params.push(filterCategory); }
  query += ' ORDER BY e.date DESC';

  const expenses = db.prepare(query).all(...params) as any[];
  const locations = db.prepare('SELECT * FROM Location').all() as any[];

  const totals = expenses.reduce((acc: any, e: any) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    acc.all = (acc.all || 0) + e.amount;
    return acc;
  }, {});

  return { expenses, locations, totals, filterMonth, filterLocation, filterCategory };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const formData = await request.formData();
  const intent = String(formData.get('intent'));

  if (intent === 'add') {
    const locationId = String(formData.get('locationId'));
    const category = String(formData.get('category'));
    const description = String(formData.get('description'));
    const amount = Number(formData.get('amount'));
    const date = String(formData.get('date'));

    db.prepare(
      "INSERT INTO Expense (id, locationId, category, description, amount, date, inputBy, inputRole) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(crypto.randomUUID(), locationId, category, description, amount, date, user.name, user.role);

    const month = date.slice(0, 7);
    syncSilent(() => syncExpensesToSheet(month));
    syncSilent(() => syncProfitLossToSheet(month));

    return { success: 'Pengeluaran disimpan' };
  }

  if (intent === 'sync') {
    const month = String(formData.get('month'));
    await syncExpensesToSheet(month);
    return { success: 'Data disinkronkan ke Google Sheets' };
  }

  return null;
}

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

const CATEGORIES = ['listrik', 'air', 'maintenance', 'gaji', 'lainnya'];

export default function Expenses({ loaderData, actionData }: Route.ComponentProps) {
  const { expenses, locations, totals, filterMonth, filterLocation, filterCategory } = loaderData;
  const [showAdd, setShowAdd] = useState(false);
  const fetcher = useFetcher();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pengeluaran</h1>
          <p className="text-sm text-gray-500">Total: <strong>{formatRp(totals.all || 0)}</strong></p>
        </div>
        <div className="flex gap-2">
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="sync" />
            <input type="hidden" name="month" value={filterMonth} />
            <Button type="submit" variant="outline" className="gap-2 text-sm">
              <RefreshCw className="w-4 h-4" /> Sync Sheets
            </Button>
          </fetcher.Form>
          <Button onClick={() => setShowAdd(true)} className="bg-red-600 hover:bg-red-700 text-white gap-2">
            <Plus className="w-4 h-4" /> Tambah
          </Button>
        </div>
      </div>

      {(actionData as any)?.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {(actionData as any).success}
        </div>
      )}

      {/* Total per Kategori */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CATEGORIES.map((cat) => (
          <div key={cat} className="bg-white rounded-xl border p-3">
            <p className="text-xs text-gray-500 capitalize">{cat}</p>
            <p className="font-bold text-gray-900 text-sm">{formatRp(totals[cat] || 0)}</p>
          </div>
        ))}
      </div>

      <form className="flex flex-wrap gap-3">
        <input type="month" name="month" defaultValue={filterMonth} onChange={(e) => e.currentTarget.form?.submit()}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        <select name="location" defaultValue={filterLocation} onChange={(e) => e.currentTarget.form?.submit()}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="">Semua Lokasi</option>
          {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select name="category" defaultValue={filterCategory} onChange={(e) => e.currentTarget.form?.submit()}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="">Semua Kategori</option>
          {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
      </form>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                <th className="text-left px-4 py-3 font-medium">Lokasi</th>
                <th className="text-left px-4 py-3 font-medium">Kategori</th>
                <th className="text-left px-4 py-3 font-medium">Keterangan</th>
                <th className="text-left px-4 py-3 font-medium">Jumlah</th>
                <th className="text-left px-4 py-3 font-medium">Input Oleh</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Tidak ada data</td></tr>
              ) : expenses.map((e: any) => (
                <tr key={e.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{e.date}</td>
                  <td className="px-4 py-3 text-gray-600">{e.locationName}</td>
                  <td className="px-4 py-3 capitalize text-gray-600">{e.category}</td>
                  <td className="px-4 py-3 text-gray-700">{e.description}</td>
                  <td className="px-4 py-3 font-medium">{formatRp(e.amount)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{e.inputRole}: {e.inputBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <fetcher.Form
            method="post"
            onSubmit={() => setShowAdd(false)}
            className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4"
          >
            <h2 className="text-lg font-bold">Tambah Pengeluaran</h2>
            <input type="hidden" name="intent" value="add" />
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Tanggal</label>
              <Input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Lokasi</label>
              <select name="locationId" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">-- Pilih Lokasi --</option>
                {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Kategori</label>
              <select name="category" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Keterangan</label>
              <Textarea name="description" placeholder="Deskripsi pengeluaran..." rows={2} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Jumlah (Rp)</label>
              <Input type="number" name="amount" placeholder="500000" required />
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white">Simpan</Button>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Batal</Button>
            </div>
          </fetcher.Form>
        </div>
      )}
    </div>
  );
}
