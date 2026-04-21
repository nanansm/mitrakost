import { redirect } from 'react-router';
import type { Route } from './+types/dashboard._index';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { TrendingUp, Home, DoorOpen, Users, Wallet, ArrowUpRight } from 'lucide-react';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const locations = db.prepare('SELECT * FROM Location').all() as any[];

  const stats = locations.map((loc) => {
    const total = (db.prepare("SELECT COUNT(*) as c FROM Room WHERE locationId = ?").get(loc.id) as any).c;
    const occupied = (db.prepare("SELECT COUNT(*) as c FROM Room WHERE locationId = ? AND status = 'occupied'").get(loc.id) as any).c;
    return { ...loc, total, occupied, available: total - occupied };
  });

  const totalRooms = stats.reduce((s, l) => s + l.total, 0);
  const totalOccupied = stats.reduce((s, l) => s + l.occupied, 0);
  const totalAvailable = stats.reduce((s, l) => s + l.available, 0);
  const occupancyRate = totalRooms > 0 ? Math.round((totalOccupied / totalRooms) * 100) : 0;

  const pemasukan = (db.prepare(
    "SELECT COALESCE(SUM(amount),0) as t FROM Payment WHERE month = ? AND status = 'paid'"
  ).get(month) as any).t;

  const pengeluaran = (db.prepare(
    "SELECT COALESCE(SUM(amount),0) as t FROM Expense WHERE date LIKE ?"
  ).get(`${month}%`) as any).t;

  const laba = pemasukan - pengeluaran;

  const pending = db.prepare(
    `SELECT tf.*, u.name, u.email, u.phone, r.number as roomNumber, r.type as roomType, l.name as locationName
     FROM TenantForm tf
     JOIN User u ON u.id = tf.userId
     LEFT JOIN Room r ON r.id = tf.roomId
     LEFT JOIN Location l ON l.id = tf.locationId
     WHERE tf.status = 'pending'
     ORDER BY tf.createdAt DESC
     LIMIT 5`
  ).all() as any[];

  return { stats, totalRooms, totalOccupied, totalAvailable, occupancyRate, pemasukan, pengeluaran, laba, pending, month };
}

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

const ROOM_TYPE_LABEL: Record<string, string> = {
  ekonomi: 'Ekonomi', standar: 'Standar', suite: 'Suite', deluxe: 'Deluxe',
};

export default function DashboardIndex({ loaderData }: Route.ComponentProps) {
  const { stats, totalRooms, totalOccupied, totalAvailable, occupancyRate, pemasukan, pengeluaran, laba, pending, month } = loaderData;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Ringkasan</h1>
        <p className="text-sm text-gray-500 mt-0.5">Ikhtisar operasional Mitra Kost</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Kamar', value: totalRooms, icon: Home, color: 'text-blue-600 bg-blue-50' },
          { label: 'Terisi', value: totalOccupied, icon: Users, color: 'text-green-600 bg-green-50' },
          { label: 'Kosong', value: totalAvailable, icon: DoorOpen, color: 'text-yellow-600 bg-yellow-50' },
          { label: 'Occupancy', value: `${occupancyRate}%`, icon: TrendingUp, color: 'text-red-600 bg-red-50' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${c.color}`}>
              <c.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-xl font-bold text-gray-900">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Per Lokasi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {stats.map((loc: any) => (
          <div key={loc.id} className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">{loc.name}</h3>
            <div className="flex gap-4 text-sm">
              <div><p className="text-gray-500">Total</p><p className="font-bold">{loc.total}</p></div>
              <div><p className="text-gray-500">Terisi</p><p className="font-bold text-green-600">{loc.occupied}</p></div>
              <div><p className="text-gray-500">Kosong</p><p className="font-bold text-yellow-600">{loc.available}</p></div>
              <div>
                <p className="text-gray-500">Occupancy</p>
                <p className="font-bold text-red-600">
                  {loc.total > 0 ? Math.round((loc.occupied / loc.total) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Keuangan Bulan Ini */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Pemasukan', value: formatRp(pemasukan), color: 'text-green-700 bg-green-50 border-green-200' },
          { label: 'Pengeluaran', value: formatRp(pengeluaran), color: 'text-red-700 bg-red-50 border-red-200' },
          { label: 'Laba Bersih', value: formatRp(laba), color: laba >= 0 ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200' },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
            <p className="text-xs font-medium mb-1">{c.label} ({month})</p>
            <p className="text-xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Pending Terbaru */}
      {pending.length > 0 && (
        <div className="bg-white rounded-xl border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Pendaftaran Terbaru</h2>
            <a href="/dashboard/pending" className="text-xs text-red-600 hover:underline flex items-center gap-1">
              Lihat semua <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Nama</th>
                  <th className="text-left px-4 py-2 font-medium">Kamar</th>
                  <th className="text-left px-4 py-2 font-medium">Lokasi</th>
                  <th className="text-left px-4 py-2 font-medium">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p: any) => (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.roomNumber} ({ROOM_TYPE_LABEL[p.roomType] || p.roomType})</td>
                    <td className="px-4 py-3 text-gray-600">{p.locationName}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(p.createdAt).toLocaleDateString('id-ID')}</td>
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
