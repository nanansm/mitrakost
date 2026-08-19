# mitrakost.com

Landing statik Mitra Kost Sumedang. Astro, tanpa database, tanpa JavaScript di sisi pengunjung.

## Cara kerja

Ketersediaan kamar dibaca dari satu Google Sheet **saat build**. Sheet gagal dibaca, situs
memakai `src/data/rooms-snapshot.json` supaya build tidak pernah gagal.

Kolom sheet (baris pertama wajib persis begini):

    kode,lokasi,tipe,nomor,status,harga_1_orang,harga_2_orang

`status` diisi `kosong`, `terisi`, atau `perbaikan`. Selain `kosong` dianggap tidak tersedia.

## Perintah

    npm install
    npm run dev      # http://localhost:4321
    npm run build    # hasil ke dist/

## Mengubah isi halaman

Teks ada di `src/data/content.ts`. Draft copy dan catatan QC ada di `src/data/copy-draft.md`.
Jangan menulis teks langsung di dalam file `.astro`.

## Deploy

Cloudflare Pages, akun Simaung. Push ke `main` memicu build.
Env yang dibutuhkan saat build: `SHEET_CSV_URL`.
