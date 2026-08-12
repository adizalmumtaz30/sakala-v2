# SAKALA V2 Enterprise

Dibangun mengikuti **Master Build Pipeline** (`docs/specification/MASTER-SPECIFICATION-BUILD-ORDER-v2.3.md`,
Bagian 2). **Mulai dari sini** → baca `SETUP.md` untuk setup dari nol
(folder, GitHub, Supabase, Vercel).

## Status Fase 1 (selesai)

| Step | Cakupan |
|---|---|
| 01–03 | Governance, IA (10 Core sesuai Bagian 6.1), Technical Foundation |
| 04 | Design Tokens (`tailwind.config.ts`, `app/globals.css`) |
| 05 | Application Shell — Sidebar, Header, Command Palette (⌘K) |
| 06 | Foundation Components — Button, Input, Modal, Card, Badge, Empty/Error/Skeleton state |
| 07–08 | Data Table Contract, Form System, Loading/Empty/Error/Success states |
| 10 | Core Data — **Guru** (CRUD penuh, tersambung Supabase, layer Domain → Application → Data Access) |

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

## Yang BELUM dibangun (menyusul, sesuai urutan pipeline)

- Step 09: Academic Context switcher + Admin School Profile
- Step 10 (lanjutan): Mata Pelajaran, Kelas, Ruangan (pola sama seperti Guru)
- Step 11: Akademik Core (tahun ajaran, semester, time model)
- Step 12–13: Schedule Model + Conflict/Validation Engine
- Step 14–15: Jadwal Cerdas (generator) + Jadwal Operational Workspace
- Step 16: Dashboard (baru dibangun setelah data & schedule stabil — hard rule Bagian 2)
- Step 17+: Analytics, History, Notifications, AI Assistant, Import/Export, Auth, dst.

Kabari urutan prioritas mana yang mau dikerjakan berikutnya.
