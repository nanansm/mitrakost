import { redirect } from 'react-router';
import type { Route } from './+types/tenant._index';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { CreditCard, WashingMachine } from 'lucide-react';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user || user.role !== 'tenant') return redirect('/login');

  const fullUser = db.prepare('SELECT * FROM User WHERE id = ?').get(user.id) as any;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const rentThisMonth = db.prepare(
    "SELECT * FROM Payment WHERE userId = ? AND type = 'rent' AND month = ? ORDER BY createdAt DESC LIMIT 1"
  ).get(user.id, currentMonth) as any;

  const laundryThisMonth = (db.prepare(
    "SELECT COALESCE(SUM(total),0) as t FROM Laundry WHERE userId = ? AND createdAt LIKE ?"
  ).get(user.id, `${currentMonth}%`) as any).t;

  const history = db.prepare(
    "SELECT * FROM Payment WHERE userId = ? ORDER BY createdAt DESC LIMIT 12"
  ).all(user.id) as any[];

  const room = fullUser?.roomId
    ? (db.prepare('SELECT r.*, l.name as locationName FROM Room r LEFT JOIN Location l ON l.id = r.locationId WHERE r.id = ?').get(fullUser.roomId) as any)
    : null;

  return { user, fullUser, rentThisMonth, laundryThisMonth, history, room, currentMonth };
}

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    unpaid: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'bg-gray-100'}`}>
      {status === 'paid' ? 'Lunas' : 'Belum Lunas'}
    </span>
  );
}

export default function TenantIndex({ loaderData }: Route.ComponentProps) {
  const { user, rentThisMonth, laundryThisMonth, history, room, currentMonth } = loaderData;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Selamat datang, {user.name}!</h1>
        {room && (
          <p className="text-sm text-gray-500 mt-0.5">
            {room.locationName} — Kamar {room.number}
          </p>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-red-50 rounded-xl">
              <CreditCard className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Sewa Bulan Ini ({currentMonth})</p>
              <p className="font-bold text-gray-900">
                {rentThisMonth ? formatRp(rentThisMonth.amount) : '-'}
              </p>
            </div>
          </div>
          {rentThisMonth ? (
            <StatusBadge status={rentThisMonth.status} />
          ) : (
            <span className="text-xs text-gray-400">Belum ada tagihan</span>
          )}
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-blue-50 rounded-xl">
              <WashingMachine className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Laundry Bulan Ini</p>
              <p className="font-bold text-gray-900">{formatRp(laundryThisMonth)}</p>
            </div>
          </div>
          <span className="text-xs text-gray-400">Total laundry {currentMonth}</span>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-xl border">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-900">Riwayat Pembayaran</h2>
        </div>
        {history.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-400 text-sm">Belum ada riwayat pembayaran</p>
        ) : (
          <div className="divide-y">
            {history.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 capitalize">{p.type}</p>
                  <p className="text-xs text-gray-500">{p.month || new Date(p.createdAt).toLocaleDateString('id-ID')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{formatRp(p.amount)}</p>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
