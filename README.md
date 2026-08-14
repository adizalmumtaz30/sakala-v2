# SAKALA V2 Enterprise

Dibangun mengikuti **Master Build Pipeline** (`docs/specification/MASTER-SPECIFICATION-BUILD-ORDER-v2.3.md`,
Bagian 2). **Mulai dari sini** → baca `SETUP.md` untuk setup dari nol
(folder, GitHub, Supabase, Vercel).

## Status (selesai s.d. Phase 08)

| Step | Cakupan |
|---|---|
| 01–03 | Governance, IA (10 Core sesuai Bagian 6.1), Technical Foundation |
| 04 | Design Tokens (`tailwind.config.ts`, `app/globals.css`) |
| 05 | Application Shell — Sidebar, Header, Command Palette (⌘K) |
| 06 | Foundation Components — Button, Input, Modal, Card, Badge, Empty/Error/Skeleton state |
| 07–08 | Data Table Contract, Form System, Loading/Empty/Error/Success states |
| 09 | **Academic Context + Admin Profile** (`/akademik`) — School Profile (singleton), daftar Academic Context, switch konteks aktif (single-active ditegakkan di DB via partial unique index), context pill read-only di Header |
| 10 | Core Data — **Guru, Mata Pelajaran, Kelas, Ruangan** (CRUD penuh untuk keempatnya, tersambung Supabase, layer Domain → Application → Data Access) |
| 11 | **Akademik Core** (`/akademik`, tab baru) — **Periode Akademik** (rentang tanggal dalam satu konteks, cegah tumpang tindih) & **Jam Pelajaran** (slot waktu per hari, bedakan pembelajaran/istirahat, cegah bentrok nomor urut & waktu) — keduanya CRUD penuh, terikat ke konteks akademik aktif |
| 12 | **Schedule Model + Slot Template** (`/akademik`, tab baru "Model Jadwal") — **Schedule Model** (konfigurasi: nama, waktu mulai, durasi standar, maks JP/hari, hari aktif, hari libur, room mode, penggunaan rombel, status), CRUD penuh per konteks aktif; **Slot Template** dikelola per model lewat "Kelola Slot" — menandai jenis slot (Belajar Mengajar/Upacara/Religi/Istirahat/Libur/Custom) untuk (hari, nomor urut) tertentu, divalidasi harus merujuk periode yang benar-benar terdaftar di Jam Pelajaran |
| 13 | **Schedule Domain & Validation Engine** (backend murni, tidak ada UI baru) — entity Schedule Assignment + Schedule Version, Conflict Engine (`validateAssignmentCandidate`, 8 dari 9 tipe konflik aktif), use case `saveAssignmentDraft`/`commitAssignments` (satu-satunya jalur status jadi committed, batch atomic) |
| 14 | **Jadwal Cerdas** (`/jadwal-cerdas`) — Generate (isi requirement manual per kelas+mapel+guru+ruangan+target JP, generate candidate lewat algoritma greedy round-robin, murni preview dulu) → Review & Commit (tabel candidate + badge konflik, hapus per baris, jalankan Optimasi untuk candidate yang bentrok, pilih baris lalu commit jadi Schedule Version baru) |
| 15 | **Jadwal Operational Workspace** (`/jadwal`) — grid mingguan/harian (hari × jam pelajaran) untuk assignment berstatus **committed**; view Per Kelas/Per Guru/Per Ruangan; Tambah Jadwal langsung dari sel kosong eligible (Save Draft atau Simpan & Commit); Edit/Pindahkan (kembalikan ke draft → commit ulang → Schedule Version baru otomatis jadi histori perubahan); Hapus (committed diarsipkan, draft/candidate dihapus permanen); Duplikat (salin ke sel kosong lain) |

## Arsitektur

Kontrak Bagian 3.1 dijaga di dalam satu Next.js app (disederhanakan dari
rekomendasi monorepo penuh — lihat catatan di README chat):

```
app/                    ← Presentation (route, layout, page)
components/ui/          ← Foundation components
components/layout/      ← Shell (Sidebar, Header, Command Palette)
lib/domain/              ← Entity, validasi, business rule murni
lib/application/         ← Use case / orchestration
lib/data-access/         ← Repository (satu-satunya yang query Supabase)
lib/supabase/            ← Supabase client (browser + server)
lib/config/              ← Satu-satunya tempat baca process.env
database/migrations/     ← SQL schema
docs/specification/      ← Dokumen spesifikasi (source of truth)
```

