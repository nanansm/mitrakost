import { redirect, useFetcher } from 'react-router';
import type { Route } from './+types/dashboard.guards';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { Plus, UserX } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const guards = db.prepare(
    `SELECT u.*, l.name as locationName
     FROM User u
     LEFT JOIN Location l ON l.id = u.locationId
     WHERE u.role = 'guard'
     ORDER BY u.createdAt DESC`
  ).all() as any[];

  const locations = db.prepare('SELECT * FROM Location').all() as any[];

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const guardsWithKpi = guards.map((g: any) => {
    const log = db.prepare('SELECT kpiScore FROM KpiLog WHERE guardId = ? AND month = ?').get(g.id, month) as any;
    return { ...g, kpiScore: log?.kpiScore || 0 };
  });

  return { guards: guardsWithKpi, locations };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const formData = await request.formData();
  const intent = String(formData.get('intent'));

  if (intent === 'add') {
    const name = String(formData.get('name'));
    const email = String(formData.get('email')).toLowerCase();
    const password = String(formData.get('password'));
    const phone = String(formData.get('phone'));
    const locationId = String(formData.get('locationId'));

    const existing = db.prepare('SELECT id FROM User WHERE email = ?').get(email);
    if (existing) return { error: 'Email sudah terdaftar' };

    const hashed = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    db.prepare(
      "INSERT INTO User (id, name, email, password, phone, role, status, locationId) VALUES (?, ?, ?, ?, ?, 'guard', 'active', ?)"
    ).run(userId, name, email, hashed, phone, locationId || null);

    db.prepare(
      "INSERT INTO Guard (id, name, email, password, phone, locationId) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(crypto.randomUUID(), name, email, hashed, phone, locationId || null);

    return { success: 'Penjaga berhasil ditambahkan' };
  }

  if (intent === 'deactivate') {
    const userId = String(formData.get('userId'));
    db.prepare("UPDATE User SET status = 'inactive' WHERE id = ?").run(userId);
    return { success: 'Penjaga dinonaktifkan' };
  }

  return null;
}

export default function Guards({ loaderData, actionData }: Route.ComponentProps) {
  const { guards, locations } = loaderData;
  const [showAdd, setShowAdd] = useState(false);
  const fetcher = useFetcher();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Penjaga</h1>
          <p className="text-sm text-gray-500">{guards.length} penjaga terdaftar</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-red-600 hover:bg-red-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Tambah Penjaga
        </Button>
      </div>

      {(actionData as any)?.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {(actionData as any).success}
        </div>
      )}
      {(actionData as any)?.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {(actionData as any).error}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nama</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">HP</th>
                <th className="text-left px-4 py-3 font-medium">Lokasi</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">KPI Bln Ini</th>
                <th className="text-left px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {guards.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Belum ada penjaga</td></tr>
              ) : guards.map((g: any) => (
                <tr key={g.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{g.name}</td>
                  <td className="px-4 py-3 text-gray-600">{g.email}</td>
                  <td className="px-4 py-3 text-gray-600">{g.phone || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{g.locationName || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      g.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {g.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium">{Math.round((g.kpiScore || 0) * 100)}%</span>
                  </td>
                  <td className="px-4 py-3">
                    {g.status === 'active' && (
                      <fetcher.Form method="post">
                        <input type="hidden" name="userId" value={g.id} />
                        <input type="hidden" name="intent" value="deactivate" />
                        <button
                          type="submit"
                          className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                          onClick={(e) => { if (!confirm(`Nonaktifkan ${g.name}?`)) e.preventDefault(); }}
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </fetcher.Form>
                    )}
                  </td>
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
            <h2 className="text-lg font-bold">Tambah Penjaga</h2>
            <input type="hidden" name="intent" value="add" />
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Nama</label>
              <Input name="name" placeholder="Nama lengkap" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Email</label>
              <Input name="email" type="email" placeholder="email@example.com" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Password</label>
              <Input name="password" type="password" placeholder="Min 6 karakter" required minLength={6} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Nomor HP</label>
              <Input name="phone" placeholder="08xxxxxxxxxx" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Lokasi</label>
              <select name="locationId" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">-- Pilih Lokasi --</option>
                {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
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
