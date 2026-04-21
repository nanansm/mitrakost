import { redirect, Outlet, NavLink } from 'react-router';
import type { Route } from './+types/tenant';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { CreditCard, MessageSquare, Info, DoorOpen, LogOut, Menu, BookOpen } from 'lucide-react';
import { useState } from 'react';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user) return redirect('/login');
  if (user.role !== 'tenant') return redirect('/login');

  // Get full user with roomId
  const fullUser = db.prepare('SELECT * FROM User WHERE id = ?').get(user.id) as any;
  const userRoom = fullUser?.roomId
    ? (db.prepare('SELECT r.*, l.name as locationName, l.id as locationId FROM Room r LEFT JOIN Location l ON l.id = r.locationId WHERE r.id = ?').get(fullUser.roomId) as any)
    : null;

  return { user, userRoom };
}

const NAV = [
  { to: '/tenant', end: true, icon: CreditCard, label: 'Tagihan' },
  { to: '/tenant/complaints', icon: MessageSquare, label: 'Komplain' },
  { to: '/tenant/info', icon: Info, label: 'Info Kost' },
  { to: '/tenant/rooms', icon: DoorOpen, label: 'Kamar Kosong' },
];

export default function TenantLayout({ loaderData }: Route.ComponentProps) {
  const { user, userRoom } = loaderData;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/logo/logo.png" alt="Mitra Kost" className="h-8" />
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">
                {userRoom ? `${userRoom.locationName} — Kamar ${userRoom.number}` : 'Belum ada kamar'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/guides/tenant-guide.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors"
              title="Panduan Penghuni"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Panduan</span>
            </a>
            <a href="/logout" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </a>
          </div>
        </div>
        {/* Tab Nav */}
        <div className="max-w-4xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? 'border-red-600 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
