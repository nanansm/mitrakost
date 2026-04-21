import { redirect } from 'react-router';
import type { Route } from './+types/tenant.info';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { Wifi, Phone, AlertTriangle, Mail, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user || user.role !== 'tenant') return redirect('/login');

  const fullUser = db.prepare('SELECT * FROM User WHERE id = ?').get(user.id) as any;
  const room = fullUser?.roomId
    ? (db.prepare('SELECT r.*, l.id as locationId, l.name as locationName FROM Room r LEFT JOIN Location l ON l.id = r.locationId WHERE r.id = ?').get(fullUser.roomId) as any)
    : null;

  const getSiteInfo = (key: string) =>
    (db.prepare('SELECT value FROM SiteInfo WHERE key = ?').get(key) as any)?.value || '';

  const locationId = room?.locationId;
  const wifiKey = locationId === 'budiasih' ? 'wifi_password_budiasih'
    : locationId === 'jatihurip' ? 'wifi_password_jatihurip'
    : 'wifi_password_budiasih';

  const info = {
    wifiPassword: getSiteInfo(wifiKey),
    kontakAdmin: getSiteInfo('kontak_admin'),
    whatsappAdmin: getSiteInfo('whatsapp_admin'),
    emailAdmin: getSiteInfo('email_admin'),
    kontakDarurat: getSiteInfo('kontak_darurat'),
  };

  // Get guard for this location
  const guard = locationId
    ? (db.prepare("SELECT u.* FROM User u WHERE u.role = 'guard' AND u.locationId = ? AND u.status = 'active' LIMIT 1").get(locationId) as any)
    : null;

  return { info, guard, room };
}

function ContactCard({
  title,
  value,
  phone,
  whatsapp,
}: {
  title: string;
  value: string;
  phone?: string;
  whatsapp?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-500">{title}</p>
        <p className="font-medium text-gray-900">{value}</p>
      </div>
      <div className="flex gap-2">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
          >
            <Phone className="w-4 h-4" />
            Hubungi
          </a>
        )}
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
          >
            WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

export default function TenantInfo({ loaderData }: Route.ComponentProps) {
  const { info, guard, room } = loaderData;
  const [showWifi, setShowWifi] = useState(false);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Info Kost</h1>

      {/* WiFi */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Wifi className="w-5 h-5 text-red-600" />
          <h2 className="font-semibold text-gray-900">Password WiFi</h2>
          {room && <span className="text-xs text-gray-400">— {room.locationName}</span>}
        </div>
        <div className="flex items-center gap-3">
          <code className="flex-1 px-3 py-2 bg-gray-50 border rounded-lg text-sm font-mono">
            {showWifi ? info.wifiPassword : '••••••••••••'}
          </code>
          <button
            onClick={() => setShowWifi(!showWifi)}
            className="p-2 border rounded-lg hover:bg-gray-50"
          >
            {showWifi ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Kontak Penting */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Phone className="w-5 h-5 text-red-600" />
          <h2 className="font-semibold text-gray-900">Kontak Penting</h2>
        </div>
        <ContactCard
          title="Admin Mitra Kost"
          value={info.kontakAdmin}
          phone={info.kontakAdmin}
          whatsapp={info.whatsappAdmin}
        />
        {guard && (
          <ContactCard
            title={`Penjaga Kost — ${room?.locationName}`}
            value={guard.name}
            phone={guard.phone}
          />
        )}
        <ContactCard
          title="Nomor Darurat"
          value={info.kontakDarurat}
          phone={info.kontakDarurat}
        />
        {info.emailAdmin && (
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <a href={`mailto:${info.emailAdmin}`} className="text-sm text-red-600 hover:underline">
              {info.emailAdmin}
            </a>
          </div>
        )}
      </div>

      {/* Aturan */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          <h2 className="font-semibold text-gray-900">Aturan Kost</h2>
        </div>
        <ul className="space-y-2 text-sm text-gray-700">
          {[
            'Tidak diperkenankan membawa tamu menginap tanpa izin.',
            'Jam malam: pintu dikunci pukul 22.00 WIB.',
            'Dilarang membuat keributan yang mengganggu penghuni lain.',
            'Sampah wajib dibuang di tempat yang telah disediakan.',
            'Pembayaran sewa dilakukan paling lambat tanggal 5 setiap bulan.',
            'Kerusakan akibat kelalaian penghuni menjadi tanggung jawab penghuni.',
          ].map((rule, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-red-600 font-bold shrink-0">{i + 1}.</span>
              {rule}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
