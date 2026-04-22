import { redirect, data } from 'react-router';
import type { Route } from './+types/daftar';
import { db } from '~/lib/db.server';
import { saveFile } from '~/lib/upload.server';
import { notifyAdminNewRegistration } from '~/lib/email.server';
import { Button } from '~/components/ui/button';
import crypto from 'crypto';
import {
  ChevronLeft, Upload, MapPin, Users, CreditCard,
  Phone, Mail, User, FileText, AlertCircle, CheckSquare,
} from 'lucide-react';
import { useState, useRef } from 'react';

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get('room') || '';

  const room = roomId
    ? (db.prepare('SELECT r.*, l.name as locationName FROM Room r LEFT JOIN Location l ON l.id = r.locationId WHERE r.id = ?').get(roomId) as any)
    : null;

  const rooms = db.prepare(
    "SELECT r.*, l.name as locationName FROM Room r LEFT JOIN Location l ON l.id = r.locationId WHERE r.status = 'available' ORDER BY r.locationId, r.type, r.number"
  ).all() as any[];

  const bank = db.prepare("SELECT * FROM BankAccount WHERE isActive = 1 LIMIT 1").get() as any;

  return { room, rooms, roomId, bank };
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
  const emergencyRelation = String(formData.get('emergencyRelation') || '').trim();
  const emergencyPhone = String(formData.get('emergencyPhone') || '').trim();
  const notes = String(formData.get('notes') || '').trim();
  const agree = formData.get('agree');
  const ktpFile = formData.get('ktpImage') as File | null;
  const paymentFile = formData.get('paymentProof') as File | null;

  const errors: Record<string, string> = {};
  if (!name) errors.name = 'Nama wajib diisi';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email tidak valid';
  if (!phone) errors.phone = 'Nomor HP wajib diisi';
  if (!roomId) errors.roomId = 'Kamar wajib dipilih';
  if (!ktpNumber || ktpNumber.length !== 16) errors.ktpNumber = 'Nomor KTP harus 16 digit';
  if (!occupation) errors.occupation = 'Pekerjaan wajib diisi';
  if (!emergencyName) errors.emergencyName = 'Nama kontak darurat wajib diisi';
  if (!emergencyPhone) errors.emergencyPhone = 'HP kontak darurat wajib diisi';
  if (!ktpFile || ktpFile.size === 0) errors.ktpImage = 'Upload foto KTP wajib';
  if (!agree) errors.agree = 'Anda harus menyetujui ketentuan';

  if (Object.keys(errors).length > 0) {
    return data({ errors, values: Object.fromEntries(formData) }, { status: 400 });
  }

  const existing = db.prepare('SELECT id FROM User WHERE email = ?').get(email);
  if (existing) {
    return data({ errors: { email: 'Email sudah terdaftar' }, values: Object.fromEntries(formData) }, { status: 400 });
  }

  const room = db.prepare('SELECT r.*, l.name as locationName FROM Room r LEFT JOIN Location l ON l.id = r.locationId WHERE r.id = ?').get(roomId) as any;
  if (!room) {
    return data({ errors: { roomId: 'Kamar tidak ditemukan' }, values: Object.fromEntries(formData) }, { status: 400 });
  }

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

const ROOM_TYPE_COLOR: Record<string, string> = {
  ekonomi: 'bg-orange-100 text-orange-700',
  standar: 'bg-blue-100 text-blue-700',
  suite: 'bg-purple-100 text-purple-700',
  deluxe: 'bg-red-100 text-red-700',
};

const ROOM_TYPE_IMAGE: Record<string, string> = {
  ekonomi: '/images/rooms/budiasih/ekonomi/budiasih-ekonomi1.webp',
  standar: '/images/rooms/budiasih/standar/salinan-rts02703.webp',
  suite: '/images/rooms/budiasih/suite/salinan-rts02744.webp',
  deluxe: '/images/rooms/budiasih/deluxe/salinan-rts02743.webp',
};

