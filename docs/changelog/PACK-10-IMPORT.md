# SAKALA V2.3 — Pack 10: Import Guru & Mata Pelajaran

Lanjutan dari Pack 09. Implementasi Bagian 18-28 (Import Guru), 33-34 (Import
Mapel), dan 74-79 (prinsip umum import aman) — sesuai Keputusan Final #4 & #6.

## Yang baru
- **Import engine generik** (`lib/import/`, `components/import/ImportModal.tsx`):
  satu komponen drag & drop -> parse -> preview -> confirm yang dipakai ulang
  oleh Guru dan Mapel, supaya perilaku dan tampilannya konsisten (Bagian 82:
  "Design Consistency"). Tiap modul menyuplai fungsi `onValidate`/`onCommit`
  sendiri lewat server action — aturan bisnis tetap di domain masing-masing.
- **Template resmi** (`GET /guru/import/template`, `GET /mata-pelajaran/import/template`):
  file `.xlsx` dengan 3 sheet — DATA (isi), PETUNJUK (kolom wajib/opsional +
  format + contoh), REFERENSI (nilai StatusAktif yang valid) — sesuai Bagian 21.
- **Flow aman** (Bagian 24, 78): Upload → Parse (browser, pakai `xlsx`) →
  Validate (server action, cek terhadap data existing di Supabase) → Preview
  (tabel ✓ valid / ⚠ perlu diperbaiki, pesan per baris+kolom sesuai Bagian 28)
  → Confirm → Commit (server action **re-validate dari nol**, tidak pernah
  percaya hasil validasi client) → Import. Baris tidak valid dilewati, bukan
  membatalkan seluruh proses.
- **Duplicate detection** dua arah: terhadap data yang sudah ada di database,
  dan terhadap baris lain di file yang sama (Bagian 27).
- Dependency baru: `xlsx` (SheetJS) — ditambahkan ke `package.json`. Jalankan
  `npm install` setelah extract pack ini.

## Batasan yang perlu diketahui
- **Kolom `KodeGuru` di template Guru hanya dipakai untuk cek duplikat**, bukan
  untuk menetapkan kode secara manual. Kode Guru tetap selalu di-generate
  otomatis oleh trigger database (keputusan Pack 09) — walau file impor berisi
  kode tertentu, guru hasil impor akan tetap dapat kode baru dari SAKALA.
  Kalau kamu butuh preservasi kode lama saat migrasi dari sistem lain, bilang
  saja — itu perlu penyesuaian kecil di trigger + repository.
- Import CSV memakai parser yang sama; tidak ada perbedaan flow, hanya
  ekstensi file yang diterima (`.xlsx`/`.csv`).
- Belum ada halaman riwayat/audit import (siapa impor kapan, berapa baris) —
  Bagian 79 (Audit) masih menunggu pack tersendiri.

## Cara pakai
1. `npm install` (menambahkan `xlsx`).
2. Tidak ada migration baru di pack ini — Guru & Mapel pakai skema yang sudah ada.
3. Deploy seperti biasa.
