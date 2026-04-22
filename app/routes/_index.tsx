import { useState } from "react";
import type { Route } from "./+types/_index";
import { db } from "~/lib/db.server";
import {
  Wifi, ShieldCheck, Car, Bath, Wind, Flame, MapPin, Home, ClipboardList, Smartphone,
  ChevronDown, ChevronUp, Menu, X, Check, Phone, Mail, MessageCircle, Video,
  Droplet, Key, Package, Zap,
} from "lucide-react";
import { Button } from "~/components/ui/button";

type Room = {
  id: string; number: string; type: string; price: number; priceDouble: number;
  status: string; locationId: string; locationName: string;
};
type RoomType = {
  id: string; slug: string; name: string; basePrice: number; basePriceDouble: number;
  description: string | null; isActive: number; sortOrder: number;
  features: { id: string; label: string; isIncluded: number; sortOrder: number }[];
};
type Location = { id: string; name: string; address: string; mapsEmbed: string | null; isActive: number; sortOrder: number; availableRooms?: number };
type Facility = { id: string; label: string; icon: string; sortOrder: number };
type HowToStep = { id: string; stepNumber: number; title: string; description: string; icon: string };
type Faq = { id: string; question: string; answer: string; sortOrder: number };

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Wifi, ShieldCheck, Car, Bath, Wind, Flame, Home, ClipboardList, Smartphone,
  MapPin, Video, Droplet, Key, Package, Zap, Check, Phone, Mail,
};

const ROOM_IMAGES: Record<string, string> = {
  ekonomi: "/images/rooms/budiasih/ekonomi/budiasih-ekonomi1.webp",
  standar: "/images/rooms/budiasih/standar/salinan-rts02703.webp",
  suite: "/images/rooms/budiasih/suite/salinan-rts02744.webp",
  deluxe: "/images/rooms/budiasih/deluxe/salinan-rts02743.webp",
};

export async function loader() {
  const heroItems = db.prepare("SELECT key, value FROM LandingContent WHERE section = 'hero'").all() as any[];
  const hero: Record<string, string> = {};
  heroItems.forEach((h: any) => { hero[h.key] = h.value; });

  const roomTypes = db.prepare("SELECT * FROM RoomType WHERE isActive = 1 ORDER BY sortOrder, createdAt").all() as any[];
  const allFeatures = db.prepare("SELECT * FROM RoomTypeFeature ORDER BY sortOrder").all() as any[];
  const roomTypesWithFeatures: RoomType[] = roomTypes.map((rt: any) => ({
    ...rt,
    features: allFeatures.filter((f: any) => f.roomTypeId === rt.id),
  }));

  const rooms = db.prepare(
    `SELECT r.*, l.name as locationName FROM Room r JOIN Location l ON r.locationId = l.id WHERE r.status = 'available' ORDER BY r.locationId, r.type, r.number`
  ).all() as Room[];

  const rawLocations = db.prepare("SELECT * FROM Location WHERE isActive = 1 ORDER BY sortOrder, name").all() as Location[];
  const locations = rawLocations.map((loc) => {
    const roomCount = (db.prepare("SELECT COUNT(*) as c FROM Room WHERE locationId = ? AND status = 'available'").get(loc.id) as any).c;
    return { ...loc, availableRooms: roomCount as number };
  });
  const facilities = db.prepare("SELECT * FROM Facility WHERE isActive = 1 ORDER BY sortOrder").all() as Facility[];
  const howToSteps = db.prepare("SELECT * FROM HowToStep ORDER BY stepNumber").all() as HowToStep[];
  const faqs = db.prepare("SELECT * FROM Faq WHERE isActive = 1 ORDER BY sortOrder").all() as Faq[];

  return {
    hero,
    roomTypes: roomTypesWithFeatures,
    rooms,
    availableCount: rooms.length,
    locations,
    facilities,
    howToSteps,
    faqs,
  };
}

function formatRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function typeBadgeClass(slug: string) {
  switch (slug) {
    case "ekonomi": return "bg-orange-100 text-orange-700 border-orange-200";
    case "standar": return "bg-blue-100 text-blue-700 border-blue-200";
    case "suite": return "bg-purple-100 text-purple-700 border-purple-200";
    case "deluxe": return "bg-red-100 text-red-700 border-red-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { hero, roomTypes, rooms, availableCount, locations, facilities, howToSteps, faqs } = loaderData;

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

  const headline = hero.headline || "Kos Premium di Jantung Kota Sumedang";
  const subheadline = hero.subheadline || "Nyaman untuk profesional, dokter koas, dan mahasiswa. Fasilitas lengkap, lokasi strategis.";

  return (
    <div className="min-h-screen bg-white">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="/" className="flex items-center gap-2.5">
              <img src="/images/logo/logo.png" alt="Mitra Kost" className="h-10 hidden md:block" />
              <img src="/images/logo/logo.png" alt="Mitra Kost" className="h-8 md:hidden" />
            </a>

            <nav className="hidden md:flex items-center gap-6">
              <a href="#kamar" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Tipe Kamar</a>
              <a href="#unit" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Unit Tersedia</a>
              <a href="#fasilitas" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Fasilitas</a>
              <a href="#lokasi" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Lokasi</a>
              <a href="/login">
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">Login</Button>
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
                className="block py-2 text-sm text-gray-700 hover:text-red-600 transition-colors"
              >
                {href.replace("#", "").charAt(0).toUpperCase() + href.replace("#", "").slice(1)}
              </a>
            ))}
            <a href="/login" onClick={() => setMobileMenuOpen(false)}>
              <Button size="sm" className="w-full bg-red-600 hover:bg-red-700 text-white mt-1 min-h-[44px]">Login</Button>
            </a>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative h-[90vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        <img src="/images/hero/hero1.webp" alt="Mitra Kost Sumedang" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm mb-6">
            <MapPin size={14} />
            <span>1 menit ke Alun-Alun Sumedang</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-4">
            {headline.split('\n').map((line, i) => (
              <span key={i}>{line}{i < headline.split('\n').length - 1 && <br />}</span>
            ))}
          </h1>
          <p className="text-lg sm:text-xl text-white/90 mb-10 max-w-2xl mx-auto">{subheadline}</p>

          <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            <select
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              className="flex-1 px-4 py-2.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[44px]"
            >
              <option value="semua">Semua Lokasi</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="flex-1 px-4 py-2.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[44px]"
            >
              <option value="semua">Semua Tipe</option>
              {roomTypes.map((rt) => (
                <option key={rt.slug} value={rt.slug}>{rt.name}</option>
              ))}
            </select>
            <Button
              onClick={handleSearch}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl whitespace-nowrap min-h-[44px]"
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
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Pilih Tipe Kamar Sesuai Kebutuhanmu</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Dari kamar ekonomis hingga deluxe premium, semua tersedia di dua lokasi strategis Sumedang.</p>
          </div>

          {roomTypes.length > 0 ? (
            <div className="flex gap-6 overflow-x-auto pb-4 md:grid md:grid-cols-4 md:overflow-visible snap-x snap-mandatory">
              {roomTypes.map((rt) => (
                <div key={rt.id} className="relative flex-shrink-0 w-72 md:w-auto bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow snap-start">
                  <div className="h-44 overflow-hidden">
                    <img
                      src={ROOM_IMAGES[rt.slug] || ROOM_IMAGES.ekonomi}
                      alt={`Kamar ${rt.name}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${typeBadgeClass(rt.slug)}`}>
                        {rt.name}
                      </span>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Mulai dari</p>
                        <p className="font-bold text-red-600 text-sm">{formatRupiah(rt.basePrice)}/bln</p>
                      </div>
                    </div>
                    <ul className="space-y-1.5">
                      {rt.features.map((f) => (
                        <li key={f.id} className="flex items-center gap-2 text-xs text-gray-600">
                          {f.isIncluded === 1 ? (
                            <Check size={13} className="text-green-500 flex-shrink-0" />
                          ) : (
                            <X size={13} className="text-gray-300 flex-shrink-0" />
                          )}
                          <span className={f.isIncluded === 1 ? "" : "text-gray-400 line-through"}>{f.label}</span>
                        </li>
                      ))}
                    </ul>
                    <a
                      href={`https://wa.me/6282233005808?text=Halo%2C%20saya%20tertarik%20kamar%20${encodeURIComponent(rt.name)}%20di%20Mitra%20Kost%20Sumedang`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 block"
                    >
                      <Button className="w-full bg-red-600 hover:bg-red-700 text-white text-sm min-h-[44px]">
                        Tanya Kamar Ini
                      </Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400">Belum ada tipe kamar tersedia.</p>
          )}
        </div>
      </section>

      {/* UNIT TERSEDIA */}
      <section id="unit" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Unit Tersedia Sekarang</h2>
            <p className="text-gray-500">
              <span className="font-semibold text-red-600">{availableCount} unit</span> siap ditempati
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-center mb-8">
            <button
              onClick={() => { setFilterLocation("semua"); setFilterType("semua"); setVisibleCount(8); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border min-h-[36px] ${filterLocation === "semua" && filterType === "semua" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
            >
              Semua
            </button>
            {locations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => { setFilterLocation(loc.id); setFilterType("semua"); setVisibleCount(8); }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border min-h-[36px] ${filterLocation === loc.id ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >
                {loc.name.replace("Mitra Kost ", "")}
              </button>
            ))}
            {roomTypes.map((rt) => (
              <button
                key={rt.slug}
                onClick={() => { setFilterType(rt.slug); setFilterLocation("semua"); setVisibleCount(8); }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border min-h-[36px] ${filterType === rt.slug ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >
                {rt.name}
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
                  <div key={room.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
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
                      href={`https://wa.me/6282233005808?text=Halo%2C%20saya%20tertarik%20kamar%20${room.number}%20(${room.type})%20di%20${encodeURIComponent(room.locationName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block"
                    >
                      <Button size="sm" className="w-full bg-red-600 hover:bg-red-700 text-white text-xs min-h-[36px]">Daftar</Button>
                    </a>
                  </div>
                ))}
              </div>

              {visibleCount < filteredRooms.length && (
                <div className="text-center mt-8">
                  <Button variant="outline" onClick={() => setVisibleCount((v) => v + 8)} className="border-gray-300 text-gray-700 hover:bg-gray-50 min-h-[44px]">
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
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Semua yang Kamu Butuhkan, Sudah Tersedia</h2>
            <p className="text-gray-500">Fasilitas lengkap untuk kenyamanan hidup sehari-hari.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 mb-12">
            {facilities.map((fac) => {
              const Icon = ICON_MAP[fac.icon] || Check;
              return (
                <div key={fac.id} className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-gray-100 hover:border-red-100 hover:bg-red-50/30 transition-colors">
                  <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                    <Icon className="text-red-600" size={22} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 text-center">{fac.label}</span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className={`overflow-hidden rounded-2xl ${n === 5 ? "col-span-2 md:col-span-1" : ""}`}>
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
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Cara Sewa Kamar di Mitra Kost</h2>
            <p className="text-gray-500">Proses mudah dan cepat, bisa mulai dari WhatsApp.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {howToSteps.map((step, idx) => {
              const Icon = ICON_MAP[step.icon] || Home;
              const stepLabel = String(step.stepNumber).padStart(2, "0");
              return (
                <div key={step.id} className="relative">
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 h-full">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
                        <Icon size={18} className="text-white" />
                      </div>
                      <span className="text-3xl font-black text-gray-100">{stepLabel}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
                  </div>
                  {idx < howToSteps.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-3 z-10 w-6 h-6 bg-red-100 rounded-full border-2 border-red-200" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-center mt-10 text-sm text-gray-500">
            Kunjungi langsung lokasi kami atau{" "}
            <a href="https://wa.me/6282233005808" target="_blank" rel="noopener noreferrer" className="text-red-600 underline hover:text-red-700">
              hubungi admin via WhatsApp
            </a>.
          </div>
        </div>
      </section>

      {/* LOKASI */}
      <section id="lokasi" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              {locations.length > 1 ? `${locations.length} Lokasi Strategis di Sumedang` : "Lokasi Strategis di Sumedang"}
            </h2>
            <p className="text-gray-500">Dekat pusat kota, rumah sakit, kampus, dan fasilitas umum.</p>
          </div>

          <div className={`grid grid-cols-1 ${locations.length > 1 ? "md:grid-cols-2" : ""} gap-8`}>
            {locations.map((loc) => (
              <div key={loc.id} className="rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 text-lg">{loc.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{loc.address}</p>
                  <div className="flex gap-3 mt-3 flex-wrap">
                    <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full font-medium">
                      {loc.availableRooms ?? 0} Kamar Tersedia
                    </span>
                  </div>
                </div>
                {loc.mapsEmbed ? (
                  <iframe
                    src={loc.mapsEmbed}
                    className="w-full h-56"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={`Lokasi ${loc.name}`}
                  />
                ) : (
                  <div className="w-full h-56 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                    <MapPin size={24} className="mr-2" />
                    {loc.address}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Pertanyaan yang Sering Ditanyakan</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((item, i) => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors min-h-[44px]"
                >
                  <span className="font-medium text-gray-900 pr-4">{item.question}</span>
                  {openFaq === i ? (
                    <ChevronUp size={18} className="flex-shrink-0 text-red-600" />
                  ) : (
                    <ChevronDown size={18} className="flex-shrink-0 text-gray-400" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5">
                    <p className="text-sm text-gray-600 leading-relaxed">{item.answer}</p>
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
            <a href="https://wa.me/6282233005808?text=Halo%2C%20saya%20ingin%20info%20kamar%20di%20Mitra%20Kost%20Sumedang" target="_blank" rel="noopener noreferrer">
              <Button className="bg-white text-red-600 hover:bg-red-50 gap-2 px-8 py-3 text-base font-semibold rounded-xl min-h-[44px]">
                <MessageCircle size={18} />WhatsApp Admin
              </Button>
            </a>
            <a href="tel:+6282233005808">
              <Button variant="outline" className="border-white/60 text-white hover:bg-white/10 gap-2 px-8 py-3 text-base rounded-xl min-h-[44px]">
                <Phone size={18} />Telepon Sekarang
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
                <img src="/images/logo/logo.png" alt="Mitra Kost" className="h-8 brightness-0 invert" />
              </div>
              <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                Kos premium di Sumedang dengan fasilitas lengkap dan manajemen digital modern.
              </p>
              <div className="flex flex-col gap-2 mt-4">
                <a href="tel:+6282233005808" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                  <Phone size={14} />+62 822-3300-5808
                </a>
                <a href="mailto:mitrakostsumedang@gmail.com" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                  <Mail size={14} />mitrakostsumedang@gmail.com
                </a>
              </div>
            </div>
            {locations.slice(0, 2).map((loc) => (
              <div key={loc.id}>
                <h4 className="font-semibold mb-4 text-sm uppercase tracking-wide text-gray-300">
                  {loc.name.replace("Mitra Kost ", "")}
                </h4>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {loc.name}<br />{loc.address}<br />Jawa Barat
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-800 pt-6 text-center text-sm text-gray-500">
            © 2026 Mitra Kost. Semua hak dilindungi.
          </div>
        </div>
      </footer>
    </div>
  );
}
