import { redirect, useFetcher } from 'react-router';
import type { Route } from './+types/dashboard.complaints';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { useState } from 'react';
import { CheckCircle, Eye } from 'lucide-react';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const url = new URL(request.url);
  const filterStatus = url.searchParams.get('status') || '';

  let query = `
    SELECT c.*, u.name as tenantName
    FROM Complaint c JOIN User u ON u.id = c.userId
    WHERE 1=1
  `;
  const params: any[] = [];
  if (filterStatus) { query += ' AND c.status = ?'; params.push(filterStatus); }
  query += ' ORDER BY c.createdAt DESC';

  const complaints = db.prepare(query).all(...params) as any[];
  return { complaints, filterStatus };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSession(request);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return redirect('/login');

  const formData = await request.formData();
  const id = String(formData.get('id'));
  db.prepare("UPDATE Complaint SET status = 'resolved' WHERE id = ?").run(id);
  return { success: 'Komplain ditandai selesai' };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: 'bg-yellow-100 text-yellow-700',
    inprogress: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
  };
  const labels: Record<string, string> = {
    open: 'Open', inprogress: 'In Progress', resolved: 'Selesai',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'bg-gray-100 text-gray-700'}`}>
      {labels[status] || status}
    </span>
  );
}

export default function Complaints({ loaderData, actionData }: Route.ComponentProps) {
  const { complaints, filterStatus } = loaderData;
  const [selected, setSelected] = useState<any>(null);
  const fetcher = useFetcher();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Komplain</h1>
        <p className="text-sm text-gray-500">{complaints.length} komplain</p>
      </div>

      {(actionData as any)?.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {(actionData as any).success}
        </div>
      )}

      <form className="flex gap-3">
        <select name="status" defaultValue={filterStatus} onChange={(e) => e.currentTarget.form?.submit()}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="">Semua Status</option>
          <option value="open">Open</option>
          <option value="inprogress">In Progress</option>
          <option value="resolved">Selesai</option>
        </select>
      </form>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                <th className="text-left px-4 py-3 font-medium">Penghuni</th>
                <th className="text-left px-4 py-3 font-medium">Judul</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {complaints.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Tidak ada komplain</td></tr>
              ) : complaints.map((c: any) => (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{new Date(c.createdAt).toLocaleDateString('id-ID')}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.tenantName}</td>
                  <td className="px-4 py-3 text-gray-700">{c.title}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelected(c)}
                        className="p-1.5 rounded-lg border hover:bg-gray-50 text-gray-600"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {c.status !== 'resolved' && (
                        <fetcher.Form method="post">
                          <input type="hidden" name="id" value={c.id} />
                          <button
                            type="submit"
                            className="p-1.5 rounded-lg border border-green-200 hover:bg-green-50 text-green-600"
                            title="Tandai Selesai"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </fetcher.Form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Detail Komplain</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3 text-sm">
              <div><p className="text-xs text-gray-500">Penghuni</p><p className="font-medium">{selected.tenantName}</p></div>
              <div><p className="text-xs text-gray-500">Judul</p><p className="font-medium">{selected.title}</p></div>
              <div><p className="text-xs text-gray-500">Deskripsi</p><p className="text-gray-700 bg-gray-50 rounded-lg p-2">{selected.description}</p></div>
              <div><p className="text-xs text-gray-500">Status</p><StatusBadge status={selected.status} /></div>
              <div><p className="text-xs text-gray-500">Tanggal</p><p>{new Date(selected.createdAt).toLocaleDateString('id-ID')}</p></div>
            </div>
            {selected.image && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Foto</p>
                <img src={selected.image} alt="complaint" className="rounded-lg border max-h-48 object-contain" />
              </div>
            )}
            <button onClick={() => setSelected(null)} className="w-full py-2 border rounded-lg text-sm hover:bg-gray-50">
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
