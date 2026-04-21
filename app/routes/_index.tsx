import { useState } from "react";
import type { Route } from "./+types/_index";
import { db } from "~/lib/db.server";
import {
  Wifi,
  ShieldCheck,
  Car,
  Bath,
  Wind,
  Flame,
  MapPin,
  Home,
  ClipboardList,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  Check,
  Phone,
  Mail,
  MessageCircle,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

type Room = {
  id: string;
  number: string;
  type: string;
  price: number;
  priceDouble: number;
  status: string;
  locationId: string;
  locationName: string;
};

export async function loader() {
  const rooms = db
    .prepare(
      `SELECT r.*, l.name as locationName
       FROM Room r
       JOIN Location l ON r.locationId = l.id
       WHERE r.status = 'available'
       ORDER BY r.locationId, r.type, r.number`
    )
    .all() as Room[];

  const availableCount = rooms.length;
  return { rooms, availableCount };
}

function formatRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

const ROOM_TYPES = [
  {
    type: "ekonomi",
    label: "Ekonomi",
    image: "/images/rooms/budiasih/ekonomi/budiasih-ekonomi1.webp",
    price: 800000,
    features: [
      { label: "Kamar 3x4", ok: true },
      { label: "Mandi Dalam", ok: true },
      { label: "Toilet Duduk", ok: false },
      { label: "AC", ok: false },
      { label: "Water Heater", ok: false },
      { label: "Lemari", ok: true },
      { label: "WiFi", ok: true },
      { label: "CCTV", ok: true },
      { label: "Parkir", ok: true },
    ],
  },
  {
    type: "standar",
    label: "Standar",
    image: "/images/rooms/budiasih/standar/salinan-rts02703.webp",
    price: 1100000,
    features: [
      { label: "Kamar 3x4", ok: true },
      { label: "Mandi Dalam", ok: true },
      { label: "Toilet Duduk", ok: true },
      { label: "AC", ok: true },
      { label: "Water Heater", ok: false },
      { label: "Lemari", ok: true },
      { label: "WiFi", ok: true },
      { label: "CCTV", ok: true },
      { label: "Parkir", ok: true },
    ],
  },
  {
    type: "suite",
    label: "Suite",
    image: "/images/rooms/budiasih/suite/salinan-rts02744.webp",
    price: 1500000,
    features: [
      { label: "Kamar 3x4", ok: true },
      { label: "Mandi Dalam", ok: true },
      { label: "Toilet Duduk", ok: true },
      { label: "AC", ok: true },
      { label: "Water Heater", ok: true },
      { label: "Lemari", ok: true },
      { label: "WiFi", ok: true },
      { label: "CCTV", ok: true },
      { label: "Parkir", ok: true },
    ],
  },
  {
    type: "deluxe",
    label: "Deluxe",
    image: "/images/rooms/budiasih/deluxe/salinan-rts02743.webp",
    price: 1800000,
    popular: true,
    features: [
      { label: "Kamar Besar", ok: true },
      { label: "Mandi Dalam", ok: true },
      { label: "Toilet Duduk", ok: true },
      { label: "AC", ok: true },
      { label: "Water Heater", ok: true },
      { label: "Lemari", ok: true },
      { label: "WiFi", ok: true },
      { label: "CCTV", ok: true },
      { label: "Parkir", ok: true },
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: "Apakah bisa ditempati 2 orang?",
    a: "Bisa. Tersedia harga untuk 1 orang dan 2 orang per tipe kamar.",
  },
  {
    q: "Apakah ada kontrak minimum?",
    a: "Minimum sewa 1 bulan, bayar di awal setiap bulan.",
  },
  {
    q: "Bagaimana cara pembayaran?",
    a: "Transfer bank, lalu konfirmasi ke admin via WhatsApp.",
  },
  {
    q: "Apakah bisa survey lokasi dulu?",
    a: "Tentu! Datang langsung atau hubungi admin untuk jadwal kunjungan.",
  },
  {
    q: "Apakah ada layanan laundry?",
    a: "Ada, layanan laundry kiloan terpisah dari biaya sewa.",
  },
  {
    q: "Apa keunggulan Mitra Kost?",
    a: "Dilengkapi dashboard digital — penghuni bisa cek tagihan, komplain, dan info kost lewat smartphone.",
  },
  {
    q: "Apakah parkir mobil tersedia?",
    a: "Ya, parkir mobil tersedia di kedua lokasi tanpa biaya tambahan.",
  },
  {
    q: "Bagaimana keamanan?",
    a: "CCTV 24 jam di area strategis.",
  },
];

function typeBadgeClass(type: string) {
  switch (type) {
    case "ekonomi":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "standar":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "suite":
      return "bg-purple-100 text-purple-700 border-purple-200";
    case "deluxe":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { rooms, availableCount } = loaderData;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filterLocation, setFilterLocation] = useState<string>("semua");
  const [filterType, setFilterType] = useState<string>("semua");
  const [visibleCount, setVisibleCount] = useState(8);
  const [openFaq, setOpenFaq] = useState(0);
  const [searchLocation, setSearchLocation] = useState("semua");
  const [searchType, setSearchType] = useState("semua");

  const filteredRooms = rooms.filter((r) => {
    const locMatch = filterLocation === "semua" || r.locationId === filterLocation;
    const typeMatch = filterType === "semua" || r.type === filterType;
    return locMatch && typeMatch;
  });

  const visibleRooms = filteredRooms.slice(0, visibleCount);

  function handleSearch() {
    setFilterLocation(searchLocation);
    setFilterType(searchType);
    setVisibleCount(8);
    document.getElementById("unit")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-white">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <div>
                <span className="font-bold text-gray-900 text-lg leading-none block">Mitra Kost</span>
                <span className="text-xs text-gray-500 leading-none">Kos Premium Sumedang</span>
              </div>
            </a>

            <nav className="hidden md:flex items-center gap-6">
              <a href="#kamar" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Tipe Kamar</a>
              <a href="#unit" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Unit Tersedia</a>
              <a href="#fasilitas" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Fasilitas</a>
              <a href="#lokasi" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Lokasi</a>
              <a href="/login">
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                  Login
                </Button>
              </a>
            </nav>

            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-2">
            {["#kamar", "#unit", "#fasilitas", "#lokasi"].map((href) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm text-gray-700 hover:text-red-600 transition-colors capitalize"
              >
                {href.replace("#", "").charAt(0).toUpperCase() + href.replace("#", "").slice(1)}
              </a>
            ))}
            <a href="/login" onClick={() => setMobileMenuOpen(false)}>
              <Button size="sm" className="w-full bg-red-600 hover:bg-red-700 text-white mt-1">
                Login
              </Button>
            </a>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative h-[90vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        <img
          src="/images/hero/hero1.webp"
          alt="Mitra Kost Sumedang"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm mb-6">
            <MapPin size={14} />
            <span>1 menit ke Alun-Alun Sumedang</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-4">
            Kos Premium di<br />Jantung Kota Sumedang
          </h1>
          <p className="text-lg sm:text-xl text-white/90 mb-10 max-w-2xl mx-auto">
            Nyaman untuk profesional, dokter koas, dan mahasiswa. Fasilitas lengkap, lokasi strategis.
          </p>

          {/* Search Bar */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            <select
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              className="flex-1 px-4 py-2.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="semua">Semua Lokasi</option>
              <option value="budiasih">Budiasih</option>
              <option value="jatihurip">Jatihurip</option>
            </select>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="flex-1 px-4 py-2.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="semua">Semua Tipe</option>
              <option value="ekonomi">Ekonomi</option>
              <option value="standar">Standar</option>
              <option value="suite">Suite</option>
              <option value="deluxe">Deluxe</option>
            </select>
            <Button
              onClick={handleSearch}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl whitespace-nowrap"
            >
              Cari Kamar
            </Button>
          </div>
        </div>
      </section>

      {/* TIPE KAMAR */}
      <section id="kamar" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Pilih Tipe Kamar Sesuai Kebutuhanmu
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Dari kamar ekonomis hingga deluxe premium, semua tersedia di dua lokasi strategis Sumedang.
            </p>
          </div>

          <div className="flex gap-6 overflow-x-auto pb-4 md:grid md:grid-cols-4 md:overflow-visible snap-x snap-mandatory">
            {ROOM_TYPES.map((rt) => (
              <div
                key={rt.type}
                className="relative flex-shrink-0 w-72 md:w-auto bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow snap-start"
              >
                {rt.popular && (
                  <div className="absolute top-3 right-3 z-10">
                    <span className="bg-red-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                      Terpopuler
                    </span>
                  </div>
                )}
                <div className="h-44 overflow-hidden">
                  <img
                    src={rt.image}
                    alt={`Kamar ${rt.label}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${typeBadgeClass(rt.type)}`}>
                      {rt.label}
                    </span>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Mulai dari</p>
                      <p className="font-bold text-red-600 text-sm">{formatRupiah(rt.price)}/bln</p>
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {rt.features.map((f) => (
                      <li key={f.label} className="flex items-center gap-2 text-xs text-gray-600">
                        {f.ok ? (
                          <Check size={13} className="text-green-500 flex-shrink-0" />
                        ) : (
                          <X size={13} className="text-gray-300 flex-shrink-0" />
                        )}
                        <span className={f.ok ? "" : "text-gray-400 line-through"}>{f.label}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`https://wa.me/6282233005808?text=Halo%2C%20saya%20tertarik%20kamar%20${rt.label}%20di%20Mitra%20Kost%20Sumedang`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 block"
                  >
                    <Button className="w-full bg-red-600 hover:bg-red-700 text-white text-sm">
                      Tanya Kamar Ini
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* UNIT TERSEDIA */}
      <section id="unit" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Unit Tersedia Sekarang
            </h2>
            <p className="text-gray-500">
              <span className="font-semibold text-red-600">{availableCount} unit</span> siap ditempati
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {[
              { val: "semua", label: "Semua", loc: "semua", type: "semua" },
              { val: "budiasih", label: "Budiasih", loc: "budiasih", type: "semua" },
              { val: "jatihurip", label: "Jatihurip", loc: "jatihurip", type: "semua" },
            ].map((f) => (
              <button
                key={f.val + "loc"}
                onClick={() => { setFilterLocation(f.loc); setFilterType(f.type); setVisibleCount(8); }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  filterLocation === f.loc && filterType === "semua" && f.val !== "budiasih" && f.val !== "jatihurip"
                    ? "bg-gray-900 text-white border-gray-900"
                    : filterLocation === f.loc && f.val !== "semua"
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {f.label}
              </button>
            ))}
            {["ekonomi", "standar", "suite", "deluxe"].map((t) => (
              <button
                key={t}
                onClick={() => { setFilterType(t); setFilterLocation("semua"); setVisibleCount(8); }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  filterType === t
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {filteredRooms.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg">Tidak ada kamar tersedia dengan filter ini.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {visibleRooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-bold text-gray-900 text-lg">{room.number}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${typeBadgeClass(room.type)}`}>
                        {room.type}
                      </span>
                    </div>
                    <p className="text-red-600 font-semibold text-sm">{formatRupiah(room.price)}<span className="text-gray-400 font-normal">/bln</span></p>
                    {room.priceDouble > 0 && (
                      <p className="text-gray-400 text-xs mt-0.5">{formatRupiah(room.priceDouble)}/bln (2 org)</p>
                    )}
                    <p className="text-gray-400 text-xs mt-2 flex items-center gap-1">
                      <MapPin size={11} />
                      {room.locationName}
                    </p>
                    <a
                      href={`https://wa.me/6282233005808?text=Halo%2C%20saya%20tertarik%20kamar%20${room.number}%20(${room.type})%20di%20${room.locationName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block"
                    >
                      <Button size="sm" className="w-full bg-red-600 hover:bg-red-700 text-white text-xs">
                        Daftar
                      </Button>
                    </a>
                  </div>
                ))}
              </div>

              {visibleCount < filteredRooms.length && (
                <div className="text-center mt-8">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount((v) => v + 8)}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Lihat {Math.min(filteredRooms.length - visibleCount, 8)} kamar lainnya
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* FASILITAS */}
      <section id="fasilitas" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Semua yang Kamu Butuhkan, Sudah Tersedia
            </h2>
            <p className="text-gray-500">Fasilitas lengkap untuk kenyamanan hidup sehari-hari.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 mb-12">
            {[
              { icon: Wifi, label: "WiFi Kencang" },
              { icon: ShieldCheck, label: "CCTV 24 Jam" },
              { icon: Car, label: "Parkir Mobil" },
              { icon: Bath, label: "Kamar Mandi Dalam" },
              { icon: Wind, label: "AC" },
              { icon: Flame, label: "Water Heater" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-gray-100 hover:border-red-100 hover:bg-red-50/30 transition-colors">
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                  <Icon className="text-red-600" size={22} />
                </div>
                <span className="text-sm font-medium text-gray-700 text-center">{label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className={`overflow-hidden rounded-2xl ${n === 5 ? "col-span-2 md:col-span-1" : ""}`}
              >
                <img
                  src={`/images/facilitiees/facilities${n}.webp`}
                  alt={`Fasilitas Mitra Kost ${n}`}
                  className="w-full h-48 md:h-56 object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CARA SEWA */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Cara Sewa Kamar di Mitra Kost
            </h2>
            <p className="text-gray-500">Proses mudah dan cepat, bisa mulai dari WhatsApp.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                icon: Home,
                step: "01",
                title: "Pilih Kamar",
                desc: "Pilih tipe dan lokasi kamar yang sesuai kebutuhanmu dari daftar unit tersedia.",
              },
              {
                icon: MapPin,
                step: "02",
                title: "Kunjungi atau Hubungi",
                desc: (
                  <>
                    Kunjungi langsung lokasi kami atau hubungi admin via{" "}
                    <a
                      href="https://wa.me/6282233005808"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 font-medium hover:underline"
                    >
                      WhatsApp
                    </a>
                    .
                  </>
                ),
              },
              {
                icon: ClipboardList,
                step: "03",
                title: "Isi Form & Bayar",
                desc: "Isi form pendaftaran lengkap dan bayar bulan pertama untuk konfirmasi kamar.",
              },
              {
                icon: Smartphone,
                step: "04",
                title: "Akses Dashboard",
                desc: "Setelah disetujui, akses dashboard penghuni untuk cek tagihan, komplain, dan info kost.",
              },
            ].map(({ icon: Icon, step, title, desc }) => (
              <div key={step} className="relative">
                <div className="bg-white rounded-2xl p-6 border border-gray-200 h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
                      <Icon size={18} className="text-white" />
                    </div>
                    <span className="text-3xl font-black text-gray-100">{step}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
                {step !== "04" && (
                  <div className="hidden md:block absolute top-1/2 -right-3 z-10 w-6 h-6 bg-red-100 rounded-full border-2 border-red-200" />
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <a
              href="https://wa.me/6282233005808?text=Halo%2C%20saya%20ingin%20tanya%20informasi%20kamar%20di%20Mitra%20Kost%20Sumedang"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-green-600 hover:bg-green-700 text-white gap-2 px-8 py-3 text-base rounded-xl">
                <MessageCircle size={18} />
                Chat WhatsApp Sekarang
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* LOKASI */}
      <section id="lokasi" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Dua Lokasi Strategis di Sumedang
            </h2>
            <p className="text-gray-500">Dekat pusat kota, rumah sakit, kampus, dan fasilitas umum.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 text-lg">Mitra Kost Budi Asih</h3>
                <p className="text-sm text-gray-500 mt-0.5">Budi Asih, Sumedang</p>
                <div className="flex gap-3 mt-3">
                  <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full font-medium">
                    41 Kamar Tersedia
                  </span>
                  <span className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1 rounded-full">
                    Ekonomi · Standar · Suite · Deluxe
                  </span>
                </div>
              </div>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3961.2564698602127!2d107.91953837608081!3d-6.859834893138678!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e68d18ddcd2cc3f%3A0x512c4e81fbdcee5b!2sMitra%20Kost%20-%20Budi%20Asih%20Sumedang!5e0!3m2!1sen!2sid!4v1776659473067!5m2!1sen!2sid"
                className="w-full h-56"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Lokasi Mitra Kost Budi Asih"
              />
            </div>

            <div className="rounded-2xl border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 text-lg">Mitra Kost Jatihurip</h3>
                <p className="text-sm text-gray-500 mt-0.5">Jatihurip, Sumedang</p>
                <div className="flex gap-3 mt-3">
                  <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full font-medium">
                    16 Kamar Deluxe
                  </span>
                  <span className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1 rounded-full">
                    Khusus Deluxe Premium
                  </span>
                </div>
              </div>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3961.5282352217832!2d107.91829725089536!3d-6.827082449210693!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e68d7fa62e3d775%3A0xbe82b2db8891e1a2!2sMitra%20Kost%20-%20Jatihurip%20Sumedang!5e0!3m2!1sen!2sid!4v1776659497496!5m2!1sen!2sid"
                className="w-full h-56"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Lokasi Mitra Kost Jatihurip"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Pertanyaan yang Sering Ditanyakan
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-900 pr-4">{item.q}</span>
                  {openFaq === i ? (
                    <ChevronUp size={18} className="flex-shrink-0 text-red-600" />
                  ) : (
                    <ChevronDown size={18} className="flex-shrink-0 text-gray-400" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5">
                    <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA STRIP */}
      <section className="py-16 bg-red-600">
        <div className="max-w-4xl mx-auto px-4 text-center text-white">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Siap Pindah ke Mitra Kost?</h2>
          <p className="text-red-100 mb-8">Hubungi admin sekarang untuk survey dan reservasi kamar.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://wa.me/6282233005808?text=Halo%2C%20saya%20ingin%20info%20kamar%20di%20Mitra%20Kost%20Sumedang"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-white text-red-600 hover:bg-red-50 gap-2 px-8 py-3 text-base font-semibold rounded-xl">
                <MessageCircle size={18} />
                WhatsApp Admin
              </Button>
            </a>
            <a href="tel:+6282233005808">
              <Button variant="outline" className="border-white/60 text-white hover:bg-white/10 gap-2 px-8 py-3 text-base rounded-xl">
                <Phone size={18} />
                Telepon Sekarang
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">M</span>
                </div>
                <span className="font-bold text-lg">Mitra Kost</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                Kos premium di Sumedang dengan fasilitas lengkap dan manajemen digital modern.
              </p>
              <div className="flex flex-col gap-2 mt-4">
                <a href="tel:+6282233005808" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                  <Phone size={14} />
                  +62 822-3300-5808
                </a>
                <a href="mailto:mitrakostsumedang@gmail.com" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                  <Mail size={14} />
                  mitrakostsumedang@gmail.com
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wide text-gray-300">Budiasih</h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                Mitra Kost Budi Asih<br />
                Budi Asih, Sumedang<br />
                Jawa Barat
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wide text-gray-300">Jatihurip</h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                Mitra Kost Jatihurip<br />
                Jatihurip, Sumedang<br />
                Jawa Barat
              </p>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6 text-center text-sm text-gray-500">
            © 2026 Mitra Kost. Semua hak dilindungi.
          </div>
        </div>
      </footer>
    </div>
  );
}
