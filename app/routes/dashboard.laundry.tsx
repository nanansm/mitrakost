import { redirect, useFetcher } from 'react-router';
import type { Route } from './+types/dashboard.laundry';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { syncSilent, syncIncomeToSheet, syncProfitLossToSheet } from '~/lib/sheets.server';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { useState } from 'react';
import crypto from 'crypto';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const tenants = db.prepare(
    "SELECT id, name FROM User WHERE role = 'tenant' AND status = 'active' ORDER BY name"
  ).all() as any[];

  const pricePerKgSetting = db.prepare(
    "SELECT value FROM SiteInfo WHERE key = 'harga_laundry_per_kg'"
  ).get() as any;
  const pricePerKg = Number(pricePerKgSetting?.value || 7000);

  const history = db.prepare(
    `SELECT l.*, u.name as tenantName
     FROM Laundry l JOIN User u ON u.id = l.userId
     ORDER BY l.createdAt DESC LIMIT 50`
  ).all() as any[];

  return { tenants, pricePerKg, history };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const formData = await request.formData();
  const userId = String(formData.get('userId'));
  const weight = parseFloat(String(formData.get('weight') || '0'));
  const pricePerKg = Number(formData.get('pricePerKg') || 7000);
  const total = Math.round(weight * pricePerKg);

  db.prepare(
    "INSERT INTO Laundry (id, userId, weight, pricePerKg, total, status) VALUES (?, ?, ?, ?, ?, 'pending')"
  ).run(crypto.randomUUID(), userId, weight, pricePerKg, total);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  syncSilent(() => syncIncomeToSheet(currentMonth));
  syncSilent(() => syncProfitLossToSheet(currentMonth));

  return { success: 'Data laundry disimpan' };
}

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function Laundry({ loaderData, actionData }: Route.ComponentProps) {
  const { tenants, pricePerKg, history } = loaderData;
  const [weight, setWeight] = useState('');
  const [price, setPrice] = useState(String(pricePerKg));
  const fetcher = useFetcher();

  const total = weight && price ? Math.round(parseFloat(weight) * Number(price)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Laundry</h1>
        <p className="text-sm text-gray-500">Input data laundry penghuni</p>
      </div>

      {(actionData as any)?.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {(actionData as any).success}
        </div>
      )}

      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Input Laundry</h2>
        <fetcher.Form method="post" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Penghuni</label>
              <select
                name="userId"
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">-- Pilih Penghuni --</option>
                {tenants.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Berat (kg)</label>
              <Input
                type="number"
                name="weight"
                step="0.1"
                min="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0.0"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Harga/kg (Rp)</label>
              <Input
                type="number"
                name="pricePerKg"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Total</label>
              <div className="px-3 py-2 bg-gray-50 border rounded-lg text-sm font-medium text-gray-900">
                {total > 0 ? formatRp(total) : '-'}
              </div>
            </div>
          </div>
          <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white">
            Simpan Laundry
          </Button>
        </fetcher.Form>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-900">Riwayat Laundry</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                <th className="text-left px-4 py-3 font-medium">Penghuni</th>
                <th className="text-left px-4 py-3 font-medium">Berat</th>
                <th className="text-left px-4 py-3 font-medium">Total</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Belum ada data</td></tr>
              ) : history.map((h: any) => (
                <tr key={h.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{new Date(h.createdAt).toLocaleDateString('id-ID')}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{h.tenantName}</td>
                  <td className="px-4 py-3 text-gray-600">{h.weight} kg</td>
                  <td className="px-4 py-3 font-medium">{formatRp(h.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      h.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {h.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
