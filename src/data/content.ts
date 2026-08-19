/**
 * Isi landing mitrakost.com. Copy final ada di src/data/copy-draft.md.
 * Ubah teks di sini, bukan di dalam file .astro.
 */

export const site = {
  nama: 'Mitra Kost',
  domain: 'https://mitrakost.com',
  kota: 'Sumedang',
  waNomor: '6282233005808',
  waTampil: '0822-3300-5808',
  email: 'mitrakostsumedang@gmail.com',
  totalKamar: 57,
};

export const waLink = (pesan: string) =>
  `https://wa.me/${site.waNomor}?text=${encodeURIComponent(pesan)}`;

export const hero = {
  h1: 'Kos 1 Menit Jalan Kaki ke Alun-Alun Sumedang',
  sub: '57 kamar di dua lokasi, mulai Rp800 ribu per bulan. Kamar mandi dalam di semua tipe, WiFi, CCTV 24 jam, parkir mobil tanpa biaya tambahan.',
  cta: 'Tanya Kamar Kosong lewat WhatsApp',
  gambar: '/images/hero/hero1.webp',
  gambarAlt: 'Bangunan Mitra Kost Sumedang',
};

export type Tipe = {
  slug: string;
  nama: string;
  harga1: number;
  harga2: number;
  isi: string[];
  tanpa: string[];
  foto: string;
};

export const tipeKamar: Tipe[] = [
  {
    slug: 'ekonomi',
    nama: 'Ekonomi',
    harga1: 800000,
    harga2: 900000,
    isi: ['Kamar 3x4', 'Kamar mandi dalam', 'Toilet jongkok', 'Lemari'],
    tanpa: ['AC', 'Water heater'],
    foto: '/images/rooms/budiasih/ekonomi/budiasih-ekonomi2.webp',
  },
  {
    slug: 'standar',
    nama: 'Standar',
    harga1: 1100000,
    harga2: 1250000,
    isi: ['Kamar 3x4', 'Kamar mandi dalam', 'Toilet duduk', 'AC', 'Lemari'],
    tanpa: ['Water heater'],
    foto: '/images/rooms/budiasih/standar/salinan-rts02705.webp',
  },
  {
    slug: 'suite',
    nama: 'Suite',
    harga1: 1500000,
    harga2: 1700000,
    isi: ['Kamar 3x4', 'Kamar mandi dalam', 'Toilet duduk', 'AC', 'Water heater', 'Lemari'],
    tanpa: [],
    foto: '/images/rooms/budiasih/suite/salinan-rts02746.webp',
  },
  {
    slug: 'deluxe',
    nama: 'Deluxe',
    harga1: 1800000,
    harga2: 2000000,
    isi: ['Kamar besar', 'Kamar mandi dalam', 'Toilet duduk', 'AC', 'Water heater', 'Lemari'],
    tanpa: [],
    foto: '/images/rooms/budiasih/deluxe/salinan-rts02743.webp',
  },
];

export const lokasi = [
  {
    nama: 'Mitra Kost Budi Asih',
    ringkas: 'Budi Asih, Sumedang',
    jumlah: 41,
    keterangan:
      'Ekonomi, Standar, Suite, dan Deluxe ada di sini. Paling dekat ke alun-alun.',
    maps: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3961.2564698602127!2d107.91953837608081!3d-6.859834893138678!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNsKwNTEnMzUuNCJTIDEwN8KwNTUnMTMuNSJF!5e0!3m2!1sid!2sid!4v1600000000000',
  },
  {
    nama: 'Mitra Kost Jatihurip',
    ringkas: 'Jatihurip, Sumedang',
    jumlah: 16,
    keterangan:
      'Isinya Deluxe semua, 16 kamar. Cocok kalau kamu mau yang lebih luas dan lebih tenang.',
    maps: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3961.5282352217832!2d107.91829725089536!3d-6.827082449210693!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNsKwNDknMzcuNSJTIDEwN8KwNTUnMDUuOSJF!5e0!3m2!1sid!2sid!4v1600000000001',
  },
];

export const fasilitas = [
  { label: 'WiFi', catatan: 'Semua tipe' },
  { label: 'CCTV 24 jam', catatan: 'Jalur masuk, koridor, parkir' },
  { label: 'Parkir mobil', catatan: 'Dua lokasi, tanpa biaya tambahan' },
  { label: 'Kamar mandi dalam', catatan: 'Semua tipe' },
  { label: 'AC', catatan: 'Standar ke atas' },
  { label: 'Water heater', catatan: 'Suite dan Deluxe' },
];

export const caraSewa = [
  {
    judul: 'Lihat kamar kosong',
    isi: 'Daftar di halaman ini ikut isian admin, jadi yang tampil memang yang masih bisa ditempati.',
  },
  {
    judul: 'Chat admin',
    isi: 'Sebut tipe dan lokasi yang kamu mau lewat WhatsApp.',
  },
  {
    judul: 'Datang lihat kamar',
    isi: 'Boleh mampir dulu sebelum memutuskan. Janjian dulu biar ada yang bukain kamarnya.',
  },
  {
    judul: 'Bayar bulan pertama',
    isi: 'Kunci diserahkan hari itu juga.',
  },
];

export const faq = [
  {
    t: 'Bisa ditempati berdua?',
    j: 'Bisa. Tiap tipe punya harga buat satu orang dan dua orang, selisihnya Rp100 ribu sampai Rp200 ribu per bulan.',
  },
  {
    t: 'Ada kontrak minimum?',
    j: 'Minimum sewa satu bulan, dibayar di awal tiap bulannya. Nggak ada ikatan tahunan.',
  },
  {
    t: 'Bayarnya gimana?',
    j: 'Transfer bank, lalu konfirmasi ke admin lewat WhatsApp.',
  },
  {
    t: 'Boleh survei lokasi dulu?',
    j: 'Boleh. Datang langsung atau chat admin dulu buat janjian, biar ada yang bukain kamarnya.',
  },
  {
    t: 'Ada laundry?',
    j: 'Ada, kiloan Rp7.000 per kg. Terpisah dari biaya sewa, bayar sesuai pemakaian.',
  },
  {
    t: 'Bedanya apa sama kos lain di Sumedang?',
    j: 'Jaraknya satu menit jalan kaki ke Alun-Alun Sumedang, dan kamar mandi dalam sudah masuk sejak tipe paling murah. Banyak kos di harga Rp800 ribuan masih pakai kamar mandi luar.',
  },
  {
    t: 'Parkir mobil ada?',
    j: 'Ada di kedua lokasi, nggak ada biaya tambahan.',
  },
  {
    t: 'Keamanannya gimana?',
    j: 'CCTV nyala 24 jam di titik jalur masuk, koridor, dan area parkir.',
  },
];

export const penutup = {
  judul: 'Tanya Dulu, Nggak Harus Langsung Ambil',
  isi: 'Chat admin di WhatsApp. Sebut tipe kamar dan tanggal masuk yang kamu rencanakan, nanti dicek sisa kamarnya.',
  finePrint:
    'Sewa dibayar di awal tiap bulan. Harga di halaman ini berlaku untuk sewa bulanan.',
};