function formatPrice(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function FileUploadArea({
  name,
  label,
  required,
  error,
}: {
  name: string;
  label: string;
  required?: boolean;
  error?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      <div
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          error ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-red-300 hover:bg-red-50/30'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept="image/*,.pdf"
          required={required}
          onChange={handleChange}
          className="hidden"
        />
        {preview ? (
          <div className="space-y-2">
            <img src={preview} alt="Preview" className="max-h-32 mx-auto rounded-lg object-contain" />
            <p className="text-xs text-gray-500">{fileName} — klik untuk ganti</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-sm text-gray-500">
              {fileName ? fileName : 'Klik atau drag file ke sini'}
            </p>
            <p className="text-xs text-gray-400">JPG, PNG, WebP, PDF • Maks 5MB</p>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function Daftar({ loaderData, actionData }: Route.ComponentProps) {
  const { room: initialRoom, rooms, roomId, bank } = loaderData;
  const errors = (actionData as any)?.errors || {};

  const [selectedRoomId, setSelectedRoomId] = useState(roomId || (initialRoom?.id ?? ''));
  const [occupancy, setOccupancy] = useState(1);
  const [agreed, setAgreed] = useState(false);

  const room = initialRoom || rooms.find((r: any) => r.id === selectedRoomId) || null;
  const price = room ? (occupancy === 2 ? room.priceDouble : room.price) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/images/logo/logo.png" alt="Mitra Kost" className="h-8" />
          </a>
          <a href="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Kembali ke Beranda
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Form Pendaftaran Penghuni</h1>
          <p className="text-gray-500 mt-1">Isi data lengkap untuk mendaftar sebagai penghuni Mitra Kost.</p>
        </div>

        <form method="post" encType="multipart/form-data">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Summary Card — top on mobile, right sticky on desktop */}
            <div className="order-first lg:order-last lg:w-80 shrink-0">
              <div className="lg:sticky lg:top-24">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {room ? (
                    <>
                      <div className="h-40 overflow-hidden">
                        <img
                          src={ROOM_TYPE_IMAGE[room.type] || ROOM_TYPE_IMAGE.ekonomi}
                          alt={`Kamar ${room.number}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900 text-lg">Kamar {room.number}</span>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROOM_TYPE_COLOR[room.type] || 'bg-gray-100 text-gray-700'}`}>
                            {ROOM_TYPE_LABEL[room.type] || room.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <MapPin size={13} />
                          {room.locationName}
                        </div>
                        <hr className="border-gray-100" />
                        <div className="flex items-center gap-1.5 text-sm text-gray-700">
                          <Users size={13} />
                          {occupancy} penghuni
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Harga sewa</p>
                          <p className="text-xl font-bold text-red-600">{formatPrice(price)}<span className="text-sm text-gray-400 font-normal">/bulan</span></p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs text-gray-500 mb-0.5">Total bayar bulan pertama</p>
                          <p className="font-bold text-gray-900">{formatPrice(price)}</p>
                        </div>
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                          <AlertCircle size={13} className="mt-0.5 shrink-0" />
                          Pembayaran diverifikasi admin maksimal 1x24 jam
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-6 text-center text-gray-400">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <FileText size={24} className="text-gray-300" />
                      </div>
                      <p className="text-sm">Pilih kamar untuk melihat ringkasan</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Form Sections */}
            <div className="flex-1 min-w-0 space-y-6">

              {/* Section 1 — Data Pribadi */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-5">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
                    <User size={14} className="text-white" />
                  </div>
                  <h2 className="font-semibold text-gray-900">Data Pribadi</h2>
                </div>

                {/* Room Selection */}
                {!initialRoom && (
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Kamar yang Dipilih <span className="text-red-600">*</span>
                    </label>
                    <select
                      name="roomId"
                      value={selectedRoomId}
                      onChange={(e) => setSelectedRoomId(e.target.value)}
                      required
                      className="w-full py-3 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all"
                    >
                      <option value="">-- Pilih Kamar --</option>
                      {rooms.map((r: any) => (
                        <option key={r.id} value={r.id}>
                          {r.number} — {ROOM_TYPE_LABEL[r.type] || r.type} — {r.locationName}
                        </option>
                      ))}
                    </select>
                    {errors.roomId && <p className="text-xs text-red-500">{errors.roomId}</p>}
                  </div>
                )}
                {initialRoom && <input type="hidden" name="roomId" value={initialRoom.id} />}

                {/* Occupancy */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Jumlah Penghuni <span className="text-red-600">*</span>
                  </label>
                  <div className="flex gap-3">
                    {[1, 2].map((n) => {
                      const p = room ? (n === 2 ? room.priceDouble : room.price) : null;
                      return (
                        <label
                          key={n}
                          className={`flex-1 flex items-center gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${
                            occupancy === n ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="occupancy"
                            value={n}
                            checked={occupancy === n}
                            onChange={() => setOccupancy(n)}
                            className="accent-red-600"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{n} Orang</p>
                            {p != null && p > 0 && (
                              <p className="text-xs text-red-600 font-medium">{formatPrice(p)}/bln</p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Nama Lengkap <span className="text-red-600">*</span>
                    </label>
                    <input
                      name="name"
                      placeholder="Nama sesuai KTP"
                      required
                      className="w-full py-3 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all placeholder:text-gray-400"
                    />
                    {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Email <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        name="email"
                        type="email"
                        placeholder="nama@gmail.com"
                        required
                        className="w-full py-3 pl-10 pr-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all placeholder:text-gray-400"
                      />
                    </div>
                    {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Nomor HP / WhatsApp <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        name="phone"
                        placeholder="08xxxxxxxxxx"
                        required
                        className="w-full py-3 pl-10 pr-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all placeholder:text-gray-400"
                      />
                    </div>
                    {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Pekerjaan <span className="text-red-600">*</span>
                    </label>
                    <input
                      name="occupation"
                      placeholder="Mahasiswa, Karyawan, dll"
                      required
                      className="w-full py-3 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all placeholder:text-gray-400"
                    />
                    {errors.occupation && <p className="text-xs text-red-500">{errors.occupation}</p>}
                  </div>
                </div>
              </div>

              {/* Section 2 — Identitas */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-5">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
                    <FileText size={14} className="text-white" />
                  </div>
                  <h2 className="font-semibold text-gray-900">Identitas</h2>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Nomor KTP (NIK) <span className="text-red-600">*</span>
                  </label>
                  <input
                    name="ktpNumber"
                    placeholder="16 digit NIK"
                    maxLength={16}
                    required
                    pattern="\d{16}"
                    title="NIK harus 16 digit angka"
                    className="w-full py-3 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all placeholder:text-gray-400 font-mono tracking-widest"
                  />
                  {errors.ktpNumber && <p className="text-xs text-red-500">{errors.ktpNumber}</p>}
                </div>

                <FileUploadArea
                  name="ktpImage"
                  label="Foto KTP"
                  required
                  error={errors.ktpImage}
                />
              </div>

              {/* Section 3 — Kontak Darurat */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-5">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
                    <Phone size={14} className="text-white" />
                  </div>
                  <h2 className="font-semibold text-gray-900">Kontak Darurat</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Nama Kontak Darurat <span className="text-red-600">*</span>
                    </label>
                    <input
                      name="emergencyName"
                      placeholder="Nama orang tua / keluarga"
                      required
                      className="w-full py-3 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all placeholder:text-gray-400"
                    />
                    {errors.emergencyName && <p className="text-xs text-red-500">{errors.emergencyName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Hubungan</label>
                    <select
                      name="emergencyRelation"
                      className="w-full py-3 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all"
                    >
                      <option value="orang tua">Orang Tua</option>
                      <option value="saudara">Saudara</option>
                      <option value="pasangan">Pasangan</option>
                      <option value="lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Nomor HP Darurat <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        name="emergencyPhone"
                        placeholder="08xxxxxxxxxx"
                        required
                        className="w-full py-3 pl-10 pr-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all placeholder:text-gray-400"
                      />
                    </div>
                    {errors.emergencyPhone && <p className="text-xs text-red-500">{errors.emergencyPhone}</p>}
                  </div>
                </div>
              </div>

              {/* Section 4 — Pembayaran */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-5">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
                    <CreditCard size={14} className="text-white" />
                  </div>
                  <h2 className="font-semibold text-gray-900">Pembayaran</h2>
                </div>

                {!bank ? (
                  <div className="bg-red-50 border border-red-300 rounded-xl p-4 text-sm text-red-700 font-medium">
                    Sistem belum siap menerima pendaftaran. Hubungi admin.
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-2 text-sm">
                    <p className="font-semibold text-gray-900 mb-3">Info Transfer Bulan Pertama</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <span className="text-gray-500">Bank</span>
                      <span className="font-medium text-gray-900">{bank.bankName}</span>
                      <span className="text-gray-500">No. Rekening</span>
                      <span className="font-mono font-bold text-gray-900">{bank.accountNumber}</span>
                      <span className="text-gray-500">Atas Nama</span>
                      <span className="font-medium text-gray-900">{bank.accountHolder}</span>
                      {price > 0 && (
                        <>
                          <span className="text-gray-500">Jumlah</span>
                          <span className="font-bold text-red-600">{formatPrice(price)}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <FileUploadArea
                  name="paymentProof"
                  label="Upload Bukti Transfer (opsional)"
                />

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Catatan (opsional)</label>
                  <textarea
                    name="notes"
                    placeholder="Informasi tambahan..."
                    rows={3}
                    className="w-full py-3 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all resize-none placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Section 5 — Konfirmasi */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-5">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
                    <CheckSquare size={14} className="text-white" />
                  </div>
                  <h2 className="font-semibold text-gray-900">Konfirmasi</h2>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="agree"
                    value="1"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 accent-red-600 w-4 h-4 shrink-0"
                    required
                  />
                  <span className="text-sm text-gray-700">
                    Saya menyetujui ketentuan sewa Mitra Kost dan menyatakan bahwa semua informasi yang saya berikan adalah benar dan dapat dipertanggungjawabkan.
                  </span>
                </label>
                {errors.agree && <p className="text-xs text-red-500">{errors.agree}</p>}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={!agreed}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-medium shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Kirim Pendaftaran
                  </Button>
                  <a
                    href="/"
                    className="inline-flex items-center justify-center px-6 py-3 border border-gray-200 hover:border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    Batal
                  </a>
                </div>
              </div>

            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
