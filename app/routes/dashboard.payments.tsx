import { redirect, useFetcher } from 'react-router';
import type { Route } from './+types/dashboard.payments';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { useState } from 'react';
import { Plus, CheckCircle } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import crypto from 'crypto';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const url = new URL(request.url);
  const filterMonth = url.searchParams.get('month') || '';
  const filterStatus = url.searchParams.get('status') || '';

  let query = `
    SELECT p.*, u.name as tenantName
    FROM Payment p
    JOIN User u ON u.id = p.userId
    WHERE 1=1
  `;
  const params: any[] = [];
  if (filterMonth) { query += ' AND p.month = ?'; params.push(filterMonth); }
  if (filterStatus) { query += ' AND p.status = ?'; params.push(filterStatus); }
  query += ' ORDER BY p.createdAt DESC LIMIT 200';

  const payments = db.prepare(query).all(...params) as any[];

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const total = (db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM Payment WHERE month = ? AND status = 'paid'").get(currentMonth) as any).t;

  const tenants = db.prepare("SELECT id, name FROM User WHERE role = 'tenant' AND status = 'active' ORDER BY name").all() as any[];

  return { payments, filterMonth, filterStatus, total, currentMonth, tenants };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const formData = await request.formData();
  const intent = String(formData.get('intent'));

  if (intent === 'markPaid') {
    const paymentId = String(formData.get('paymentId'));
    db.prepare("UPDATE Payment SET status = 'paid' WHERE id = ?").run(paymentId);
    return { success: 'Pembayaran ditandai lunas' };
  }

  if (intent === 'add') {
    const userId = String(formData.get('userId'));
    const type = String(formData.get('type'));
    const amount = Number(formData.get('amount'));
    const month = String(formData.get('month'));
    const status = String(formData.get('status') || 'paid');

    db.prepare(
      "INSERT INTO Payment (id, userId, type, amount, month, status) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(crypto.randomUUID(), userId, type, amount, month, status);
    return { success: 'Pembayaran ditambahkan' };
  }

  return null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    unpaid: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
}

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function Payments({ loaderData, actionData }: Route.ComponentProps) {
  const { payments, filterMonth, filterStatus, total, currentMonth, tenants } = loaderData;
  const [showAdd, setShowAdd] = useState(false);
  const fetcher = useFetcher();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pembayaran</h1>
          <p className="text-sm text-gray-500">Total bulan ini: <strong className="text-green-700">{formatRp(total)}</strong></p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-red-600 hover:bg-red-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Tambah
        </Button>
      </div>

      {(actionData as any)?.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {(actionData as any).success}
        </div>
      )}

      <form className="flex flex-wrap gap-3">
        <input
          type="month"
          name="month"
          defaultValue={filterMonth}
          onChange={(e) => e.currentTarget.form?.submit()}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <select name="status" defaultValue={filterStatus} onChange={(e) => e.currentTarget.form?.submit()}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="">Semua Status</option>
          <option value="paid">Lunas</option>
          <option value="unpaid">Belum Lunas</option>
        </select>
      </form>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                <th className="text-left px-4 py-3 font-medium">Penghuni</th>
                <th className="text-left px-4 py-3 font-medium">Tipe</th>
                <th className="text-left px-4 py-3 font-medium">Bulan</th>
                <th className="text-left px-4 py-3 font-medium">Jumlah</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Tidak ada data</td></tr>
              ) : payments.map((p: any) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{new Date(p.createdAt).toLocaleDateString('id-ID')}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.tenantName}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{p.type}</td>
                  <td className="px-4 py-3 text-gray-600">{p.month || '-'}</td>
                  <td className="px-4 py-3 font-medium">{formatRp(p.amount)}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3">
                    {p.status === 'unpaid' && (
                      <fetcher.Form method="post">
                        <input type="hidden" name="paymentId" value={p.id} />
                        <input type="hidden" name="intent" value="markPaid" />
                        <button
                          type="submit"
                          className="p-1.5 rounded-lg border border-green-200 hover:bg-green-50 text-green-600"
                          title="Tandai Lunas"
                        >
                          <CheckCircle className="w-4 h-4" />
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

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <fetcher.Form
            method="post"
            onSubmit={() => setShowAdd(false)}
            className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4"
          >
            <h2 className="text-lg font-bold">Tambah Pembayaran</h2>
            <input type="hidden" name="intent" value="add" />
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Penghuni</label>
              <select name="userId" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">-- Pilih Penghuni --</option>
                {tenants.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Tipe</label>
              <select name="type" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="rent">Sewa</option>
                <option value="laundry">Laundry</option>
                <option value="other">Lainnya</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Bulan (YYYY-MM)</label>
              <Input type="month" name="month" defaultValue={currentMonth} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Jumlah (Rp)</label>
              <Input type="number" name="amount" placeholder="1000000" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Status</label>
              <select name="status" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="paid">Lunas</option>
                <option value="unpaid">Belum Lunas</option>
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
