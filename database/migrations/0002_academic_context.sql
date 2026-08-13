-- SAKALA V2 — Academic Context + Admin Profile Schema (Bagian 8, 77, 78)
-- Jalankan lewat Supabase SQL Editor, atau `supabase db push` kalau pakai CLI.
-- Prasyarat: 0001_core_data.sql sudah dijalankan (fungsi set_updated_at() dipakai ulang).

-- =========================================================
-- 8.2 / 77 — ACADEMIC CONTEXT
-- Semua academic query/mutation memakai academicContextId, bukan text label.
-- Hanya boleh ada SATU baris dengan is_active = true pada satu waktu
-- (ditegakkan oleh unique index parsial di bawah, bukan cuma di application layer).
-- =========================================================
create table if not exists academic_context (
  id uuid primary key default gen_random_uuid(),
  tahun_pelajaran text not null check (tahun_pelajaran ~ '^\d{4}/\d{4}$'),
  semester text not null check (semester in ('ganjil', 'genap')),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tahun_pelajaran, semester)
);

-- Hanya satu context yang boleh aktif (Bagian 77 — single source of truth).
create unique index if not exists academic_context_single_active_idx
  on academic_context (is_active)
  where is_active;

-- =========================================================
-- 8.1 / 78 — SCHOOL PROFILE (Admin Profile)
-- Singleton — hanya satu baris. Tahun Pelajaran & Semester di sini adalah
-- DEFAULT context, BUKAN active context (Bagian 78: keduanya terpisah).
-- =========================================================
create table if not exists school_profile (
  id uuid primary key default gen_random_uuid(),
  nama text not null check (char_length(trim(nama)) >= 3),
  jabatan text not null check (char_length(trim(jabatan)) >= 2),
  nama_sekolah text not null check (char_length(trim(nama_sekolah)) >= 3),
  tahun_pelajaran_default text not null check (tahun_pelajaran_default ~ '^\d{4}/\d{4}$'),
  semester_default text not null check (semester_default in ('ganjil', 'genap')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tegakkan singleton: unique index di atas ekspresi konstan → maksimal 1 baris.
create unique index if not exists school_profile_singleton_idx
  on school_profile ((true));

-- =========================================================
-- Trigger updated_at otomatis (fungsi set_updated_at() dari 0001_core_data.sql)
-- =========================================================
create trigger trg_academic_context_updated_at before update on academic_context
  for each row execute function set_updated_at();
create trigger trg_school_profile_updated_at before update on school_profile
  for each row execute function set_updated_at();

-- =========================================================
-- Row Level Security — WAJIB aktif (Bagian 40). Kebijakan masih permisif
-- (authenticated = boleh semua) sebagai starting point Fase Foundation.
-- =========================================================
alter table academic_context enable row level security;
alter table school_profile enable row level security;

create policy "authenticated_read_academic_context" on academic_context for select to authenticated using (true);
create policy "authenticated_write_academic_context" on academic_context for all to authenticated using (true) with check (true);

create policy "authenticated_read_school_profile" on school_profile for select to authenticated using (true);
create policy "authenticated_write_school_profile" on school_profile for all to authenticated using (true) with check (true);

-- =========================================================
-- ⚠️ SEMENTARA, HAPUS SETELAH LOGIN DIBANGUN ⚠️
-- Sama seperti 0001_core_data.sql — request browser masih pakai role "anon"
-- karena step 22 (Authentication) belum dibangun. HAPUS 2 POLICY INI begitu
-- Authentication selesai — jangan sampai terbawa ke production.
-- =========================================================
create policy "TEMP_anon_all_academic_context" on academic_context for all to anon using (true) with check (true);
create policy "TEMP_anon_all_school_profile" on school_profile for all to anon using (true) with check (true);

-- =========================================================
-- PENTING — Data API exposure (kebijakan Supabase berubah 30 Mei 2026):
-- tabel baru TIDAK otomatis ter-expose ke Data API lagi.
-- Setelah run script ini, buka:
--   Supabase Dashboard → Table Editor → (pilih tabel) → API Settings
--   atau Project Settings → Data API → expose schema/table
-- dan aktifkan akses untuk: academic_context, school_profile.
-- =========================================================
