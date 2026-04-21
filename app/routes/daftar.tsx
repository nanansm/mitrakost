import { redirect, data } from 'react-router';
import type { Route } from './+types/daftar';
import { db } from '~/lib/db.server';
import { saveFile } from '~/lib/upload.server';
import { notifyAdminNewRegistration } from '~/lib/email.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import crypto from 'crypto';
import { Home, ChevronLeft } from 'lucide-react';

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get('room') || '';

  const room = roomId
    ? (db.prepare('SELECT r.*, l.name as locationName FROM Room r LEFT JOIN Location l ON l.id = r.locationId WHERE r.id = ?').get(roomId) as any)
    : null;

  const rooms = db.prepare(
    "SELECT r.*, l.name as locationName FROM Room r LEFT JOIN Location l ON l.id = r.locationId WHERE r.status = 'available' ORDER BY r.locationId, r.type, r.number"
  ).all() as any[];

  return { room, rooms, roomId };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const phone = String(formData.get('phone') || '').trim();
  const roomId = String(formData.get('roomId') || '').trim();
  const occupancy = Number(formData.get('occupancy') || 1);
  const ktpNumber = String(formData.get('ktpNumber') || '').trim();
  const occupation = String(formData.get('occupation') || '').trim();
  const emergencyName = String(formData.get('emergencyName') || '').trim();
  const emergencyPhone = String(formData.get('emergencyPhone') || '').trim();
  const notes = String(formData.get('notes') || '').trim();
  const ktpFile = formData.get('ktpImage') as File | null;
  const paymentFile = formData.get('paymentProof') as File | null;

  const errors: Record<string, string> = {};
  if (!name) errors.name = 'Nama wajib diisi';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email tidak valid';
  if (!phone) errors.phone = 'Nomor HP wajib diisi';
  if (!roomId) errors.roomId = 'Kamar wajib dipilih';
  if (!ktpNumber) errors.ktpNumber = 'Nomor KTP wajib diisi';
  if (!occupation) errors.occupation = 'Pekerjaan wajib diisi';
  if (!emergencyName) errors.emergencyName = 'Nama kontak darurat wajib diisi';
  if (!emergencyPhone) errors.emergencyPhone = 'HP kontak darurat wajib diisi';
  if (!ktpFile || ktpFile.size === 0) errors.ktpImage = 'Upload foto KTP wajib';

  if (Object.keys(errors).length > 0) {
    return data({ errors, values: Object.fromEntries(formData) }, { status: 400 });
  }

  // Check email
  const existing = db.prepare('SELECT id FROM User WHERE email = ?').get(email);
  if (existing) {
    return data({ errors: { email: 'Email sudah terdaftar' }, values: Object.fromEntries(formData) }, { status: 400 });
  }

  // Check room exists
  const room = db.prepare('SELECT r.*, l.name as locationName FROM Room r LEFT JOIN Location l ON l.id = r.locationId WHERE r.id = ?').get(roomId) as any;
  if (!room) {
    return data({ errors: { roomId: 'Kamar tidak ditemukan' }, values: Object.fromEntries(formData) }, { status: 400 });
  }

  // Upload files
  let ktpImagePath = '';
  let paymentProofPath = '';
  if (ktpFile && ktpFile.size > 0) {
    ktpImagePath = await saveFile(ktpFile, 'ktp');
  }
  if (paymentFile && paymentFile.size > 0) {
    paymentProofPath = await saveFile(paymentFile, 'payment');
  }

  const userId = crypto.randomUUID();
  const formId = crypto.randomUUID();

  db.prepare(
    'INSERT INTO User (id, name, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, name, email, phone, 'tenant', 'pending');

  db.prepare(
    `INSERT INTO TenantForm (id, userId, ktpNumber, ktpImage, occupation, emergencyName, emergencyPhone, paymentProof, roomId, locationId, roomType, occupancy, status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(
    formId, userId, ktpNumber, ktpImagePath, occupation, emergencyName, emergencyPhone,
    paymentProofPath, roomId, room.locationId, room.type, occupancy, notes
  );

  await notifyAdminNewRegistration({
    name, email, phone,
    roomNumber: room.number,
    roomType: room.type,
    locationName: room.locationName,
    occupation,
  });

  return redirect('/daftar/sukses');
}

const ROOM_TYPE_LABEL: Record<string, string> = {
  ekonomi: 'Ekonomi',
  standar: 'Standar',
  suite: 'Suite',
  deluxe: 'Deluxe',
};

function formatPrice(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function Daftar({ loaderData, actionData }: Route.ComponentProps) {
  const { room, rooms, roomId } = loaderData;
  const errors = (actionData as any)?.errors || {};

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/images/logo/logo.png" alt="Mitra Kost" className="h-8" />
          </a>
          <a href="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ChevronLeft className="w-4 h-4" />
            Kembali ke Beranda
          </a>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Form Pendaftaran Penghuni</h1>
          <p className="text-gray-500 mt-1">Isi data lengkap untuk mendaftar sebagai penghuni Mitra Kost.</p>
        </div>

        <form method="post" encType="multipart/form-data" className="space-y-6">
          {/* Kamar */}
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Informasi Kamar</h2>
            <div className="space-y-1.5">
              <Label htmlFor="roomId">Kamar yang Dipilih *</Label>
              {room ? (
                <>
                  <input type="hidden" name="roomId" value={room.id} />
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                    <span className="font-medium text-red-700">{room.number}</span>
                    <span className="text-gray-600"> — {ROOM_TYPE_LABEL[room.type] || room.type} — {room.locationName}</span>
                  </div>
                </>
              ) : (
                <>
                  <select
                    name="roomId"
                    id="roomId"
                    defaultValue={roomId}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  >
                    <option value="">-- Pilih Kamar --</option>
                    {rooms.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.number} — {ROOM_TYPE_LABEL[r.type] || r.type} — {r.locationName}
                      </option>
                    ))}
                  </select>
                  {errors.roomId && <p className="text-xs text-red-600">{errors.roomId}</p>}
                </>
              )}
            </div>

            {room && (
              <div className="space-y-2">
                <Label>Jumlah Penghuni *</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="occupancy" value="1" defaultChecked className="accent-red-600" />
                    <span className="text-sm">1 Orang — <strong>{formatPrice(room.price)}</strong>/bln</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="occupancy" value="2" className="accent-red-600" />
                    <span className="text-sm">2 Orang — <strong>{formatPrice(room.priceDouble)}</strong>/bln</span>
                  </label>
                </div>
              </div>
            )}

            {!room && (
              <div className="space-y-2">
                <Label>Jumlah Penghuni *</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="occupancy" value="1" defaultChecked className="accent-red-600" />
                    <span className="text-sm">1 Orang</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="occupancy" value="2" className="accent-red-600" />
                    <span className="text-sm">2 Orang</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Data Diri */}
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Data Diri</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nama Lengkap *</Label>
                <Input id="name" name="name" placeholder="Nama sesuai KTP" required />
                {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Gmail *</Label>
                <Input id="email" name="email" type="email" placeholder="nama@gmail.com" required />
                {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Nomor HP *</Label>
                <Input id="phone" name="phone" placeholder="08xxxxxxxxxx" required />
                {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="occupation">Pekerjaan *</Label>
                <Input id="occupation" name="occupation" placeholder="Mahasiswa, Karyawan, dll" required />
                {errors.occupation && <p className="text-xs text-red-600">{errors.occupation}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ktpNumber">Nomor KTP *</Label>
                <Input id="ktpNumber" name="ktpNumber" placeholder="16 digit NIK" maxLength={16} required />
                {errors.ktpNumber && <p className="text-xs text-red-600">{errors.ktpNumber}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ktpImage">Upload Foto KTP *</Label>
              <input
                id="ktpImage"
                name="ktpImage"
                type="file"
                accept="image/*,.pdf"
                required
                className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-red-50 file:text-red-700 hover:file:bg-red-100 cursor-pointer"
              />
              {errors.ktpImage && <p className="text-xs text-red-600">{errors.ktpImage}</p>}
            </div>
          </div>

          {/* Kontak Darurat */}
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Kontak Darurat</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="emergencyName">Nama Kontak Darurat *</Label>
                <Input id="emergencyName" name="emergencyName" placeholder="Nama orang tua/keluarga" required />
                {errors.emergencyName && <p className="text-xs text-red-600">{errors.emergencyName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emergencyPhone">Nomor HP Darurat *</Label>
                <Input id="emergencyPhone" name="emergencyPhone" placeholder="08xxxxxxxxxx" required />
                {errors.emergencyPhone && <p className="text-xs text-red-600">{errors.emergencyPhone}</p>}
              </div>
            </div>
          </div>

          {/* Pembayaran & Catatan */}
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Pembayaran & Catatan</h2>
            <div className="space-y-1.5">
              <Label htmlFor="paymentProof">Upload Bukti Transfer (opsional)</Label>
              <input
                id="paymentProof"
                name="paymentProof"
                type="file"
                accept="image/*,.pdf"
                className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100 cursor-pointer"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Catatan (opsional)</Label>
              <Textarea id="notes" name="notes" placeholder="Informasi tambahan..." rows={3} />
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white">
              Kirim Pendaftaran
            </Button>
            <a href="/" className="inline-flex items-center justify-center px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              Batal
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
