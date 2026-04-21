import { redirect, Outlet, NavLink } from 'react-router';
import type { Route } from './+types/dashboard';
import { getSession } from '~/lib/auth.server';
import {
  LayoutDashboard, Clock, Users, DoorOpen, CreditCard, WashingMachine,
  MessageSquare, Receipt, BarChart2, Shield, FileText, Settings, LogOut, Menu, BookOpen,
} from 'lucide-react';
import { useState } from 'react';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user) return redirect('/login');
  if (user.role !== 'owner' && user.role !== 'admin') return redirect('/login');
  return { user };
}

const NAV_ITEMS = [
  { to: '/dashboard', end: true, icon: LayoutDashboard, label: 'Ringkasan' },
  { to: '/dashboard/pending', icon: Clock, label: 'Pending Approval' },
  { to: '/dashboard/tenants', icon: Users, label: 'Penghuni' },
  { to: '/dashboard/rooms', icon: DoorOpen, label: 'Kamar' },
  { to: '/dashboard/payments', icon: CreditCard, label: 'Pembayaran' },
  { to: '/dashboard/laundry', icon: WashingMachine, label: 'Laundry' },
  { to: '/dashboard/complaints', icon: MessageSquare, label: 'Komplain' },
  { to: '/dashboard/expenses', icon: Receipt, label: 'Pengeluaran' },
  { to: '/dashboard/kpi', icon: BarChart2, label: 'KPI Penjaga' },
  { to: '/dashboard/guards', icon: Shield, label: 'Penjaga' },
  { to: '/dashboard/report', icon: FileText, label: 'Laporan' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

function SidebarContent({ user, onClose }: { user: any; onClose?: () => void }) {
  return (
    <aside className="flex flex-col h-full bg-white">
      <div className="p-4 border-b">
        <a href="/">
          <img src="/images/logo/logo.png" alt="Mitra Kost" className="h-9" />
        </a>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-red-50 text-red-600 border-l-2 border-red-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-2 border-transparent'
              }`
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t space-y-2">
        <div className="space-y-1">
          <a
            href="/guides/owner-guide.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-red-600 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Panduan Owner
          </a>
          <a
            href="/guides/admin-guide.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-red-600 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Panduan Admin
          </a>
        </div>
        <div className="border-t pt-2">
          <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
          <span className="inline-block mt-1 mb-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full capitalize">
            {user.role}
          </span>
          <a
            href="/logout"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </a>
        </div>
      </div>
    </aside>
  );
}

export default function DashboardLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-56 xl:w-64 border-r shrink-0">
        <SidebarContent user={user} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 z-50">
            <SidebarContent user={user} onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1 rounded-lg hover:bg-gray-100"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img src="/images/logo/logo.png" alt="Mitra Kost" className="h-8" />
        </div>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
