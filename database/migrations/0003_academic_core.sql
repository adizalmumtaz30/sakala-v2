-- SAKALA V2 — Akademik Core Schema (Bagian 19 / 83)
-- Jalankan lewat Supabase SQL Editor, atau `supabase db push` kalau pakai CLI.
-- Prasyarat: 0002_academic_context.sql sudah dijalankan (academic_context, set_updated_at()).
--
-- CATATAN PEMULIHAN: file ini seharusnya sudah ada sejak Phase 04, tapi hilang
-- dari ZIP yang diserahkan sebelumnya (lib/domain, lib/application, dan
-- lib/data-access untuk Periode Akademik & Jam Pelajaran sudah ada, tapi
-- migration SQL-nya tidak ikut ter-generate). File ini dibuat ulang di Phase 05
-- persis mengikuti bentuk kolom yang sudah dipakai oleh repository yang ada
-- (lib/data-access/periodeAkademik.repository.ts, lib/data-access/jamPelajaran.repository.ts)
-- supaya tidak ada mismatch. JALANKAN INI SEBELUM 0004_schedule_model.sql.

-- =========================================================
-- 19 / 83 — PERIODE AKADEMIK
-- Rentang tanggal di dalam SATU Academic Context (mis. "Periode 1", "UTS").
-- =========================================================
create table if not exists periode_akademik (
  id uuid primary key default gen_random_uuid(),
  academic_context_id uuid not null references academic_context(id) on delete cascade,
  nama text not null check (char_length(trim(nama)) >= 2),
  tanggal_mulai date not null,
  tanggal_selesai date not null check (tanggal_selesai >= tanggal_mulai),
  urutan integer not null default 0,
  status text not null default 'aktif' check (status in ('aktif', 'nonaktif')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists periode_akademik_context_idx on periode_akademik (academic_context_id);

-- =========================================================
-- 19.1 / 83 — JAM PELAJARAN
-- Satu baris = satu slot pada satu hari tertentu (bukan template global),
-- supaya durasi/jumlah jam boleh berbeda per hari (mis. Jumat lebih pendek).
-- =========================================================
create table if not exists jam_pelajaran (
  id uuid primary key default gen_random_uuid(),
  academic_context_id uuid not null references academic_context(id) on delete cascade,
  hari text not null check (hari in ('senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu')),
  nomor_urut integer not null check (nomor_urut >= 1),
  nama text not null check (char_length(trim(nama)) >= 2),
  jenis text not null check (jenis in ('pembelajaran', 'istirahat')),
  waktu_mulai time not null,
  waktu_selesai time not null check (waktu_selesai > waktu_mulai),
  status text not null default 'aktif' check (status in ('aktif', 'nonaktif')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_context_id, hari, nomor_urut)
);

create index if not exists jam_pelajaran_context_idx on jam_pelajaran (academic_context_id);

-- =========================================================
-- Trigger updated_at otomatis
-- =========================================================
create trigger trg_periode_akademik_updated_at before update on periode_akademik
  for each row execute function set_updated_at();
create trigger trg_jam_pelajaran_updated_at before update on jam_pelajaran
  for each row execute function set_updated_at();

-- =========================================================
-- Row Level Security — WAJIB aktif (Bagian 40).
-- =========================================================
alter table periode_akademik enable row level security;
alter table jam_pelajaran enable row level security;

create policy "authenticated_read_periode_akademik" on periode_akademik for select to authenticated using (true);
create policy "authenticated_write_periode_akademik" on periode_akademik for all to authenticated using (true) with check (true);

create policy "authenticated_read_jam_pelajaran" on jam_pelajaran for select to authenticated using (true);
create policy "authenticated_write_jam_pelajaran" on jam_pelajaran for all to authenticated using (true) with check (true);

-- =========================================================
-- ⚠️ SEMENTARA, HAPUS SETELAH LOGIN DIBANGUN ⚠️
-- Sama seperti migration sebelumnya — HAPUS 2 POLICY INI begitu
-- Authentication (step 22) selesai — jangan sampai terbawa ke production.
-- =========================================================
create policy "TEMP_anon_all_periode_akademik" on periode_akademik for all to anon using (true) with check (true);
create policy "TEMP_anon_all_jam_pelajaran" on jam_pelajaran for all to anon using (true) with check (true);

-- =========================================================
-- PENTING — Data API exposure (kebijakan Supabase berubah 30 Mei 2026):
-- tabel baru TIDAK otomatis ter-expose ke Data API lagi.
-- Setelah run script ini, buka:
--   Supabase Dashboard → Table Editor → (pilih tabel) → API Settings
-- dan aktifkan akses untuk: periode_akademik, jam_pelajaran.
-- =========================================================
