# SAKALA V2.3 — Pack 09c: Pembagian Mengajar + Bugfix Regresi

## Yang baru — Pembagian Mengajar (Bagian 35-36, 72-75)
Layer penghubung Master Data (Guru+Mapel+Kelas) ke Jadwal, terikat satu
Academic Context aktif (bukan teks Tahun Ajaran/Semester — pola sama dengan
`schedule_model`).

- `database/migrations/0008_pembagian_mengajar.sql`: tabel baru, unique
  constraint (context, guru, mapel, kelas) mencegah duplikasi.
- `lib/domain/pembagianMengajar.ts`: entity + `summarizeJp()` (status
  kosong/sebagian/penuh/lebih dari JP terjadwal vs target).
- `lib/data-access/pembagianMengajar.repository.ts`: SELECT pakai nested
  join Supabase (guru/mata_pelajaran/kelas) — list UI tidak perlu N+1 query.
- `lib/application/pembagianMengajar.usecases.ts`: JP terjadwal dihitung
  live dari `schedule_assignment` (draft/candidate/committed dihitung
  terpakai, archived/cancelled diabaikan). **Soft-delete** (Bagian 80-81):
  kalau sudah punya JP terjadwal, hapus permanen ditolak dengan pesan
  forensic — arahkan ke nonaktifkan.
- `lib/domain/pembagianMengajar-import.ts`: import dengan **reference
  resolution** (Bagian 75) — kolom file berisi Nama/Kode Guru-Mapel dan
  label Kelas, bukan ID mentah, di-resolve lewat lookup Map yang dibangun
  Application layer dari data Guru/Mapel/Kelas yang sudah ada.
- `app/pembagian-mengajar/` (page, actions, Workspace, route template) —
  list dengan progress bar JP + toggle status, form tambah/edit (select
  Guru/Mapel/Kelas + JP), Import pakai `ImportModal` yang sama dengan
  Guru/Mapel. **Template import-nya unik**: sheet REFERENSI DINAMIS, isinya
  daftar Guru/Mapel/Kelas yang sesungguhnya ada di database saat file
  di-download (bukan referensi statis seperti template Guru/Mapel).
- Menu baru di Sidebar: Data → Pembagian Mengajar.

## Bug fix regresi ditemukan saat audit
`app/jadwal/JadwalWorkspace.tsx` (Phase 08) kembali melanggar Rules of Hooks
— guard `if (!activeContext) return` diletakkan sebelum semua
`useState`/`useMemo`. Ini bug yang sama yang sudah pernah diperbaiki di
audit Phase 08 sebelumnya; regresi terjadi karena ZIP yang diaudit di pack
ini dibangun dari baseline yang berbeda. Diperbaiki lagi dengan pola yang
sama: guard dipindah ke setelah hook terakhir (`toast`), sebelum fungsi
handler pertama (`openAdd`). Ditambahkan komentar eksplisit di kode supaya
tidak regresi lagi ke depannya.

Juga diperbarui (dokumentasi basi, bukan bug fungsional):
`app/page.tsx` step 15 (`Jadwal Operational Workspace`) masih `done:false`
padahal sudah lengkap — diupdate + ditambah baris status Pack 09 V2.3 &
Pembagian Mengajar. `README.md` header status & bagian "Yang BELUM
dibangun" diperbarui, ditambah bagian "Pack 09 — Revisi SAKALA V2.3".

## Verifikasi
`tsc --noEmit` (tsc global tanpa node_modules) — semua error murni
"Cannot find module" + JSX-children-noise (identik pola lama). Brace/paren
balance dicek otomatis di semua file baru/diubah. Grep ulang linearitas di
seluruh tree (termasuk `.md`) — 0 fitur, hanya kalimat penegasan.

## Sengaja belum dikerjakan
Tambah Jadwal & Pengaturan Jadwal BELUM disambungkan ke Pembagian Mengajar
sebagai assignment selector (Bagian 37-53/73) — Pembagian Mengajar sudah
siap dipakai, tinggal disambung di pack berikutnya.

## Cara pakai
1. Jalankan `database/migrations/0008_pembagian_mengajar.sql` setelah
   0001-0007.
2. Expose tabel `pembagian_mengajar` ke Data API di Supabase Dashboard.
3. Deploy seperti biasa — tidak ada dependency baru.
