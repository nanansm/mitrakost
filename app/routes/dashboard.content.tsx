import { redirect, useFetcher, useSearchParams } from 'react-router';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { syncSilent, syncLogAdmin } from '~/lib/sheets.server';
import {
  Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight,
  Save, ChevronUp, ChevronDown,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import crypto from 'crypto';

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSession(request);
  if (!user || user.role !== 'owner') return redirect('/dashboard');

  const heroItems = db.prepare("SELECT key, value FROM LandingContent WHERE section = 'hero' ORDER BY sortOrder").all() as any[];
  const hero: Record<string, string> = {};
  heroItems.forEach((h: any) => { hero[h.key] = h.value; });

  const roomTypes = db.prepare("SELECT * FROM RoomType ORDER BY sortOrder, createdAt").all() as any[];
  const allFeatures = db.prepare("SELECT * FROM RoomTypeFeature ORDER BY sortOrder").all() as any[];
  const roomTypesWithFeatures = roomTypes.map((rt: any) => ({
    ...rt,
    features: allFeatures.filter((f: any) => f.roomTypeId === rt.id),
  }));

  const rooms = db.prepare(`
    SELECT r.*, l.name as locationName, rt.name as typeName
    FROM Room r
    LEFT JOIN Location l ON l.id = r.locationId
    LEFT JOIN RoomType rt ON rt.slug = r.type
    ORDER BY r.locationId, r.type, r.number
  `).all() as any[];

  const locations = db.prepare("SELECT * FROM Location ORDER BY sortOrder, name").all() as any[];
  const bankAccounts = db.prepare("SELECT * FROM BankAccount ORDER BY createdAt").all() as any[];
  const facilities = db.prepare("SELECT * FROM Facility ORDER BY sortOrder").all() as any[];
  const howToSteps = db.prepare("SELECT * FROM HowToStep ORDER BY stepNumber").all() as any[];
  const faqs = db.prepare("SELECT * FROM Faq ORDER BY sortOrder").all() as any[];

  return { user, hero, roomTypes: roomTypesWithFeatures, rooms, locations, bankAccounts, facilities, howToSteps, faqs };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getSession(request);
  if (!user || user.role !== 'owner') return redirect('/dashboard');

  const formData = await request.formData();
  const intent = String(formData.get('intent'));

  // --- HERO ---
  if (intent === 'saveHero') {
    const headline = String(formData.get('headline') || '').trim();
    const subheadline = String(formData.get('subheadline') || '').trim();
    db.prepare("INSERT OR REPLACE INTO LandingContent (id, section, key, value, sortOrder, updatedAt) VALUES (?, 'hero', 'headline', ?, 1, CURRENT_TIMESTAMP)")
      .run('lc-hero-1', headline);
    db.prepare("INSERT OR REPLACE INTO LandingContent (id, section, key, value, sortOrder, updatedAt) VALUES (?, 'hero', 'subheadline', ?, 2, CURRENT_TIMESTAMP)")
      .run('lc-hero-2', subheadline);
    syncSilent(() => syncLogAdmin(user.name, 'Edit Hero', 'LandingContent', `headline: ${headline}`));
    return { success: 'Hero berhasil disimpan' };
  }

  // --- ROOM TYPE ---
  if (intent === 'saveRoomType') {
    const id = String(formData.get('id') || '').trim();
    const name = String(formData.get('name') || '').trim();
    const slug = slugify(name);
    const basePrice = Number(formData.get('basePrice') || 0);
    const basePriceDouble = Number(formData.get('basePriceDouble') || 0);
    const description = String(formData.get('description') || '').trim();
    const isActive = formData.get('isActive') === '1' ? 1 : 0;
    const sortOrder = Number(formData.get('sortOrder') || 0);
    const featureLabels = formData.getAll('featureLabel') as string[];
    const featureIncluded = formData.getAll('featureIncluded') as string[];

    if (!name || !basePrice) return { error: 'Nama dan harga wajib diisi' };

    if (id) {
      db.prepare("UPDATE RoomType SET name=?, slug=?, basePrice=?, basePriceDouble=?, description=?, isActive=?, sortOrder=? WHERE id=?")
        .run(name, slug, basePrice, basePriceDouble, description, isActive, sortOrder, id);
      db.prepare("DELETE FROM RoomTypeFeature WHERE roomTypeId=?").run(id);
      featureLabels.forEach((label, i) => {
        if (label.trim()) {
          db.prepare("INSERT INTO RoomTypeFeature (id, roomTypeId, label, isIncluded, sortOrder) VALUES (?,?,?,?,?)")
            .run(crypto.randomUUID(), id, label.trim(), featureIncluded[i] === '1' ? 1 : 0, i);
        }
      });
    } else {
      const newId = crypto.randomUUID();
      db.prepare("INSERT INTO RoomType (id, slug, name, basePrice, basePriceDouble, description, isActive, sortOrder) VALUES (?,?,?,?,?,?,?,?)")
        .run(newId, slug, name, basePrice, basePriceDouble, description, isActive, sortOrder);
      featureLabels.forEach((label, i) => {
        if (label.trim()) {
          db.prepare("INSERT INTO RoomTypeFeature (id, roomTypeId, label, isIncluded, sortOrder) VALUES (?,?,?,?,?)")
            .run(crypto.randomUUID(), newId, label.trim(), featureIncluded[i] === '1' ? 1 : 0, i);
        }
      });
    }
    syncSilent(() => syncLogAdmin(user.name, id ? 'Edit Tipe Kamar' : 'Tambah Tipe Kamar', name, `harga: ${basePrice}`));
    return { success: 'Tipe kamar berhasil disimpan' };
  }

  if (intent === 'deleteRoomType') {
    const id = String(formData.get('id'));
    const slug = String(formData.get('slug'));
    const roomCount = (db.prepare("SELECT COUNT(*) as c FROM Room WHERE type=?").get(slug) as any).c;
    if (roomCount > 0) return { error: 'Tipe kamar masih memiliki kamar, tidak bisa dihapus' };
    db.prepare("DELETE FROM RoomTypeFeature WHERE roomTypeId=?").run(id);
    db.prepare("DELETE FROM RoomType WHERE id=?").run(id);
    syncSilent(() => syncLogAdmin(user.name, 'Hapus Tipe Kamar', slug, ''));
    return { success: 'Tipe kamar dihapus' };
  }

  // --- ROOM (KAMAR) ---
  if (intent === 'saveRoom') {
    const id = String(formData.get('id') || '').trim();
    const number = String(formData.get('number') || '').trim();
    const type = String(formData.get('type') || '').trim();
    const locationId = String(formData.get('locationId') || '').trim();
    const price = Number(formData.get('price') || 0);
    const priceDouble = Number(formData.get('priceDouble') || 0);
    const status = String(formData.get('status') || 'available');
    if (!number || !type || !locationId) return { error: 'No kamar, tipe, dan lokasi wajib diisi' };
    if (id) {
      db.prepare("UPDATE Room SET number=?, type=?, locationId=?, price=?, priceDouble=?, status=? WHERE id=?")
        .run(number, type, locationId, price, priceDouble, status, id);
    } else {
      db.prepare("INSERT INTO Room (id, number, type, locationId, price, priceDouble, status) VALUES (?,?,?,?,?,?,?)")
        .run(crypto.randomUUID(), number, type, locationId, price, priceDouble, status);
    }
    syncSilent(() => syncLogAdmin(user.name, id ? 'Edit Kamar' : 'Tambah Kamar', number, `lokasi: ${locationId}, tipe: ${type}`));
    return { success: 'Kamar berhasil disimpan' };
  }

  if (intent === 'deleteRoom') {
    const id = String(formData.get('id'));
    const room = db.prepare('SELECT * FROM Room WHERE id=?').get(id) as any;
    if (room?.status === 'occupied') return { error: 'Kamar sedang ditempati, tidak bisa dihapus' };
    db.prepare("DELETE FROM Room WHERE id=?").run(id);
    syncSilent(() => syncLogAdmin(user.name, 'Hapus Kamar', id, ''));
    return { success: 'Kamar dihapus' };
  }

  // --- LOCATION ---
  if (intent === 'saveLocation') {
    const id = String(formData.get('id') || '').trim();
    const name = String(formData.get('name') || '').trim();
    const address = String(formData.get('address') || '').trim();
    const mapsEmbed = String(formData.get('mapsEmbed') || '').trim();
    const isActive = formData.get('isActive') === '1' ? 1 : 0;
    const sortOrder = Number(formData.get('sortOrder') || 0);
    if (!name || !address) return { error: 'Nama dan alamat wajib diisi' };
    if (id) {
      db.prepare("UPDATE Location SET name=?, address=?, mapsEmbed=?, isActive=?, sortOrder=? WHERE id=?")
        .run(name, address, mapsEmbed || null, isActive, sortOrder, id);
    } else {
      const newId = slugify(name);
      db.prepare("INSERT OR IGNORE INTO Location (id, name, address, mapsEmbed, isActive, sortOrder) VALUES (?,?,?,?,?,?)")
        .run(newId, name, address, mapsEmbed || null, isActive, sortOrder);
    }
    syncSilent(() => syncLogAdmin(user.name, id ? 'Edit Lokasi' : 'Tambah Lokasi', name, address));
    return { success: 'Lokasi berhasil disimpan' };
  }

  if (intent === 'deleteLocation') {
    const id = String(formData.get('id'));
    const roomCount = (db.prepare("SELECT COUNT(*) as c FROM Room WHERE locationId=?").get(id) as any).c;
    if (roomCount > 0) return { error: 'Lokasi masih memiliki kamar, tidak bisa dihapus' };
    db.prepare("DELETE FROM Location WHERE id=?").run(id);
    syncSilent(() => syncLogAdmin(user.name, 'Hapus Lokasi', id, ''));
    return { success: 'Lokasi dihapus' };
  }

  // --- BANK ACCOUNT ---
  if (intent === 'saveBankAccount') {
    const id = String(formData.get('id') || '').trim();
    const bankName = String(formData.get('bankName') || '').trim();
    const accountNumber = String(formData.get('accountNumber') || '').trim();
    const accountHolder = String(formData.get('accountHolder') || '').trim();
    if (!bankName || !accountNumber || !accountHolder) return { error: 'Semua field rekening wajib diisi' };
    if (id) {
      db.prepare("UPDATE BankAccount SET bankName=?, accountNumber=?, accountHolder=? WHERE id=?")
        .run(bankName, accountNumber, accountHolder, id);
    } else {
      db.prepare("INSERT INTO BankAccount (id, bankName, accountNumber, accountHolder, isActive) VALUES (?,?,?,?,0)")
        .run(crypto.randomUUID(), bankName, accountNumber, accountHolder);
    }
    syncSilent(() => syncLogAdmin(user.name, id ? 'Edit Rekening' : 'Tambah Rekening', bankName, accountNumber));
    return { success: 'Rekening berhasil disimpan' };
  }

  if (intent === 'setActiveBankAccount') {
    const id = String(formData.get('id'));
    db.prepare("UPDATE BankAccount SET isActive=0").run();
    db.prepare("UPDATE BankAccount SET isActive=1 WHERE id=?").run(id);
    syncSilent(() => syncLogAdmin(user.name, 'Set Rekening Aktif', id, ''));
    return { success: 'Rekening aktif diperbarui' };
  }

  if (intent === 'deleteBankAccount') {
    db.prepare("DELETE FROM BankAccount WHERE id=?").run(String(formData.get('id')));
    return { success: 'Rekening dihapus' };
  }

  // --- FACILITY ---
  if (intent === 'saveFacility') {
    const id = String(formData.get('id') || '').trim();
    const label = String(formData.get('label') || '').trim();
    const icon = String(formData.get('icon') || 'Check').trim();
    const sortOrder = Number(formData.get('sortOrder') || 0);
    const isActive = formData.get('isActive') === '1' ? 1 : 0;
    if (!label) return { error: 'Label fasilitas wajib diisi' };
    if (id) {
      db.prepare("UPDATE Facility SET label=?, icon=?, sortOrder=?, isActive=? WHERE id=?").run(label, icon, sortOrder, isActive, id);
    } else {
      db.prepare("INSERT INTO Facility (id, label, icon, sortOrder, isActive) VALUES (?,?,?,?,?)").run(crypto.randomUUID(), label, icon, sortOrder, isActive);
    }
    syncSilent(() => syncLogAdmin(user.name, id ? 'Edit Fasilitas' : 'Tambah Fasilitas', label, icon));
    return { success: 'Fasilitas berhasil disimpan' };
  }

  if (intent === 'deleteFacility') {
    db.prepare("DELETE FROM Facility WHERE id=?").run(String(formData.get('id')));
    return { success: 'Fasilitas dihapus' };
  }

  // --- HOW TO STEP ---
  if (intent === 'saveHowToStep') {
    const id = String(formData.get('id'));
    const title = String(formData.get('title') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const icon = String(formData.get('icon') || 'Home').trim();
    db.prepare("UPDATE HowToStep SET title=?, description=?, icon=? WHERE id=?").run(title, description, icon, id);
    syncSilent(() => syncLogAdmin(user.name, 'Edit Cara Sewa', title, `step ${id}`));
    return { success: 'Cara sewa berhasil disimpan' };
  }

  // --- FAQ ---
  if (intent === 'saveFaq') {
    const id = String(formData.get('id') || '').trim();
    const question = String(formData.get('question') || '').trim();
    const answer = String(formData.get('answer') || '').trim();
    const sortOrder = Number(formData.get('sortOrder') || 0);
    const isActive = formData.get('isActive') === '1' ? 1 : 0;
    if (!question || !answer) return { error: 'Pertanyaan dan jawaban wajib diisi' };
    if (id) {
      db.prepare("UPDATE Faq SET question=?, answer=?, sortOrder=?, isActive=? WHERE id=?").run(question, answer, sortOrder, isActive, id);
    } else {
      db.prepare("INSERT INTO Faq (id, question, answer, sortOrder, isActive) VALUES (?,?,?,?,?)").run(crypto.randomUUID(), question, answer, sortOrder, isActive);
    }
    syncSilent(() => syncLogAdmin(user.name, id ? 'Edit FAQ' : 'Tambah FAQ', question.slice(0, 50), ''));
    return { success: 'FAQ berhasil disimpan' };
  }

  if (intent === 'deleteFaq') {
    db.prepare("DELETE FROM Faq WHERE id=?").run(String(formData.get('id')));
    return { success: 'FAQ dihapus' };
  }

  return null;
}

const TABS = [
  { id: 'hero', label: 'Hero' },
  { id: 'kamar-tipe', label: 'Tipe Kamar' },
  { id: 'kamar', label: 'Kamar' },
  { id: 'lokasi', label: 'Lokasi' },
  { id: 'rekening', label: 'Rekening' },
  { id: 'fasilitas', label: 'Fasilitas' },
  { id: 'carasewa', label: 'Cara Sewa' },
  { id: 'faq', label: 'FAQ' },
];

const LUCIDE_ICONS = ['Home', 'MapPin', 'ClipboardList', 'Smartphone', 'Wifi', 'ShieldCheck', 'Car', 'Bath', 'Wind', 'Flame', 'Check', 'Video', 'Droplet', 'Key', 'Package', 'Zap', 'Phone', 'Mail', 'Star', 'Heart'];
const ROOM_STATUS_OPTIONS = ['available', 'occupied', 'maintenance'];

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

function Alert({ msg, isError }: { msg: string; isError?: boolean }) {
  return (
    <div className={`p-3 rounded-lg text-sm mb-4 ${isError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
      {msg}
    </div>
  );
}

export default function ContentManagement({ loaderData, actionData }: { loaderData: any; actionData: any }) {
  const { hero, roomTypes, rooms, locations, bankAccounts, facilities, howToSteps, faqs } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'hero';
  const msg = (actionData as any)?.success || '';
  const err = (actionData as any)?.error || '';

  function setTab(id: string) {
    setSearchParams({ tab: id });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Content Management</h1>
        <p className="text-sm text-gray-500 mt-1">Kelola konten landing page, kamar, lokasi, dan rekening.</p>
      </div>

      {msg && <Alert msg={msg} />}
      {err && <Alert msg={err} isError />}

      {/* Tabs — scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
        <div className="flex gap-1 border-b min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] ${
                activeTab === tab.id
                  ? 'text-red-600 border-b-2 border-red-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'hero' && <HeroTab hero={hero} />}
      {activeTab === 'kamar-tipe' && <RoomTypeTab roomTypes={roomTypes} />}
      {activeTab === 'kamar' && <RoomsTab rooms={rooms} locations={locations} roomTypes={roomTypes} />}
      {activeTab === 'lokasi' && <LocationTab locations={locations} />}
      {activeTab === 'rekening' && <BankAccountTab bankAccounts={bankAccounts} />}
      {activeTab === 'fasilitas' && <FacilityTab facilities={facilities} />}
      {activeTab === 'carasewa' && <HowToStepTab steps={howToSteps} />}
      {activeTab === 'faq' && <FaqTab faqs={faqs} />}
    </div>
  );
}

// ============ HERO TAB ============
function HeroTab({ hero }: { hero: Record<string, string> }) {
  const fetcher = useFetcher();
  return (
    <div className="bg-white rounded-xl border p-5 max-w-2xl">
      <h2 className="font-semibold text-gray-900 mb-4">Edit Hero Section</h2>
      <fetcher.Form method="post" className="space-y-4">
        <input type="hidden" name="intent" value="saveHero" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
          <Input name="headline" defaultValue={hero.headline || ''} placeholder="Kos Premium di Jantung Kota Sumedang" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subheadline</label>
          <Textarea name="subheadline" defaultValue={hero.subheadline || ''} placeholder="Deskripsi singkat..." rows={3} />
        </div>
        <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white gap-2 min-h-[44px]">
          <Save size={16} />Simpan
        </Button>
      </fetcher.Form>
    </div>
  );
}

// ============ ROOM TYPE TAB ============
function RoomTypeTab({ roomTypes }: { roomTypes: any[] }) {
  const fetcher = useFetcher();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [features, setFeatures] = useState<{ label: string; isIncluded: number }[]>([]);

  function openCreate() {
    setEditing(null);
    setFeatures([{ label: '', isIncluded: 1 }]);
    setModalOpen(true);
  }

  function openEdit(rt: any) {
    setEditing(rt);
    setFeatures(rt.features.map((f: any) => ({ label: f.label, isIncluded: f.isIncluded })));
    setModalOpen(true);
  }

  function addFeature() {
    setFeatures([...features, { label: '', isIncluded: 1 }]);
  }

  function removeFeature(i: number) {
    setFeatures(features.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Tipe Kamar</h2>
        <Button onClick={openCreate} className="bg-red-600 hover:bg-red-700 text-white gap-2 text-sm min-h-[44px]">
          <Plus size={16} />Tambah Tipe
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Harga 1 Org</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Harga 2 Org</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {roomTypes.map((rt: any) => (
              <tr key={rt.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium whitespace-nowrap">{rt.name}</td>
                <td className="px-4 py-3 whitespace-nowrap">Rp {rt.basePrice.toLocaleString('id-ID')}</td>
                <td className="px-4 py-3 whitespace-nowrap">Rp {rt.basePriceDouble.toLocaleString('id-ID')}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${rt.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {rt.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(rt)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center">
                      <Pencil size={14} />
                    </button>
                    <fetcher.Form method="post" onSubmit={(e) => { if (!confirm('Hapus tipe ini?')) e.preventDefault(); }}>
                      <input type="hidden" name="intent" value="deleteRoomType" />
                      <input type="hidden" name="id" value={rt.id} />
                      <input type="hidden" name="slug" value={rt.slug} />
                      <button type="submit" className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center">
                        <Trash2 size={14} />
                      </button>
                    </fetcher.Form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Tipe Kamar' : 'Tambah Tipe Kamar'}>
        <fetcher.Form method="post" onSubmit={() => setModalOpen(false)} className="space-y-4">
          <input type="hidden" name="intent" value="saveRoomType" />
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
              <Input name="name" defaultValue={editing?.name || ''} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Urutan</label>
              <Input type="number" name="sortOrder" defaultValue={editing?.sortOrder || 0} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Harga 1 Orang</label>
              <Input type="number" name="basePrice" defaultValue={editing?.basePrice || ''} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Harga 2 Orang</label>
              <Input type="number" name="basePriceDouble" defaultValue={editing?.basePriceDouble || ''} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
            <Textarea name="description" defaultValue={editing?.description || ''} rows={2} />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Status Aktif</label>
            <select name="isActive" defaultValue={editing?.isActive ?? 1} className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="1">Aktif</option>
              <option value="0">Nonaktif</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Fasilitas</label>
              <button type="button" onClick={addFeature} className="text-xs text-red-600 hover:underline">+ Tambah</button>
            </div>
            <div className="space-y-2">
              {features.map((f, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    name="featureIncluded"
                    value={f.isIncluded}
                    onChange={(e) => { const nf = [...features]; nf[i].isIncluded = Number(e.target.value); setFeatures(nf); }}
                    className="border rounded-lg px-2 py-1.5 text-sm w-20"
                  >
                    <option value="1">✓</option>
                    <option value="0">✗</option>
                  </select>
                  <Input
                    name="featureLabel"
                    value={f.label}
                    onChange={(e) => { const nf = [...features]; nf[i].label = e.target.value; setFeatures(nf); }}
                    placeholder="Nama fasilitas"
                    className="flex-1"
                  />
                  <button type="button" onClick={() => removeFeature(i)} className="text-gray-400 hover:text-red-600 p-1"><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white min-h-[44px]">Simpan</Button>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1 min-h-[44px]">Batal</Button>
          </div>
        </fetcher.Form>
      </Modal>
    </div>
  );
}

// ============ ROOMS TAB ============
function RoomsTab({ rooms, locations, roomTypes }: { rooms: any[]; locations: any[]; roomTypes: any[] }) {
  const fetcher = useFetcher();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [filterLoc, setFilterLoc] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filtered = rooms.filter((r) =>
    (!filterLoc || r.locationId === filterLoc) &&
    (!filterType || r.type === filterType) &&
    (!filterStatus || r.status === filterStatus)
  );

  function openCreate() { setEditing(null); setModalOpen(true); }
  function openEdit(r: any) { setEditing(r); setModalOpen(true); }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Kamar</h2>
        <Button onClick={openCreate} className="bg-red-600 hover:bg-red-700 text-white gap-2 text-sm min-h-[44px]">
          <Plus size={16} />Tambah Kamar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filterLoc} onChange={(e) => setFilterLoc(e.target.value)} className="border rounded-lg px-3 py-2 text-sm min-h-[44px]">
          <option value="">Semua Lokasi</option>
          {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm min-h-[44px]">
          <option value="">Semua Tipe</option>
          {roomTypes.map((rt: any) => <option key={rt.id} value={rt.slug}>{rt.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm min-h-[44px]">
          <option value="">Semua Status</option>
          {ROOM_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap sticky left-0 bg-gray-50">No</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Tipe</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Harga</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Lokasi</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {filtered.map((r: any) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium sticky left-0 bg-white">{r.number}</td>
                <td className="px-4 py-3 whitespace-nowrap capitalize">{r.type}</td>
                <td className="px-4 py-3 whitespace-nowrap">Rp {r.price.toLocaleString('id-ID')}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.locationName}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'available' ? 'bg-green-100 text-green-700' : r.status === 'occupied' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center">
                      <Pencil size={14} />
                    </button>
                    <fetcher.Form method="post" onSubmit={(e) => { if (!confirm('Hapus kamar ini?')) e.preventDefault(); }}>
                      <input type="hidden" name="intent" value="deleteRoom" />
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center">
                        <Trash2 size={14} />
                      </button>
                    </fetcher.Form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Kamar' : 'Tambah Kamar'}>
        <fetcher.Form method="post" onSubmit={() => setModalOpen(false)} className="space-y-4">
          <input type="hidden" name="intent" value="saveRoom" />
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No Kamar</label>
              <Input name="number" defaultValue={editing?.number || ''} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
              <select name="type" defaultValue={editing?.type || ''} required className="w-full border rounded-lg px-3 py-2 text-sm min-h-[44px]">
                <option value="">Pilih Tipe</option>
                {roomTypes.map((rt: any) => <option key={rt.id} value={rt.slug}>{rt.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
              <select name="locationId" defaultValue={editing?.locationId || ''} required className="w-full border rounded-lg px-3 py-2 text-sm min-h-[44px]">
                <option value="">Pilih Lokasi</option>
                {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select name="status" defaultValue={editing?.status || 'available'} className="w-full border rounded-lg px-3 py-2 text-sm min-h-[44px]">
                {ROOM_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Harga 1 Org</label>
              <Input type="number" name="price" defaultValue={editing?.price || ''} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Harga 2 Org</label>
              <Input type="number" name="priceDouble" defaultValue={editing?.priceDouble || ''} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white min-h-[44px]">Simpan</Button>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1 min-h-[44px]">Batal</Button>
          </div>
        </fetcher.Form>
      </Modal>
    </div>
  );
}

// ============ LOCATION TAB ============
function LocationTab({ locations }: { locations: any[] }) {
  const fetcher = useFetcher();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Lokasi</h2>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="bg-red-600 hover:bg-red-700 text-white gap-2 text-sm min-h-[44px]">
          <Plus size={16} />Tambah Lokasi
        </Button>
      </div>
      <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4">
        Setelah tambah lokasi, jangan lupa tambah kamar di tab Kamar.
      </p>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Alamat</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {locations.map((loc: any) => (
              <tr key={loc.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium whitespace-nowrap">{loc.name}</td>
                <td className="px-4 py-3 max-w-xs truncate">{loc.address}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${loc.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {loc.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => { setEditing(loc); setModalOpen(true); }} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center">
                      <Pencil size={14} />
                    </button>
                    <fetcher.Form method="post" onSubmit={(e) => { if (!confirm('Hapus lokasi ini?')) e.preventDefault(); }}>
                      <input type="hidden" name="intent" value="deleteLocation" />
                      <input type="hidden" name="id" value={loc.id} />
                      <button type="submit" className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center">
                        <Trash2 size={14} />
                      </button>
                    </fetcher.Form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Lokasi' : 'Tambah Lokasi'}>
        <fetcher.Form method="post" onSubmit={() => setModalOpen(false)} className="space-y-4">
          <input type="hidden" name="intent" value="saveLocation" />
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lokasi</label>
            <Input name="name" defaultValue={editing?.name || ''} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
            <Textarea name="address" defaultValue={editing?.address || ''} rows={2} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps Embed URL</label>
            <Textarea name="mapsEmbed" defaultValue={editing?.mapsEmbed || ''} rows={3} placeholder="https://www.google.com/maps/embed?pb=..." />
            <p className="text-xs text-gray-400 mt-1">Ambil dari Google Maps → Share → Embed a map → URL dalam src=""</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <select name="isActive" defaultValue={editing?.isActive ?? 1} className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="1">Aktif</option>
              <option value="0">Nonaktif</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white min-h-[44px]">Simpan</Button>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1 min-h-[44px]">Batal</Button>
          </div>
        </fetcher.Form>
      </Modal>
    </div>
  );
}

// ============ BANK ACCOUNT TAB ============
function BankAccountTab({ bankAccounts }: { bankAccounts: any[] }) {
  const fetcher = useFetcher();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Rekening Pembayaran</h2>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="bg-red-600 hover:bg-red-700 text-white gap-2 text-sm min-h-[44px]">
          <Plus size={16} />Tambah Rekening
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Bank</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">No. Rekening</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Atas Nama</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {bankAccounts.map((b: any) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{b.bankName}</td>
                <td className="px-4 py-3 font-mono">{b.accountNumber}</td>
                <td className="px-4 py-3">{b.accountHolder}</td>
                <td className="px-4 py-3">
                  {b.isActive ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Aktif</span>
                  ) : (
                    <fetcher.Form method="post" className="inline">
                      <input type="hidden" name="intent" value="setActiveBankAccount" />
                      <input type="hidden" name="id" value={b.id} />
                      <button type="submit" className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full hover:bg-green-100 hover:text-green-700 transition-colors">
                        Set Aktif
                      </button>
                    </fetcher.Form>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => { setEditing(b); setModalOpen(true); }} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center">
                      <Pencil size={14} />
                    </button>
                    <fetcher.Form method="post" onSubmit={(e) => { if (!confirm('Hapus rekening ini?')) e.preventDefault(); }}>
                      <input type="hidden" name="intent" value="deleteBankAccount" />
                      <input type="hidden" name="id" value={b.id} />
                      <button type="submit" className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center">
                        <Trash2 size={14} />
                      </button>
                    </fetcher.Form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Rekening' : 'Tambah Rekening'}>
        <fetcher.Form method="post" onSubmit={() => setModalOpen(false)} className="space-y-4">
          <input type="hidden" name="intent" value="saveBankAccount" />
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Bank</label>
            <Input name="bankName" defaultValue={editing?.bankName || ''} placeholder="BCA, Mandiri, BNI..." required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Rekening</label>
            <Input name="accountNumber" defaultValue={editing?.accountNumber || ''} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Atas Nama</label>
            <Input name="accountHolder" defaultValue={editing?.accountHolder || ''} required />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white min-h-[44px]">Simpan</Button>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1 min-h-[44px]">Batal</Button>
          </div>
        </fetcher.Form>
      </Modal>
    </div>
  );
}

// ============ FACILITY TAB ============
function FacilityTab({ facilities }: { facilities: any[] }) {
  const fetcher = useFetcher();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Fasilitas</h2>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="bg-red-600 hover:bg-red-700 text-white gap-2 text-sm min-h-[44px]">
          <Plus size={16} />Tambah Fasilitas
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Label</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Icon</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Urutan</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {facilities.map((f: any) => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{f.label}</td>
                <td className="px-4 py-3 font-mono text-xs">{f.icon}</td>
                <td className="px-4 py-3">{f.sortOrder}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${f.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {f.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => { setEditing(f); setModalOpen(true); }} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center">
                      <Pencil size={14} />
                    </button>
                    <fetcher.Form method="post" onSubmit={(e) => { if (!confirm('Hapus fasilitas ini?')) e.preventDefault(); }}>
                      <input type="hidden" name="intent" value="deleteFacility" />
                      <input type="hidden" name="id" value={f.id} />
                      <button type="submit" className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center">
                        <Trash2 size={14} />
                      </button>
                    </fetcher.Form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Fasilitas' : 'Tambah Fasilitas'}>
        <fetcher.Form method="post" onSubmit={() => setModalOpen(false)} className="space-y-4">
          <input type="hidden" name="intent" value="saveFacility" />
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
            <Input name="label" defaultValue={editing?.label || ''} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Icon (Lucide)</label>
            <select name="icon" defaultValue={editing?.icon || 'Check'} className="w-full border rounded-lg px-3 py-2 text-sm min-h-[44px]">
              {LUCIDE_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Urutan</label>
              <Input type="number" name="sortOrder" defaultValue={editing?.sortOrder || 0} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select name="isActive" defaultValue={editing?.isActive ?? 1} className="w-full border rounded-lg px-3 py-2 text-sm min-h-[44px]">
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white min-h-[44px]">Simpan</Button>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1 min-h-[44px]">Batal</Button>
          </div>
        </fetcher.Form>
      </Modal>
    </div>
  );
}

// ============ HOW TO STEP TAB ============
function HowToStepTab({ steps }: { steps: any[] }) {
  const fetcher = useFetcher();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div>
      <h2 className="font-semibold text-gray-900 mb-4">Cara Sewa (4 Step Tetap)</h2>
      <div className="space-y-4">
        {steps.map((step: any) => (
          <div key={step.id} className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-900">Step {step.stepNumber}</span>
              <button
                onClick={() => setEditing(editing === step.id ? null : step.id)}
                className="text-sm text-red-600 hover:underline min-h-[36px] px-3"
              >
                {editing === step.id ? 'Tutup' : 'Edit'}
              </button>
            </div>
            {editing === step.id ? (
              <fetcher.Form method="post" onSubmit={() => setEditing(null)} className="space-y-3">
                <input type="hidden" name="intent" value="saveHowToStep" />
                <input type="hidden" name="id" value={step.id} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <Input name="title" defaultValue={step.title} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                  <Textarea name="description" defaultValue={step.description} rows={3} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                  <select name="icon" defaultValue={step.icon} className="w-full border rounded-lg px-3 py-2 text-sm min-h-[44px]">
                    {LUCIDE_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                </div>
                <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white gap-2 min-h-[44px]">
                  <Save size={16} />Simpan
                </Button>
              </fetcher.Form>
            ) : (
              <div>
                <p className="font-medium text-gray-800 mb-1">{step.title}</p>
                <p className="text-sm text-gray-500">{step.description}</p>
                <p className="text-xs text-gray-400 mt-1">Icon: {step.icon}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ FAQ TAB ============
function FaqTab({ faqs }: { faqs: any[] }) {
  const fetcher = useFetcher();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">FAQ</h2>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="bg-red-600 hover:bg-red-700 text-white gap-2 text-sm min-h-[44px]">
          <Plus size={16} />Tambah FAQ
        </Button>
      </div>

      <div className="space-y-3">
        {faqs.map((faq: any) => (
          <div key={faq.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{faq.question}</p>
                <p className="text-xs text-gray-500 mt-1 truncate">{faq.answer}</p>
                <div className="flex gap-2 mt-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${faq.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {faq.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <span className="text-xs text-gray-400">urutan: {faq.sortOrder}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => { setEditing(faq); setModalOpen(true); }} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center">
                  <Pencil size={14} />
                </button>
                <fetcher.Form method="post" onSubmit={(e) => { if (!confirm('Hapus FAQ ini?')) e.preventDefault(); }}>
                  <input type="hidden" name="intent" value="deleteFaq" />
                  <input type="hidden" name="id" value={faq.id} />
                  <button type="submit" className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center">
                    <Trash2 size={14} />
                  </button>
                </fetcher.Form>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit FAQ' : 'Tambah FAQ'}>
        <fetcher.Form method="post" onSubmit={() => setModalOpen(false)} className="space-y-4">
          <input type="hidden" name="intent" value="saveFaq" />
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pertanyaan</label>
            <Input name="question" defaultValue={editing?.question || ''} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jawaban</label>
            <Textarea name="answer" defaultValue={editing?.answer || ''} rows={4} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Urutan</label>
              <Input type="number" name="sortOrder" defaultValue={editing?.sortOrder || 0} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select name="isActive" defaultValue={editing?.isActive ?? 1} className="w-full border rounded-lg px-3 py-2 text-sm min-h-[44px]">
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white min-h-[44px]">Simpan</Button>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1 min-h-[44px]">Batal</Button>
          </div>
        </fetcher.Form>
      </Modal>
    </div>
  );
}