Pola untuk Guru (`lib/domain/guru.ts` → `lib/application/guru.usecases.ts` →
`lib/data-access/guru.repository.ts` → `app/guru/`) adalah **cetakan** untuk
Mata Pelajaran, Kelas, Ruangan berikutnya — strukturnya sengaja dibuat identik
supaya gampang direplikasi.

## Catatan pemulihan migration (Phase 05)

`database/migrations/0003_academic_core.sql` ternyata **hilang** dari ZIP Phase 04
yang diserahkan sebelumnya — kode Domain/Application/Data-Access untuk Periode
Akademik & Jam Pelajaran sudah ada dan benar, tapi migration SQL-nya tidak ikut
ter-generate. File itu sudah dibuat ulang di Phase 05 ini, persis mengikuti
bentuk kolom yang sudah dipakai repository yang ada. **Kalau kamu sudah pernah
menjalankan migration Phase 04 versi manapun di Supabase, cek dulu apakah tabel
`periode_akademik` dan `jam_pelajaran` sudah ada** sebelum menjalankan
`0003_academic_core.sql` ulang (script pakai `create table if not exists`,
aman dijalankan ulang, tapi tetap baca urutannya di SETUP.md).

## Catatan desain Phase 05 (Schedule Model + Slot Template)

Bagian 20/84 mendefinisikan Schedule Model sebagai **konfigurasi, bukan
timetable**, dengan field: model name, start time, standard duration, max
periods/day, active days, holidays, academic context, room mode, rombel
usage, status. Beberapa detail tidak dirinci eksplisit di spesifikasi —
berikut keputusan Claude yang **belum dikonfirmasi user**, flag untuk direview:

- **Route** — spesifikasi tidak memberi route eksplisit untuk step 12. Schedule
  Model + Slot Template ditempatkan sebagai tab baru "Model Jadwal" di
  `/akademik`, mengikuti pola Periode Akademik & Jam Pelajaran sebelumnya.
- **Status aktif/nonaktif** — di Schedule Model dibiarkan sebagai flag per
  baris biasa (seperti Periode Akademik & Jam Pelajaran), **bukan singleton**
  seperti Academic Context. Satu konteks boleh punya beberapa model
  (mis. "Model Reguler", "Model Ramadhan") aktif sekaligus. Kalau nanti Jadwal
  Cerdas (step 14) ternyata butuh SATU model aktif yang jelas untuk generate,
  aturan singleton perlu ditambahkan saat itu.
- **Penggunaan rombel** — dimodelkan sebagai dua mode eksplisit: `seragam`
  (satu konfigurasi untuk semua rombel) vs `per_rombel`. Spesifikasi menyebut
  field ini tanpa merinci nilai yang mungkin.
- **Slot Template** (Bagian 20.2) hanya menyimpan baris untuk (hari, nomor
  urut) yang eksplisit ditandai suatu jenis slot — jam yang tidak
  didaftarkan otomatis dianggap "Belajar Mengajar" biasa. Divalidasi di
  Application layer: (hari, nomor urut) yang dirujuk **wajib** sudah
  terdaftar di Jam Pelajaran (Phase 04) untuk konteks akademik model
  tersebut — supaya Slot Template tidak pernah mendefinisikan periode hantu.

## Catatan desain Phase 06 (Schedule Domain & Validation Engine)

Bagian 21/22/23/85/86 — step 13 ini **tidak punya UI/route baru** (hard rule
Bagian 2: Dashboard & workspace jadwal baru dibangun di step 14-15/16) — murni
Domain + Application + Data Access, siap dipanggil Jadwal Cerdas (step 14) dan
Jadwal Operational Workspace (step 15) berikutnya.

- **Tabel baru**: `schedule_assignment` (satu baris = satu penempatan kelas
  pada rentang periode di suatu hari) dan `schedule_version` (wadah untuk
  assignment yang sudah di-commit, Bagian 21.3).
- **`schedule_model_id` di `schedule_assignment`** — Claude addition, tidak
  disebut eksplisit di Bagian 21/85. Diperlukan supaya Conflict Engine tahu
  konfigurasi room mode & hari aktif mana yang berlaku — flag untuk direview.
- **`periodStart`/`periodEnd`** merujuk `nomor_urut` di Jam Pelajaran (Phase
  04) untuk (konteks, hari) yang sama — divalidasi di Application layer
  (`INVALID_PERIOD`), bukan foreign key langsung.
- **`activityType`** reuse enum `jenis_slot` dari Slot Template (Bagian 20.2)
  — assignment biasa = `belajar_mengajar`; nilai lain untuk aktivitas tetap
  yang sengaja dijadwalkan eksplisit (bukan auto-block dari Slot Template).
