# SAKALA V2 Enterprise

Dibangun mengikuti **Master Build Pipeline** (`docs/specification/MASTER-SPECIFICATION-BUILD-ORDER-v2.3.md`,
Bagian 2). **Mulai dari sini** → baca `SETUP.md` untuk setup dari nol
(folder, GitHub, Supabase, Vercel).

## Status (selesai s.d. Phase 04)

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

## Catatan desain Phase 04 (Akademik Core)

Hierarki temporal Bagian 19/83 (`Tahun Ajaran → Semester → Periode Akademik →
Minggu → Hari → Jam Pelajaran`) diimplementasikan sebagian sebagai tabel CRUD,
sebagian sebagai turunan — spesifikasi hanya mendefinisikan field konkret
untuk Periode Akademik dan Jam Pelajaran, tidak untuk "Minggu" sebagai entity
tersendiri:

- **Periode Akademik** — tabel `periode_akademik`, terikat `academic_context_id`.
- **Jam Pelajaran** — tabel `jam_pelajaran`, satu baris = satu slot pada satu
  hari tertentu (bukan template global), supaya "school days are configurable"
  (Bagian 19.1) benar-benar berlaku — durasi/jumlah jam boleh beda per hari.
  `durationMinutes` **tidak** disimpan mentah, dihitung di Domain layer dari
  `waktu_mulai`/`waktu_selesai`.
- **Minggu** dan **Hari** (sebagai baris data) **belum** dibuat tabel
  tersendiri — belum ada field/invariant eksplisit di spesifikasi untuk
  keduanya selain apa yang sudah tercakup di Jam Pelajaran (`hari`) dan
  Periode Akademik (rentang tanggal). Kalau nanti Jadwal Cerdas/Jadwal (step
  14–15) butuh representasi mingguan eksplisit (kalender, minggu efektif vs
  libur), itu akan ditambahkan di fase tersebut. **Ini keputusan Claude, belum
  dikonfirmasi eksplisit user** — flag untuk direview.
- Validasi tambahan (di luar spesifikasi eksplisit, murni pencegahan bug):
  Periode Akademik tidak boleh tumpang tindih tanggal dalam satu konteks; Jam
  Pelajaran tidak boleh bentrok nomor urut atau rentang waktu pada hari yang
  sama.

## Yang BELUM dibangun (menyusul, sesuai urutan pipeline)

- Step 12–13: Schedule Model + Conflict/Validation Engine
- Step 14–15: Jadwal Cerdas (generator) + Jadwal Operational Workspace
- Step 16: Dashboard (baru dibangun setelah data & schedule stabil — hard rule Bagian 2)
- Step 17+: Analytics, History, Notifications, AI Assistant, Import/Export, Auth, dst.

Kabari urutan prioritas mana yang mau dikerjakan berikutnya.
