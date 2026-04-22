import { redirect, useFetcher, useSearchParams } from 'react-router';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { syncSilent, syncTenantsToSheet, syncLogAdmin } from '~/lib/sheets.server';
import { Plus, Pencil, Trash2, X, UserX, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSession(request);
  if (!user || user.role !== 'owner') return redirect('/dashboard');

  const admins = db.prepare("SELECT id, name, email, phone, status, locationId FROM User WHERE role='admin' ORDER BY createdAt DESC").all() as any[];
  const guards = db.prepare("SELECT id, name, email, phone, status, locationId FROM User WHERE role='guard' ORDER BY createdAt DESC").all() as any[];
  const tenants = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.status, u.locationId, r.number as roomNumber, l.name as locationName
    FROM User u
    LEFT JOIN Room r ON r.id = u.roomId
    LEFT JOIN Location l ON l.id = r.locationId
    WHERE u.role = 'tenant'
    ORDER BY u.createdAt DESC
  `).all() as any[];
  const locations = db.prepare("SELECT * FROM Location ORDER BY name").all() as any[];

  return { user, admins, guards, tenants, locations };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getSession(request);
  if (!user || user.role !== 'owner') return redirect('/dashboard');

  const formData = await request.formData();
  const intent = String(formData.get('intent'));

  // --- CREATE USER (admin/guard) ---
  if (intent === 'createUser') {
    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const phone = String(formData.get('phone') || '').trim();
    const role = String(formData.get('role') || 'admin');
    const locationId = String(formData.get('locationId') || '').trim() || null;
    const password = String(formData.get('password') || '').trim();

    if (!name || !email || !password) return { error: 'Nama, email, dan password wajib diisi' };
    const existing = db.prepare('SELECT id FROM User WHERE email=?').get(email);
    if (existing) return { error: 'Email sudah terdaftar' };

    const hashed = await bcrypt.hash(password, 10);
    db.prepare("INSERT INTO User (id, name, email, phone, password, role, status, locationId) VALUES (?,?,?,?,?,?,?,?)")
      .run(crypto.randomUUID(), name, email, phone || null, hashed, role, 'active', locationId);
    syncSilent(() => syncLogAdmin(user.name, `Tambah ${role}`, email, name));
    return { success: `${role === 'admin' ? 'Admin' : 'Guard'} berhasil ditambahkan` };
  }

  // --- EDIT USER ---
  if (intent === 'editUser') {
    const id = String(formData.get('id'));
    const name = String(formData.get('name') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const locationId = String(formData.get('locationId') || '').trim() || null;
    db.prepare("UPDATE User SET name=?, phone=?, locationId=? WHERE id=?").run(name, phone || null, locationId, id);
    syncSilent(() => syncLogAdmin(user.name, 'Edit User', id, name));
    return { success: 'User berhasil diperbarui' };
  }

  // --- RESET PASSWORD ---
  if (intent === 'resetPassword') {
    const id = String(formData.get('id'));
    const targetUser = db.prepare('SELECT name, email FROM User WHERE id=?').get(id) as any;
    const newPwd = generatePassword();
    const hashed = await bcrypt.hash(newPwd, 10);
    db.prepare("UPDATE User SET password=?, mustChangePassword=1 WHERE id=?").run(hashed, id);
    console.log(`[reset-password] User: ${targetUser?.email} | Password baru: ${newPwd}`);
    syncSilent(() => syncLogAdmin(user.name, 'Reset Password', targetUser?.email || id, 'mustChangePassword=1'));
    return { success: `Password direset. Password baru: ${newPwd} (catat & berikan ke user)` };
  }

  // --- TOGGLE STATUS ---
  if (intent === 'toggleStatus') {
    const id = String(formData.get('id'));
    const currentStatus = String(formData.get('currentStatus'));
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    db.prepare("UPDATE User SET status=? WHERE id=?").run(newStatus, id);
    syncSilent(async () => {
      await syncTenantsToSheet();
      await syncLogAdmin(user.name, `${newStatus === 'active' ? 'Aktifkan' : 'Nonaktifkan'} User`, id, newStatus);
    });
    return { success: `Status user diperbarui menjadi ${newStatus}` };
  }

  // --- DELETE USER ---
  if (intent === 'deleteUser') {
    const id = String(formData.get('id'));
    const targetUser = db.prepare('SELECT name, role FROM User WHERE id=?').get(id) as any;
    if (targetUser?.role === 'owner') return { error: 'Tidak bisa menghapus owner' };
    db.prepare("DELETE FROM Session WHERE userId=?").run(id);
    db.prepare("DELETE FROM User WHERE id=?").run(id);
    syncSilent(() => syncLogAdmin(user.name, 'Hapus User', id, targetUser?.name || ''));
    return { success: 'User dihapus' };
  }

  // --- CHANGE OWN PASSWORD ---
  if (intent === 'changeOwnPassword') {
    const oldPassword = String(formData.get('oldPassword') || '');
    const newPassword = String(formData.get('newPassword') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');

    if (newPassword !== confirmPassword) return { error: 'Password baru tidak cocok' };
    if (newPassword.length < 8) return { error: 'Password minimal 8 karakter' };

    const dbUser = db.prepare('SELECT password FROM User WHERE id=?').get(user.id) as any;
    const valid = dbUser?.password ? await bcrypt.compare(oldPassword, dbUser.password) : false;
    if (!valid) return { error: 'Password lama salah' };

    const hashed = await bcrypt.hash(newPassword, 10);
    db.prepare("UPDATE User SET password=? WHERE id=?").run(hashed, user.id);
    syncSilent(() => syncLogAdmin(user.name, 'Ganti Password Sendiri', user.email, ''));
    return { success: 'Password berhasil diperbarui' };
  }

  return null;
}

const TABS = [
  { id: 'admin', label: 'Admin' },
  { id: 'guard', label: 'Guard' },
  { id: 'tenant', label: 'Penghuni' },
  { id: 'owner', label: 'Akun Saya' },
];

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col z-10">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
      </div>
    </div>
  );
}

export default function AccountsManagement({ loaderData, actionData }: { loaderData: any; actionData: any }) {
  const { user, admins, guards, tenants, locations } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'admin';
  const msg = (actionData as any)?.success || '';
  const err = (actionData as any)?.error || '';

  function setTab(id: string) { setSearchParams({ tab: id }); }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Manajemen Akun</h1>
        <p className="text-sm text-gray-500 mt-1">Kelola akun admin, guard, dan penghuni.</p>
      </div>

      {msg && <div className="mb-4 p-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">{msg}</div>}
      {err && <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{err}</div>}

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
        <div className="flex gap-1 border-b min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] ${
                activeTab === tab.id ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'admin' && <UserTab users={admins} role="admin" locations={locations} />}
      {activeTab === 'guard' && <UserTab users={guards} role="guard" locations={locations} showLocation />}
      {activeTab === 'tenant' && <TenantTab tenants={tenants} />}
      {activeTab === 'owner' && <OwnerTab ownerName={user.name} />}
    </div>
  );
}

// ============ USER TAB (Admin / Guard) ============
function UserTab({ users, role, locations, showLocation }: { users: any[]; role: string; locations: any[]; showLocation?: boolean }) {
  const fetcher = useFetcher();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [resetMsg, setResetMsg] = useState('');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 capitalize">{role === 'admin' ? 'Admin' : 'Guard'}</h2>
        <Button onClick={() => setCreateOpen(true)} className="bg-red-600 hover:bg-red-700 text-white gap-2 text-sm min-h-[44px]">
          <Plus size={16} />Tambah {role === 'admin' ? 'Admin' : 'Guard'}
        </Button>
      </div>

      {resetMsg && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-yellow-50 text-yellow-800 border border-yellow-200 break-all">{resetMsg}</div>
      )}

      {/* Card view on mobile, table on desktop */}
      <div className="block sm:hidden space-y-3">
        {users.map((u: any) => (
          <div key={u.id} className="bg-white rounded-xl border p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">{u.name}</p>
                <p className="text-xs text-gray-500">{u.email}</p>
                {u.phone && <p className="text-xs text-gray-500">{u.phone}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {u.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => { setEditing(u); setEditOpen(true); }} className="flex items-center gap-1 text-xs text-blue-600 hover:underline min-h-[36px] px-2">
                <Pencil size={12} />Edit
              </button>
              <fetcher.Form method="post" onSubmit={(e) => {
                e.preventDefault();
                fetcher.submit(e.currentTarget);
                setTimeout(() => {
                  const fd = new FormData(e.currentTarget as HTMLFormElement);
                  const msg = `Password direset. Lihat pesan sukses di atas.`;
                  setResetMsg(msg);
                }, 100);
              }}>
                <input type="hidden" name="intent" value="resetPassword" />
                <input type="hidden" name="id" value={u.id} />
                <button type="submit" className="flex items-center gap-1 text-xs text-orange-600 hover:underline min-h-[36px] px-2">
                  <KeyRound size={12} />Reset PWD
                </button>
              </fetcher.Form>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="toggleStatus" />
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="currentStatus" value={u.status} />
                <button type="submit" className="flex items-center gap-1 text-xs text-gray-600 hover:underline min-h-[36px] px-2">
                  <UserX size={12} />{u.status === 'active' ? 'Nonaktif' : 'Aktifkan'}
                </button>
              </fetcher.Form>
              <fetcher.Form method="post" onSubmit={(e) => { if (!confirm('Hapus user ini?')) e.preventDefault(); }}>
                <input type="hidden" name="intent" value="deleteUser" />
                <input type="hidden" name="id" value={u.id} />
                <button type="submit" className="flex items-center gap-1 text-xs text-red-600 hover:underline min-h-[36px] px-2">
                  <Trash2 size={12} />Hapus
                </button>
              </fetcher.Form>
            </div>
          </div>
        ))}
      </div>

      {/* Table on desktop */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">HP</th>
              {showLocation && <th className="text-left px-4 py-3 font-medium text-gray-600">Lokasi</th>}
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {users.map((u: any) => {
              const loc = locations.find((l: any) => l.id === u.locationId);
              return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600">{u.phone || '-'}</td>
                  {showLocation && <td className="px-4 py-3 text-gray-600">{loc?.name || '-'}</td>}
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => { setEditing(u); setEditOpen(true); }} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="resetPassword" />
                        <input type="hidden" name="id" value={u.id} />
                        <button type="submit" className="p-1.5 hover:bg-orange-50 text-orange-600 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center" title="Reset Password">
                          <KeyRound size={14} />
                        </button>
                      </fetcher.Form>
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="toggleStatus" />
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="currentStatus" value={u.status} />
                        <button type="submit" className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center" title={u.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}>
                          <UserX size={14} />
                        </button>
                      </fetcher.Form>
                      <fetcher.Form method="post" onSubmit={(e) => { if (!confirm('Hapus user ini?')) e.preventDefault(); }}>
                        <input type="hidden" name="intent" value="deleteUser" />
                        <input type="hidden" name="id" value={u.id} />
                        <button type="submit" className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center" title="Hapus">
                          <Trash2 size={14} />
                        </button>
                      </fetcher.Form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={`Tambah ${role === 'admin' ? 'Admin' : 'Guard'}`}>
        <fetcher.Form method="post" onSubmit={() => setCreateOpen(false)} className="space-y-4">
          <input type="hidden" name="intent" value="createUser" />
          <input type="hidden" name="role" value={role} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
            <Input name="name" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input type="email" name="email" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nomor HP</label>
            <Input name="phone" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <Input type="password" name="password" minLength={8} required placeholder="Min. 8 karakter" />
          </div>
          {showLocation && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi Bertugas</label>
              <select name="locationId" className="w-full border rounded-lg px-3 py-2 text-sm min-h-[44px]">
                <option value="">Pilih Lokasi</option>
                {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white min-h-[44px]">Tambah</Button>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="flex-1 min-h-[44px]">Batal</Button>
          </div>
        </fetcher.Form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit User">
        <fetcher.Form method="post" onSubmit={() => setEditOpen(false)} className="space-y-4">
          <input type="hidden" name="intent" value="editUser" />
          <input type="hidden" name="id" value={editing?.id} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
            <Input name="name" defaultValue={editing?.name || ''} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HP</label>
            <Input name="phone" defaultValue={editing?.phone || ''} />
          </div>
          {showLocation && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi Bertugas</label>
              <select name="locationId" defaultValue={editing?.locationId || ''} className="w-full border rounded-lg px-3 py-2 text-sm min-h-[44px]">
                <option value="">Pilih Lokasi</option>
                {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white min-h-[44px]">Simpan</Button>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="flex-1 min-h-[44px]">Batal</Button>
          </div>
        </fetcher.Form>
      </Modal>
    </div>
  );
}

// ============ TENANT TAB ============
function TenantTab({ tenants }: { tenants: any[] }) {
  const fetcher = useFetcher();
  const [filterStatus, setFilterStatus] = useState('');

  const filtered = tenants.filter((t: any) => !filterStatus || t.status === filterStatus);

  return (
    <div>
      <h2 className="font-semibold text-gray-900 mb-4">Penghuni</h2>
      <div className="flex gap-3 mb-4">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm min-h-[44px]">
          <option value="">Semua Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="inactive">Inactive</option>
        </select>
        <span className="text-sm text-gray-500 flex items-center">{filtered.length} penghuni</span>
      </div>

      {/* Card on mobile */}
      <div className="block sm:hidden space-y-3">
        {filtered.map((t: any) => (
          <div key={t.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-500">{t.email}</p>
                <p className="text-xs text-gray-500">{t.locationName || '-'} {t.roomNumber ? `• Kamar ${t.roomNumber}` : ''}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${t.status === 'active' ? 'bg-green-100 text-green-700' : t.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                {t.status}
              </span>
            </div>
            <div className="flex gap-2">
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="resetPassword" />
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" className="text-xs text-orange-600 hover:underline min-h-[36px] px-2 flex items-center gap-1">
                  <KeyRound size={12} />Reset PWD
                </button>
              </fetcher.Form>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="toggleStatus" />
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="currentStatus" value={t.status} />
                <button type="submit" className="text-xs text-gray-600 hover:underline min-h-[36px] px-2 flex items-center gap-1">
                  <UserX size={12} />{t.status === 'active' ? 'Nonaktif' : 'Aktifkan'}
                </button>
              </fetcher.Form>
            </div>
          </div>
        ))}
      </div>

      {/* Table on desktop */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Kamar</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Lokasi</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {filtered.map((t: any) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-gray-600">{t.email}</td>
                <td className="px-4 py-3">{t.roomNumber || '-'}</td>
                <td className="px-4 py-3">{t.locationName || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'active' ? 'bg-green-100 text-green-700' : t.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="resetPassword" />
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" className="p-1.5 hover:bg-orange-50 text-orange-600 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center" title="Reset Password">
                        <KeyRound size={14} />
                      </button>
                    </fetcher.Form>
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="toggleStatus" />
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="currentStatus" value={t.status} />
                      <button type="submit" className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center" title={t.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}>
                        <UserX size={14} />
                      </button>
                    </fetcher.Form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ OWNER TAB ============
function OwnerTab({ ownerName }: { ownerName: string }) {
  const fetcher = useFetcher();
  const msg = (fetcher.data as any)?.success || '';
  const err = (fetcher.data as any)?.error || '';

  return (
    <div className="max-w-md">
      <h2 className="font-semibold text-gray-900 mb-4">Ganti Password ({ownerName})</h2>
      {msg && <div className="mb-4 p-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">{msg}</div>}
      {err && <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{err}</div>}
      <fetcher.Form method="post" className="bg-white rounded-xl border p-5 space-y-4">
        <input type="hidden" name="intent" value="changeOwnPassword" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password Lama</label>
          <Input type="password" name="oldPassword" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
          <Input type="password" name="newPassword" minLength={8} required placeholder="Min. 8 karakter" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
          <Input type="password" name="confirmPassword" required />
        </div>
        <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white min-h-[44px]">
          Simpan Password Baru
        </Button>
      </fetcher.Form>
    </div>
  );
}