- **Conflict Engine** (`lib/application/conflictEngine.ts`) — satu pintu
  masuk `validateAssignmentCandidate()`, mengecek 8 dari 9 tipe conflict
  minimum (Bagian 23.2): `TEACHER_OVERLAP`, `CLASS_OVERLAP`, `ROOM_OVERLAP`,
  `FIXED_SLOT`, `INVALID_PERIOD`, `INACTIVE_ENTITY`, `MISSING_REQUIRED_FIELD`,
  `CONTEXT_MISMATCH`. **`JP_MISMATCH` (Bagian 22.5) belum aktif** — reconciliation
  butuh "configured subject target" yang sumber datanya belum dibangun
  (menyusul di Regulation/Target JP View, step 21/29); tipe & state
  (`complete`/`incomplete`/`over`) sudah didefinisikan di
  `lib/domain/conflict.ts` supaya tinggal disambungkan nanti.
- **`INACTIVE_ENTITY`** (Bagian 22.6) — Claude addition: full block (severity
  Error) hanya untuk assignment yang langsung berstatus `committed`;
  draft/candidate hanya dapat Warning supaya penyusunan rencana tetap
  fleksibel sebelum entity terkait diaktifkan lagi — flag untuk direview.
- **Commit** (`commitAssignments()`) adalah **satu-satunya** jalur assignment
  boleh berstatus `committed` (Bagian 68: "CANDIDATE tidak boleh mengubah
  COMMITTED SCHEDULE sebelum explicit commit") — semua assignment dalam satu
  batch divalidasi ulang dulu, satu blocking conflict saja membatalkan
  seluruh batch (no partial commit), baru Schedule Version baru dibuat.

## Catatan desain Phase 07 (Jadwal Cerdas)

Bagian 24/87 — step 14, route pertama untuk domain jadwal (`/jadwal-cerdas`).
Mengikuti pipeline: Load Context → Select Scope → Load Constraints →
Normalize → Generate Candidate → Validate → Conflict Detection → Candidate
Review → Optional Optimization → Final Validation → Commit → Create Version.

- **Target JP manual per run** — keputusan eksplisit user: Target JP resmi
  (Bagian 89) belum punya sumber data (menyusul Target JP View, step 21/29),
  jadi "Load Constraints" di UI meminta user mengisi kombinasi
  kelas+mapel+guru+ruangan+target JP secara manual per run generate. Kalau
  Mata Pelajaran sudah punya `targetJpPerRombel` terisi, field Target JP
  di-pre-fill otomatis (masih bisa diubah manual).
- **Algoritma generate** (`lib/application/candidateGenerator.ts`,
  `generateCandidatePreview()`) — greedy round-robin per hari aktif Schedule
  Model, satu JP = satu unit periode (periodStart=periodEnd), menghormati
  occupancy guru/kelas/ruangan dari assignment aktif yang sudah ada +
  assignment yang baru ditempatkan dalam batch yang sama. **Bukan true
  constraint solver** (tidak backtrack lintas requirement) — keputusan
  Claude, cukup untuk baseline, flag untuk ditingkatkan kalau perlu.
- **Preview murni sebelum simpan** — `generateCandidatePreview()` TIDAK
  menulis ke DB; hasil ditampilkan dulu (placed/unplaced per requirement),
  baru `saveGeneratedCandidates()` menyimpannya sebagai baris
  `status="candidate"` setelah user menekan tombol eksplisit (Bagian 68: no
  silent mutation). Draft yang ternyata bentrok saat disimpan (state DB
  berubah sejak preview) DILEWATI per-baris, bukan membatalkan seluruh batch.
- **Optimasi** (`optimizeCandidateBatch()`/`applyOptimization()`, Bagian
  24.4) — Claude addition: HANYA memproses candidate yang punya blocking
  conflict saat ini (bukan re-generate semua dari nol), mencoba relokasi ke
  slot bebas lain, assignment yang sudah bersih tidak disentuh. Preview
  Before/After/Changes/Remaining Conflict ditampilkan dulu, user pilih "Keep
  Current" atau "Apply Optimization" (Bagian 24.4 — harus eksplisit).
- **Commit** — UI memanggil `commitAssignments()` yang SUDAH ada dari Phase
  06 (tidak ada logika baru), reuse penuh: batch atomic, satu blocking
  conflict membatalkan seluruh batch, Schedule Version baru dibuat.
- **Audit trail** (tahap terakhir pipeline Bagian 24.2) — belum ada UI/log
  aktivitas tersendiri; saat ini terwakili implisit lewat Schedule Version
  (`createdAt`, `changeSummary`). Activity log penuh adalah tanggung jawab
  Riwayat (step 18) — flag untuk direview saat step itu dibangun.
- **Tidak ada migration baru** — step ini murni Application + Presentation
  di atas tabel `schedule_assignment`/`schedule_version` yang sudah dibuat
  Phase 06.

## Catatan desain Phase 08 (Jadwal Operational Workspace)

Bagian 25/26/27/28/88 — step 15, route `/jadwal` (sebelumnya placeholder).
Ini "Jadwal is the committed/operational timetable" — jadi grid hanya
menampilkan `schedule_assignment` berstatus `committed`; draft/candidate
tetap hanya terlihat di Jadwal Cerdas (step 14).

- **Domain baru: `lib/domain/jadwalGrid.ts`** — `buildJadwalGrid()`, fungsi
  murni (TIDAK import Supabase) yang menyusun read-model grid (hari x
  nomor urut) dari data yang sudah diambil pemanggil. Cell state
  (Bagian 25.3): `empty`, `occupied`, `fixed_activity`, `conflict` dihitung
  di sini; `loading`/`error` murni state UI client-side; `incomplete`/
  `complete` BELUM dipakai secara aktif (butuh Target JP — step 21/29,
  belum ada sumber data, sama seperti dicatat di Phase 06/07) — flag untuk
  direview saat step itu dibangun. `conflict` di grid mendeteksi anomali
  (>1 assignment aktif di sel yang sama) sebagai jaring pengaman tampilan,
  bukan pengganti Conflict Engine — commit tetap satu-satunya yang
  menegakkan blocking conflict sebelum data sampai ke grid ini.
- **3 use case baru di `scheduleAssignment.usecases.ts`** (dipanggil dari
  `app/jadwal/actions.ts`, TIDAK ada akses repository langsung dari
  Presentation — aturan layering tetap dipegang):
  - `addAssignment()` — Bagian 26 (Add Schedule Workflow), orkestrasi
    Save Draft / Commit dalam satu panggilan (reuse `saveAssignmentDraft` +
    `commitAssignments`, TIDAK ada jalur commit baru).
  - `moveAssignment()` — Bagian 27 (Move/Edit). TIDAK ada "edit di tempat"
    untuk assignment committed (itu akan melanggar Bagian 21.3) — sebagai
    gantinya assignment dikembalikan ke `draft` dulu lalu di-`commitAssignments`
    ulang, yang otomatis menghasilkan Schedule Version baru sebagai
    pengganti "Create history" (step 18 History belum dibangun).
  - `archiveOrDeleteAssignment()` — Bagian 28 (Delete). Claude addition:
    assignment `committed` di-**archive** (bukan hard delete) supaya
    Schedule Version yang sudah tercatat tetap utuh; draft/candidate tetap
    dihapus permanen. Field alasan hapus di UI TIDAK dipersist (belum ada
    tabel histori) — murni catatan sesaat untuk user, flag untuk direview
    di step 18.
- **Views** — "Per Kelas/Per Guru/Per Ruangan" = filter assignments by
  entity + toggle "Mingguan/Harian" = filter jumlah kolom hari yang
  dikirim ke `buildJadwalGrid()` (harian = 1 kolom, bukan renderer
  terpisah). "Per Ruangan" otomatis disabled kalau `modeRuangan` Schedule
  Model = `tidak_dipakai`.
- **Duplicate** (Bagian 25.5 context menu) — diimplementasi sebagai mode:
  klik "Duplikat" pada assignment → banner aktif → klik sel kosong
  eligible manapun untuk membuka Add modal ter-prefill dari sumber
  duplikat (field lain tetap harus dipilih ulang sesuai slot baru).
- **Tidak ada migration baru** — murni Application + Presentation di atas
  tabel yang sudah ada (Phase 04/06).

## Yang BELUM dibangun (menyusul, sesuai urutan pipeline)

- Step 16: Dashboard (baru dibangun setelah data & schedule stabil — hard rule Bagian 2)
- Step 17+: Analytics, History, Notifications, AI Assistant, Import/Export, Auth, dst.
- `JP_MISMATCH` reconciliation + cell state `incomplete`/`complete` di grid Jadwal (butuh Target JP, step 21/29 — lihat catatan Phase 06/08)
- Generator constraint solver yang lebih canggih (backtrack lintas requirement) kalau greedy Phase 07 terasa kurang — lihat catatan Phase 07 di atas
- Delete reason & audit trail Move/Edit belum persisten ke tabel histori nyata (step 18)

Kabari urutan prioritas mana yang mau dikerjakan berikutnya.
