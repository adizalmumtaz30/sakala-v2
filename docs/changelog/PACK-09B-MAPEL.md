# SAKALA V2.3 — Pack 09b (lanjutan): Mata Pelajaran Diperkaya

Ditemukan saat audit konsolidasi Pack 09+10: modul Mata Pelajaran belum
mengikuti Bagian 29-34 SAKALA V2.3 (baru Nama/Kode/Status/TargetJP — versi
lama sebelum revisi). Pack ini melengkapinya, additive terhadap Pack 09
(Guru) dan Pack 10 (Import engine) yang sudah solid.

## Yang ditambahkan
- `database/migrations/0007_mapel_extended.sql`: kolom baru `kelompok`,
  `warna_jadwal`, `prioritas_penjadwalan` (enum tinggi/normal/rendah),
  `jenis_mapel` (enum akademik/muatan_lokal/ekstrakurikuler/bimbingan_konseling)
  — semua nullable. **Tidak mengubah/menghapus** `target_jp_per_rombel` karena
  sudah dipakai `lib/domain/candidateGeneration.ts` (Bagian 32).
- `lib/domain/mata-pelajaran.ts`: entity/draft diperluas + validasi format
  (hex warna, enum prioritas/jenis) hanya jika field diisi — kosong tetap
  valid (pola sama dengan Guru, Bagian 98).
- `lib/data-access/mata-pelajaran.repository.ts` & `.usecases.ts`: mengikuti
  kolom baru, tambah `getMataPelajaranById` (konsisten dengan Guru).
- `lib/domain/mapel-import.ts` & `app/mata-pelajaran/import/template/route.ts`:
  kolom baru ikut divalidasi & masuk template resmi + sheet REFERENSI berisi
  nilai enum yang valid.
- `app/mata-pelajaran/MataPelajaranWorkspace.tsx`: form diubah jadi dua kolom
  (form + **live preview**, Bagian 30 & 87) memakai `Modal size="lg"` (baru,
  di `components/ui/Modal.tsx`, backward compatible — default tetap `md`).
  Preview update real-time tanpa submit: nama, kode, JP/minggu, warna, status,
  kelompok. Warna dipilih lewat swatch preset (bukan color picker bebas) sesuai
  prinsip "premium bukan berarti ramai" (Bagian 92).
- List Mata Pelajaran: tabel diberi titik warna + kolom Kelompok & Prioritas.

## Sengaja belum dikerjakan
- Pembagian Mengajar, Pengaturan Jadwal redesign, Tambah Jadwal redesign,
  animation system, super script diagnose+fix — menunggu pack berikutnya.

## Cara pakai
1. Jalankan migration `0007_mapel_extended.sql` **setelah** 0001-0006.
2. Deploy seperti biasa — tidak ada dependency baru di pack ini.
