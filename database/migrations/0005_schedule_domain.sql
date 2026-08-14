-- SAKALA V2 — Schedule Domain & Validation Engine Schema (Bagian 21 / 85)
-- Jalankan lewat Supabase SQL Editor, atau `supabase db push` kalau pakai CLI.
-- Prasyarat: 0004_schedule_model.sql sudah dijalankan (schedule_model +
-- slot_template dipakai sebagai referensi konfigurasi & fixed slot yang
-- dicek di Application layer / Conflict Engine).

-- =========================================================
-- 21.3 / 85 — SCHEDULE VERSION
-- Wadah untuk assignment berstatus committed. Baris baru dibuat lewat
-- commit eksplisit (Bagian 68 — "CANDIDATE tidak boleh mengubah COMMITTED
-- SCHEDULE sebelum explicit commit"), bukan mutasi diam-diam.
-- =========================================================
create table if not exists schedule_version (
  id uuid primary key default gen_random_uuid(),
  academic_context_id uuid not null references academic_context(id) on delete cascade,
  label text not null check (char_length(trim(label)) >= 2),
  created_by uuid,
  source text not null default 'manual' check (source in ('manual', 'generated', 'imported', 'ai_assisted')),
  status text not null default 'active' check (status in ('active', 'superseded', 'archived')),
  change_summary text,
  created_at timestamptz not null default now()
);

create index if not exists schedule_version_context_idx on schedule_version (academic_context_id);

-- =========================================================
-- 21 / 85 — SCHEDULE ASSIGNMENT
-- Minimum field per Bagian 21/85: academicContextId, classId, subjectId,
-- teacherId, roomId?, day, periodStart, periodEnd, activityType, status,
-- source, versionId. Claude addition: schedule_model_id ditambahkan (tidak
-- disebut eksplisit di spesifikasi) supaya Conflict Engine tahu konfigurasi
-- (room mode, hari aktif) mana yang berlaku untuk assignment ini — flag
-- untuk direview. periodStart/periodEnd merujuk nomor_urut di jam_pelajaran
-- (Phase 04) untuk (academic_context_id, day) yang sama — DICEK di
-- Application layer, bukan foreign key langsung (jam_pelajaran tidak
-- punya unique constraint pada nomor_urut saja, hanya per hari).
-- =========================================================
create table if not exists schedule_assignment (
  id uuid primary key default gen_random_uuid(),
  academic_context_id uuid not null references academic_context(id) on delete cascade,
  schedule_model_id uuid not null references schedule_model(id) on delete cascade,
  class_id uuid not null references kelas(id),
  subject_id uuid not null references mata_pelajaran(id),
  teacher_id uuid not null references guru(id),
  room_id uuid references ruangan(id),
  day text not null check (day in ('senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu')),
  period_start integer not null check (period_start >= 1),
  period_end integer not null check (period_end >= period_start),
  -- Bagian 20.2 jenis_slot direuse sebagai activityType — assignment biasa
  -- = 'belajar_mengajar', nilai lain merepresentasikan aktivitas tetap yang
  -- sengaja dijadwalkan eksplisit (bukan auto-block dari Slot Template).
  activity_type text not null default 'belajar_mengajar' check (
    activity_type in ('belajar_mengajar', 'upacara', 'religi', 'istirahat', 'libur', 'custom')
  ),
  -- Bagian 21.2
  status text not null default 'draft' check (status in ('draft', 'candidate', 'committed', 'archived', 'cancelled')),
  -- Bagian 21.1
  source text not null default 'manual' check (source in ('manual', 'generated', 'imported', 'ai_assisted')),
  -- Bagian 21.3 — "Committed schedule must belong to a schedule version."
  version_id uuid references schedule_version(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_assignment_committed_needs_version check (
    status <> 'committed' or version_id is not null
  )
);

create index if not exists schedule_assignment_context_idx on schedule_assignment (academic_context_id);
create index if not exists schedule_assignment_model_idx on schedule_assignment (schedule_model_id);
create index if not exists schedule_assignment_version_idx on schedule_assignment (version_id);
-- Dipakai Conflict Engine untuk query overlap per hari (Bagian 22.1-22.3).
create index if not exists schedule_assignment_day_idx on schedule_assignment (academic_context_id, day, status);
create index if not exists schedule_assignment_teacher_idx on schedule_assignment (teacher_id, day, status);
create index if not exists schedule_assignment_class_idx on schedule_assignment (class_id, day, status);
create index if not exists schedule_assignment_room_idx on schedule_assignment (room_id, day, status);

-- =========================================================
-- Trigger updated_at otomatis
-- =========================================================
create trigger trg_schedule_assignment_updated_at before update on schedule_assignment
  for each row execute function set_updated_at();

-- =========================================================
-- Row Level Security — WAJIB aktif (Bagian 40).
-- =========================================================
alter table schedule_version enable row level security;
alter table schedule_assignment enable row level security;

create policy "authenticated_read_schedule_version" on schedule_version for select to authenticated using (true);
create policy "authenticated_write_schedule_version" on schedule_version for all to authenticated using (true) with check (true);

create policy "authenticated_read_schedule_assignment" on schedule_assignment for select to authenticated using (true);
create policy "authenticated_write_schedule_assignment" on schedule_assignment for all to authenticated using (true) with check (true);

-- =========================================================
-- ⚠️ SEMENTARA, HAPUS SETELAH LOGIN DIBANGUN ⚠️
-- HAPUS 2 POLICY INI begitu Authentication (step 22) selesai.
-- =========================================================
create policy "TEMP_anon_all_schedule_version" on schedule_version for all to anon using (true) with check (true);
create policy "TEMP_anon_all_schedule_assignment" on schedule_assignment for all to anon using (true) with check (true);

-- =========================================================
-- PENTING — Data API exposure (kebijakan Supabase berubah 30 Mei 2026):
-- tabel baru TIDAK otomatis ter-expose ke Data API lagi.
-- Setelah run script ini, buka:
--   Supabase Dashboard → Table Editor → (pilih tabel) → API Settings
-- dan aktifkan akses untuk: schedule_version, schedule_assignment.
-- =========================================================
