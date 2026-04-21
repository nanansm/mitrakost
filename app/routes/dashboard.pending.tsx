import { redirect, useFetcher } from 'react-router';
import type { Route } from './+types/dashboard.pending';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { notifyTenantApproved, notifyTenantDeclined } from '~/lib/email.server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { useState } from 'react';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import { Button } from '~/components/ui/button';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const pending = db.prepare(
    `SELECT tf.*, u.name, u.email, u.phone, r.number as roomNumber, r.type as roomType, l.name as locationName
     FROM TenantForm tf
     JOIN User u ON u.id = tf.userId
     LEFT JOIN Room r ON r.id = tf.roomId
     LEFT JOIN Location l ON l.id = tf.locationId
     WHERE tf.status = 'pending'
     ORDER BY tf.createdAt DESC`
  ).all() as any[];

  return { pending };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const formData = await request.formData();
  const intent = String(formData.get('intent'));
  const formId = String(formData.get('formId'));

  const tenantForm = db.prepare(
    `SELECT tf.*, u.email FROM TenantForm tf JOIN User u ON u.id = tf.userId WHERE tf.id = ?`
  ).get(formId) as any;
  if (!tenantForm) return { error: 'Form tidak ditemukan' };

  if (intent === 'approve') {
    const rawPassword = 'MitraKost@' + Math.floor(1000 + Math.random() * 9000);
    const hashed = await bcrypt.hash(rawPassword, 10);
    const now = new Date().toISOString();

    db.prepare(
      "UPDATE User SET password = ?, status = 'active', roomId = ?, updatedAt = ? WHERE id = ?"
    ).run(hashed, tenantForm.roomId, now, tenantForm.userId);

    db.prepare("UPDATE Room SET status = 'occupied' WHERE id = ?").run(tenantForm.roomId);

    const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const room = db.prepare('SELECT * FROM Room WHERE id = ?').get(tenantForm.roomId) as any;
    const amount = tenantForm.occupancy === 2 ? room?.priceDouble : room?.price;
    db.prepare(
      "INSERT INTO Payment (id, userId, type, amount, month, status) VALUES (?, ?, 'rent', ?, ?, 'paid')"
    ).run(crypto.randomUUID(), tenantForm.userId, amount || 0, month);

    db.prepare("UPDATE TenantForm SET status = 'approved' WHERE id = ?").run(formId);

    await notifyTenantApproved(tenantForm.email, rawPassword);
    return { success: 'Pendaftaran disetujui' };
  }

  if (intent === 'decline') {
    const reason = String(formData.get('reason') || '');
    db.prepare("UPDATE User SET status = 'declined' WHERE id = ?").run(tenantForm.userId);
    db.prepare("UPDATE TenantForm SET status = 'declined', note = ? WHERE id = ?").run(reason, formId);
    await notifyTenantDeclined(tenantForm.email, reason);
    return { success: 'Pendaftaran ditolak' };
  }

  return { error: 'Action tidak valid' };
}

const ROOM_TYPE_LABEL: Record<string, string> = {
  ekonomi: 'Ekonomi', standar: 'Standar', suite: 'Suite', deluxe: 'Deluxe',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

export default function PendingApproval({ loaderData, actionData }: Route.ComponentProps) {
  const { pending } = loaderData;
  const [selected, setSelected] = useState<any>(null);
  const [declineModal, setDeclineModal] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const fetcher = useFetcher();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Pending Approval</h1>
        <p className="text-sm text-gray-500 mt-0.5">{pending.length} pendaftaran menunggu persetujuan</p>
      </div>

      {(actionData as any)?.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {(actionData as any).success}
        </div>
      )}

      {pending.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
          Tidak ada pendaftaran yang menunggu persetujuan.
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                  <th className="text-left px-4 py-3 font-medium">Nama</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Kamar</th>
                  <th className="text-left px-4 py-3 font-medium">Tipe</th>
                  <th className="text-left px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p: any) => (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.email}</td>
                    <td className="px-4 py-3 text-gray-600">{p.roomNumber}</td>
                    <td className="px-4 py-3"><StatusBadge status={ROOM_TYPE_LABEL[p.roomType] || p.roomType} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelected(p)}
                          className="p-1.5 rounded-lg border hover:bg-gray-50 text-gray-600"
                          title="Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <fetcher.Form method="post">
                          <input type="hidden" name="formId" value={p.id} />
                          <input type="hidden" name="intent" value="approve" />
                          <button
                            type="submit"
                            className="p-1.5 rounded-lg border border-green-200 hover:bg-green-50 text-green-600"
                            title="Approve"
                            onClick={(e) => {
                              if (!confirm(`Setujui pendaftaran ${p.name}?`)) e.preventDefault();
                            }}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </fetcher.Form>
                        <button
                          onClick={() => setDeclineModal(p.id)}
                          className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                          title="Decline"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Detail Pendaftaran</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Nama', selected.name], ['Email', selected.email], ['HP', selected.phone],
                ['Kamar', selected.roomNumber], ['Tipe', ROOM_TYPE_LABEL[selected.roomType] || selected.roomType],
                ['Lokasi', selected.locationName], ['Pekerjaan', selected.occupation],
                ['KTP', selected.ktpNumber], ['Penghuni', `${selected.occupancy} orang`],
                ['Kontak Darurat', selected.emergencyName], ['HP Darurat', selected.emergencyPhone],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-medium text-gray-900">{val}</p>
                </div>
              ))}
            </div>
            {selected.note && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Catatan</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2">{selected.note}</p>
              </div>
            )}
            {selected.ktpImage && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Foto KTP</p>
                <img src={selected.ktpImage} alt="KTP" className="rounded-lg border max-h-48 object-contain" />
              </div>
            )}
            {selected.paymentProof && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Bukti Transfer</p>
                <img src={selected.paymentProof} alt="Bukti Transfer" className="rounded-lg border max-h-48 object-contain" />
              </div>
            )}
            <button onClick={() => setSelected(null)} className="w-full py-2 border rounded-lg text-sm hover:bg-gray-50">
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {declineModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold">Tolak Pendaftaran</h2>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Alasan penolakan (opsional)</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Mis: Pembayaran belum dikonfirmasi..."
              />
            </div>
            <div className="flex gap-3">
              <fetcher.Form method="post" className="flex-1">
                <input type="hidden" name="formId" value={declineModal} />
                <input type="hidden" name="intent" value="decline" />
                <input type="hidden" name="reason" value={declineReason} />
                <Button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => setDeclineModal(null)}
                >
                  Tolak Pendaftaran
                </Button>
              </fetcher.Form>
              <Button
                variant="outline"
                onClick={() => { setDeclineModal(null); setDeclineReason(''); }}
              >
                Batal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
