import { redirect, useFetcher } from 'react-router';
import type { Route } from './+types/dashboard.tenants';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { useState } from 'react';
import { UserX, Eye } from 'lucide-react';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const url = new URL(request.url);
  const filterLocation = url.searchParams.get('location') || '';
  const filterStatus = url.searchParams.get('status') || '';

  let query = `
    SELECT u.*, r.number as roomNumber, r.type as roomType, l.name as locationName, l.id as locationId
    FROM User u
    LEFT JOIN Room r ON r.id = u.roomId
    LEFT JOIN Location l ON l.id = r.locationId
    WHERE u.role = 'tenant'
  `;
  const params: any[] = [];
  if (filterLocation) { query += ' AND l.id = ?'; params.push(filterLocation); }
  if (filterStatus) { query += ' AND u.status = ?'; params.push(filterStatus); }
  query += ' ORDER BY u.createdAt DESC';

  const tenants = db.prepare(query).all(...params) as any[];
  const locations = db.prepare('SELECT * FROM Location').all() as any[];

  return { tenants, locations, filterLocation, filterStatus };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const formData = await request.formData();
  const userId = String(formData.get('userId'));
  const now = new Date().toISOString();

  const tenant = db.prepare('SELECT * FROM User WHERE id = ?').get(userId) as any;
  if (tenant?.roomId) {
    db.prepare("UPDATE Room SET status = 'available' WHERE id = ?").run(tenant.roomId);
  }
  db.prepare("UPDATE User SET status = 'inactive', roomId = NULL, updatedAt = ? WHERE id = ?").run(now, userId);

  return { success: 'Penghuni dinonaktifkan' };
}

const ROOM_TYPE_LABEL: Record<string, string> = {
  ekonomi: 'Ekonomi', standar: 'Standar', suite: 'Suite', deluxe: 'Deluxe',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    inactive: 'bg-gray-100 text-gray-600',
    declined: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    active: 'Aktif', pending: 'Pending', inactive: 'Nonaktif', declined: 'Ditolak',
  };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'bg-gray-100 text-gray-700'}`}>
      {labels[status] || status}
    </span>
  );
}

export default function Tenants({ loaderData, actionData }: Route.ComponentProps) {
  const { tenants, locations, filterLocation, filterStatus } = loaderData;
  const [selected, setSelected] = useState<any>(null);
  const fetcher = useFetcher();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Penghuni</h1>
        <p className="text-sm text-gray-500">{tenants.length} penghuni terdaftar</p>
      </div>

      {(actionData as any)?.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {(actionData as any).success}
        </div>
      )}

      {/* Filters */}
      <form className="flex flex-wrap gap-3">
        <select
          name="location"
          defaultValue={filterLocation}
          onChange={(e) => {
            const form = e.currentTarget.form;
            if (form) form.submit();
          }}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">Semua Lokasi</option>
          {locations.map((l: any) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={filterStatus}
          onChange={(e) => {
            const form = e.currentTarget.form;
            if (form) form.submit();
          }}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="pending">Pending</option>
          <option value="inactive">Nonaktif</option>
        </select>
      </form>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nama</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">HP</th>
                <th className="text-left px-4 py-3 font-medium">Kamar</th>
                <th className="text-left px-4 py-3 font-medium">Lokasi</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Tgl Masuk</th>
                <th className="text-left px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Tidak ada data</td></tr>
              ) : tenants.map((t: any) => (
                <tr key={t.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3 text-gray-600">{t.email}</td>
                  <td className="px-4 py-3 text-gray-600">{t.phone}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {t.roomNumber ? `${t.roomNumber} (${ROOM_TYPE_LABEL[t.roomType] || t.roomType})` : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.locationName || '-'}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(t.createdAt).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelected(t)}
                        className="p-1.5 rounded-lg border hover:bg-gray-50 text-gray-600"
                        title="Detail"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {t.status === 'active' && (
                        <fetcher.Form method="post">
                          <input type="hidden" name="userId" value={t.id} />
                          <button
                            type="submit"
                            className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                            title="Nonaktifkan"
                            onClick={(e) => {
                              if (!confirm(`Nonaktifkan ${t.name}?`)) e.preventDefault();
                            }}
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </fetcher.Form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Detail Penghuni</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Nama', selected.name], ['Email', selected.email], ['HP', selected.phone],
                ['Kamar', selected.roomNumber || '-'], ['Lokasi', selected.locationName || '-'],
                ['Status', selected.status], ['Tgl Masuk', new Date(selected.createdAt).toLocaleDateString('id-ID')],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-medium text-gray-900">{val}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setSelected(null)} className="w-full py-2 border rounded-lg text-sm hover:bg-gray-50">
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
