import { redirect } from 'react-router';
import type { Route } from './+types/tenant.rooms';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { Share2 } from 'lucide-react';

const ROOM_TYPE_LABEL: Record<string, string> = {
  ekonomi: 'Ekonomi', standar: 'Standar', suite: 'Suite', deluxe: 'Deluxe',
};

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user || user.role !== 'tenant') return redirect('/login');

  const rooms = db.prepare(
    `SELECT r.*, l.name as locationName
     FROM Room r LEFT JOIN Location l ON l.id = r.locationId
     WHERE r.status = 'available'
     ORDER BY r.locationId, r.type, r.number`
  ).all() as any[];

  const publicUrl = process.env.PUBLIC_URL || 'https://mitrakost.essentiallyour.com';

  return { rooms, publicUrl };
}

export default function TenantRooms({ loaderData }: Route.ComponentProps) {
  const { rooms, publicUrl } = loaderData;

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(publicUrl);
      alert('Link berhasil disalin!');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Kamar Kosong</h1>
          <p className="text-sm text-gray-500">{rooms.length} kamar tersedia</p>
        </div>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
        >
          <Share2 className="w-4 h-4" />
          Bagikan ke Teman
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
          Semua kamar sedang terisi
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rooms.map((r: any) => (
            <div key={r.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900">Kamar {r.number}</p>
                  <p className="text-sm text-gray-500">{r.locationName}</p>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  Tersedia
                </span>
              </div>
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-gray-500 mb-1">{ROOM_TYPE_LABEL[r.type] || r.type}</p>
                <p className="text-sm">
                  <span className="font-bold text-gray-900">{formatRp(r.price)}</span>
                  <span className="text-gray-400">/bln (1 org)</span>
                </p>
                {r.priceDouble > 0 && (
                  <p className="text-sm text-gray-500">{formatRp(r.priceDouble)}/bln (2 org)</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
