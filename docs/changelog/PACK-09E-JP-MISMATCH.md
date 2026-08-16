# SAKALA V2.3 — Pack 09e: JP_MISMATCH Reconciliation Disambungkan ke Conflict Engine

Melengkapi Bagian 22.5/23.2: `JP_MISMATCH` sudah terdaftar sejak Phase 06
sebagai salah satu `ConflictType` minimum, tapi baru berupa nama tanpa
logika — Target JP (`jpPerMinggu`, Pembagian Mengajar Pack 09c) belum
dibaca oleh Conflict Engine. Pack ini menyambungkan keduanya.

## Desain
Spesifikasi (Bagian 22.5) berbunyi "Configured subject target and
**committed** schedule must reconcile" — jadi pengecekan ini **hanya
dievaluasi saat kandidat assignment yang divalidasi berstatus
`"committed"`**, bukan setiap kali draft/candidate berubah. Alasan:
- Menyusun jadwal secara bertahap (draft/candidate) itu wajar belum
  lengkap — kalau JP_MISMATCH ikut muncul di tahap ini akan berisik
  (setiap baris baru selalu "belum lengkap" sampai baris terakhir).
- Jadwal Cerdas (Pack 09d) sudah menampilkan **JP tersisa** secara live
  dari Pembagian Mengajar saat menyusun candidate — kebutuhan "progress
  view" saat drafting sudah terpenuhi lewat jalur lain.
- Titik paling bermakna untuk cek reconciliation adalah saat commit,
  karena itu saat status berubah jadi bagian resmi Schedule Version.

Hanya berlaku untuk `activityType === "belajar_mengajar"` (aktivitas
tetap seperti Upacara tidak punya target JP) dan hanya kalau kombinasi
Guru+Mapel+Kelas itu punya Pembagian Mengajar **aktif** — kombinasi tanpa
target dilewati begitu saja (additive, konsisten dengan prinsip Pack 09d:
tidak semua assignment wajib berasal dari Pembagian Mengajar).

Severity **tidak pernah blocking** (bukan `"error"`): total JP yang
kurang atau lebih dari target adalah sinyal untuk ditinjau, bukan
pelanggaran struktural yang harus dicegah — sekolah bisa saja sengaja
menjadwalkan lebih/kurang dari target di kasus tertentu.
- `"over"` (total committed melebihi target) → severity `"warning"`.
- `"incomplete"` (masih kurang dari target) → severity `"info"`.
- `"complete"` (pas) → tidak menghasilkan conflict sama sekali.

## Perubahan
- `lib/domain/pembagianMengajar.ts` — export `JpSummaryStatus` (tipe hasil
  `summarizeJp()`, sebelumnya inline) supaya bisa dipakai domain lain
  tanpa duplikasi daftar nilai.
- `lib/domain/conflict.ts` — tambah `toJpReconciliationState()`: memetakan
  `JpSummaryStatus` ("kosong"/"sebagian"/"penuh"/"lebih") ke
  `JpReconciliationState` ("incomplete"/"complete"/"over") sesuai bahasa
  spesifikasi Bagian 22.5. Komentar `JpReconciliationState` yang tadinya
  bilang "target belum ada sumber data" diperbarui (sudah usang sejak
  Pembagian Mengajar/Pack 09c ada).
- `lib/data-access/pembagianMengajar.repository.ts` — tambah
  `findActiveByCombination()`: cari Pembagian Mengajar berstatus "aktif"
  untuk satu kombinasi Guru+Mapel+Kelas+Konteks.
- `lib/application/conflictEngine.ts` — blok baru di
  `validateAssignmentCandidate()`: kalau kandidat `committed` dan
  `belajar_mengajar` dan kombinasinya punya target aktif, hitung total JP
  committed kombinasi tsb (termasuk kandidat ini, exclude assignment yang
  sedang diedit lewat `excludeId`) lewat
  `scheduleAssignmentRepository.findByContext()`, lalu emit conflict
  `JP_MISMATCH` sesuai state di atas.

### Plumbing supaya hasilnya benar-benar terlihat (bukan cuma dihitung)
`commitAssignments()` sudah mengembalikan `conflictsByAssignment` sejak
awal, tapi ternyata **dibuang** oleh semua pemanggilnya. Diperbaiki juga
di pack ini supaya JP_MISMATCH tidak sekadar dihitung lalu hilang:
- `lib/application/scheduleAssignment.usecases.ts` — `addAssignment()`
  (saat `commit=true`) dan `moveAssignment()` sekarang mengembalikan
  `conflicts` dari `result.conflictsByAssignment`, bukan cuma level
  draft/dibuang begitu saja.
- `app/jadwal/actions.ts` — `moveAssignmentAction` return type ditambah
  `conflicts: ScheduleConflict[]`.
- `app/jadwal/JadwalWorkspace.tsx` — toast setelah Tambah Jadwal (commit)
  dan Pindah Jadwal sekarang menyertakan catatan non-blocking (fungsi
  baru `buildCommitToast()`) alih-alih pesan generik polos.
- `app/jadwal-cerdas/actions.ts` / `JadwalCerdasWorkspace.tsx` — jalur
  Review & Commit sudah lebih dulu punya pola `postCommitConflicts` yang
  tepat (state terpisah + card "Catatan non-blocking pasca-commit" di
  bawah tombol Commit) — dikonfirmasi otomatis ikut menampilkan
  JP_MISMATCH tanpa perubahan tambahan.

## Verifikasi
`tsc --noEmit` pada seluruh project — error yang muncul di file yang
disentuh pack ini semuanya pola noise environmental yang sama dengan
pack-pack sebelumnya (Cannot find module karena tidak ada node_modules,
JSX-children-noise) — tidak ada error baru yang menyebut simbol yang
ditambahkan pack ini (`toJpReconciliationState`, `findActiveByCombination`,
`buildCommitToast`, dst). Brace/paren balance dicek otomatis — OK.

## Sengaja belum dikerjakan
- Belum ada halaman/reconciliation view khusus yang menampilkan status
  JP semua kombinasi sekaligus (semacam dashboard "kombinasi mana yang
  over/incomplete") — saat ini reconciliation hanya muncul reaktif per
  assignment setelah commit. Kalau dibutuhkan, ini flag untuk pack
  berikutnya.
- Belum ada opsi "izinkan over" eksplisit dari user (mis. checkbox
  konfirmasi) — warning `"over"` saat ini murni informatif, tidak ada
  jalur untuk meng-acknowledge/dismiss secara permanen per kombinasi.
