# SAKALA V2.3 — Pack 09: Guru Module Upgrade

Lanjutan dari PACK-08. Fokus: Keputusan Final #1 dan #2 dari SAKALA V2.3
(Linearitas dihapus, Form Guru disederhanakan dengan progressive disclosure).

## 1. Audit Linearitas — sudah bersih
Di-scan seluruh codebase (`.ts`, `.tsx`, `.sql`) untuk referensi `linear` /
`linearity` / `non_linear`. Satu-satunya kecocokan adalah `linear-gradient`
di `app/globals.css` (CSS, bukan fitur linearitas). **Tidak ada perubahan
diperlukan** — konsep linearitas memang belum pernah diimplementasikan.

## 2. Guru — field baru + progressive disclosure
- `database/migrations/0006_guru_extended.sql`: kolom baru `kode_guru`,
  `nip`, `nuptk`, `email`, `no_telepon` (semua nullable). `kode_guru`
  di-generate otomatis oleh trigger Postgres (`G-001`, `G-002`, ...) via
  sequence, termasuk backfill untuk data lama.
- `lib/domain/guru.ts`: entity & draft diperluas; validasi tetap hanya
  mewajibkan Nama (≥3 karakter) + validasi format email HANYA jika diisi.
- `lib/data-access/guru.repository.ts`: query & mapping mengikuti kolom
  baru; field kosong disimpan sebagai `NULL`.
- `lib/application/guru.usecases.ts`: tambah `getGuruById`; `toggleGuruStatus`
  diperbarui supaya tidak menghapus field opsional saat toggle status.
- `app/guru/actions.ts`: signature diringkas menerima `GuruDraft` langsung.
- `app/guru/GuruWorkspace.tsx`: list diubah dari tabel ke card list dengan
  avatar; form dipecah jadi Nama* → Kode Guru (readonly, otomatis) → Status →
  section collapsible "Informasi Tambahan" (NIP/NUPTK/Email/Telepon).
- `app/guru/[id]/page.tsx` (baru): halaman detail guru menampilkan
  Informasi Tambahan yang sudah diisi (Bagian 86).
- `components/ui/Avatar.tsx` + `lib/utils/avatar.ts` (baru): avatar inisial
  dengan warna stabil per nama, reusable untuk entitas lain di pack
  berikutnya.

## Sengaja BELUM dikerjakan di pack ini (di-scope ke pack selanjutnya)
- **Import/Export Guru** (template XLSX, drag & drop, preview, validasi
  baris, duplicate detection) — Bagian 18–28. Ini modul besar sendiri;
  digabung sekarang berisiko terburu-buru dan tidak sesuai standar
  forensic error reporting yang diminta di spesifikasi.
- **Statistik "Pengajaran" di halaman detail Guru** (JP, jumlah kelas,
  jumlah mapel) — sengaja tidak ditampilkan karena modul Pembagian Mengajar
  belum dibangun. Menampilkan angka di sini berarti data dummy, yang
  dilarang eksplisit di spesifikasi (Bagian 03D, 97).
- **Live preview saat mengetik nama** (Bagian 87) — belum diimplementasikan,
  gampang ditambahkan begitu form Mapel (yang memang butuh live preview)
  dikerjakan di pack berikutnya, supaya polanya konsisten.
- Redesain Mata Pelajaran, Pembagian Mengajar, Pengaturan Jadwal, Tambah
  Jadwal, dan animation system — belum disentuh, menunggu pack berikutnya.

## Cara pakai
1. Jalankan migration `0006_guru_extended.sql` di Supabase (SQL editor atau
   `supabase db push`), **setelah** migration 0001–0005 sudah jalan.
2. Deploy kode seperti biasa (push ke `adizalmumtaz30/sakala-v2`, Vercel
   auto-deploy).
3. Guru lama otomatis dapat Kode Guru lewat backfill di migration — tidak
   perlu migrasi data manual.
