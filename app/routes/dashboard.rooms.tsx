import { redirect, useFetcher } from 'react-router';
import type { Route } from './+types/dashboard.rooms';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { useState } from 'react';
import { Edit2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const url = new URL(request.url);
  const filterLocation = url.searchParams.get('location') || '';
  const filterType = url.searchParams.get('type') || '';
  const filterStatus = url.searchParams.get('status') || '';

  let query = `
    SELECT r.*, l.name as locationName, u.name as tenantName
    FROM Room r
    LEFT JOIN Location l ON l.id = r.locationId
    LEFT JOIN User u ON u.roomId = r.id AND u.status = 'active'
    WHERE 1=1
  `;
  const params: any[] = [];
  if (filterLocation) { query += ' AND r.locationId = ?'; params.push(filterLocation); }
  if (filterType) { query += ' AND r.type = ?'; params.push(filterType); }
  if (filterStatus) { query += ' AND r.status = ?'; params.push(filterStatus); }
  query += ' ORDER BY r.locationId, r.type, r.number';

  const rooms = db.prepare(query).all(...params) as any[];
  const locations = db.prepare('SELECT * FROM Location').all() as any[];

  return { rooms, locations, filterLocation, filterType, filterStatus };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const formData = await request.formData();
  const intent = String(formData.get('intent'));
  const roomId = String(formData.get('roomId'));

  if (intent === 'updateStatus') {
    const status = String(formData.get('status'));
    db.prepare('UPDATE Room SET status = ? WHERE id = ?').run(status, roomId);
    return { success: 'Status kamar diperbarui' };
  }

  if (intent === 'updatePrice') {
    const price = Number(formData.get('price'));
    const priceDouble = Number(formData.get('priceDouble'));
    if (price > 0) db.prepare('UPDATE Room SET price = ?, priceDouble = ? WHERE id = ?').run(price, priceDouble, roomId);
    return { success: 'Harga kamar diperbarui' };
  }

  return null;
}

const ROOM_TYPE_LABEL: Record<string, string> = {
  ekonomi: 'Ekonomi', standar: 'Standar', suite: 'Suite', deluxe: 'Deluxe',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    occupied: 'bg-blue-100 text-blue-700',
    maintenance: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    available: 'Kosong', occupied: 'Terisi', maintenance: 'Maintenance',
  };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'bg-gray-100 text-gray-700'}`}>
      {labels[status] || status}
    </span>
  );
}

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function Rooms({ loaderData, actionData }: Route.ComponentProps) {
  const { rooms, locations, filterLocation, filterType, filterStatus } = loaderData;
  const fetcher = useFetcher();
  const [editRoom, setEditRoom] = useState<any>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Kamar</h1>
        <p className="text-sm text-gray-500">{rooms.length} kamar ditampilkan</p>
      </div>

      {(actionData as any)?.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {(actionData as any).success}
        </div>
      )}

      <form className="flex flex-wrap gap-3">
        <select name="location" defaultValue={filterLocation} onChange={(e) => e.currentTarget.form?.submit()}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="">Semua Lokasi</option>
          {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select name="type" defaultValue={filterType} onChange={(e) => e.currentTarget.form?.submit()}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="">Semua Tipe</option>
          {['ekonomi','standar','suite','deluxe'].map(t => <option key={t} value={t}>{ROOM_TYPE_LABEL[t]}</option>)}
        </select>
        <select name="status" defaultValue={filterStatus} onChange={(e) => e.currentTarget.form?.submit()}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="">Semua Status</option>
          <option value="available">Kosong</option>
          <option value="occupied">Terisi</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </form>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">No Kamar</th>
                <th className="text-left px-4 py-3 font-medium">Tipe</th>
                <th className="text-left px-4 py-3 font-medium">Harga 1 Org</th>
                <th className="text-left px-4 py-3 font-medium">Harga 2 Org</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Penghuni</th>
                <th className="text-left px-4 py-3 font-medium">Lokasi</th>
                <th className="text-left px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Tidak ada data</td></tr>
              ) : rooms.map((r: any) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.number}</td>
                  <td className="px-4 py-3 text-gray-600">{ROOM_TYPE_LABEL[r.type] || r.type}</td>
                  <td className="px-4 py-3 text-gray-600">{formatRp(r.price)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatRp(r.priceDouble)}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-gray-600">{r.tenantName || '-'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.locationName}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditRoom(r)}
                        className="p-1.5 rounded-lg border hover:bg-gray-50 text-gray-600"
                        title="Edit harga"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <fetcher.Form method="post">
                        <input type="hidden" name="roomId" value={r.id} />
                        <input type="hidden" name="intent" value="updateStatus" />
                        <select
                          name="status"
                          defaultValue={r.status}
                          onChange={(e) => {
                            const form = e.currentTarget.form;
                            if (form) fetcher.submit(form);
                          }}
                          className="border rounded px-2 py-1 text-xs focus:outline-none"
                        >
                          <option value="available">Kosong</option>
                          <option value="occupied">Terisi</option>
                          <option value="maintenance">Maintenance</option>
                        </select>
                      </fetcher.Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Price Modal */}
      {editRoom && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <fetcher.Form
            method="post"
            onSubmit={() => setEditRoom(null)}
            className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4"
          >
            <h2 className="text-lg font-bold">Edit Harga — {editRoom.number}</h2>
            <input type="hidden" name="roomId" value={editRoom.id} />
            <input type="hidden" name="intent" value="updatePrice" />
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Harga 1 Orang (Rp)</label>
              <Input type="number" name="price" defaultValue={editRoom.price} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Harga 2 Orang (Rp)</label>
              <Input type="number" name="priceDouble" defaultValue={editRoom.priceDouble} />
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white">Simpan</Button>
              <Button type="button" variant="outline" onClick={() => setEditRoom(null)}>Batal</Button>
            </div>
          </fetcher.Form>
        </div>
      )}
    </div>
  );
}
