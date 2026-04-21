import { redirect, useFetcher } from 'react-router';
import type { Route } from './+types/tenant.complaints';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { saveFile } from '~/lib/upload.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import crypto from 'crypto';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user || user.role !== 'tenant') return redirect('/login');

  const complaints = db.prepare(
    'SELECT * FROM Complaint WHERE userId = ? ORDER BY createdAt DESC'
  ).all(user.id) as any[];

  return { complaints };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSession(request);
  if (!user || user.role !== 'tenant') return redirect('/login');

  const formData = await request.formData();
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const imageFile = formData.get('image') as File | null;

  if (!title || !description) return { error: 'Judul dan deskripsi wajib diisi' };

  let imagePath = '';
  if (imageFile && imageFile.size > 0) {
    imagePath = await saveFile(imageFile, 'complaint');
  }

  db.prepare(
    "INSERT INTO Complaint (id, userId, title, description, image, status) VALUES (?, ?, ?, ?, ?, 'open')"
  ).run(crypto.randomUUID(), user.id, title, description, imagePath);

  return { success: 'Komplain berhasil dikirim' };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: 'bg-yellow-100 text-yellow-700',
    inprogress: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
  };
  const labels: Record<string, string> = {
    open: 'Open', inprogress: 'Diproses', resolved: 'Selesai',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'bg-gray-100'}`}>
      {labels[status] || status}
    </span>
  );
}

export default function TenantComplaints({ loaderData, actionData }: Route.ComponentProps) {
  const { complaints } = loaderData;
  const [showForm, setShowForm] = useState(false);
  const fetcher = useFetcher();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Komplain</h1>
        <Button onClick={() => setShowForm(true)} className="bg-red-600 hover:bg-red-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Kirim Komplain
        </Button>
      </div>

      {(actionData as any)?.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {(actionData as any).success}
        </div>
      )}
      {(actionData as any)?.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {(actionData as any).error}
        </div>
      )}

      {complaints.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
          Belum ada komplain
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map((c: any) => (
            <div key={c.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{c.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{c.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(c.createdAt).toLocaleDateString('id-ID')}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              {c.image && (
                <img src={c.image} alt="complaint" className="mt-3 rounded-lg border max-h-32 object-contain" />
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <fetcher.Form
            method="post"
            encType="multipart/form-data"
            onSubmit={() => { if ((fetcher as any).state === 'idle') setShowForm(false); }}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <h2 className="text-lg font-bold">Kirim Komplain</h2>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Judul *</label>
              <Input name="title" placeholder="Ringkasan masalah" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Deskripsi *</label>
              <Textarea name="description" placeholder="Jelaskan masalah secara detail..." rows={4} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Foto (opsional)</label>
              <input
                name="image"
                type="file"
                accept="image/*"
                className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-gray-50 file:text-gray-700"
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                Kirim
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Batal
              </Button>
            </div>
          </fetcher.Form>
        </div>
      )}
    </div>
  );
}
