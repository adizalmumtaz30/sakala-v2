-- SAKALA V2 — Core Data Schema (Bagian 17)
-- Jalankan lewat Supabase SQL Editor, atau `supabase db push` kalau pakai CLI.
-- Urutan build: Guru → Mata Pelajaran → Kelas → Ruangan (Bagian 17)

create extension if not exists "pgcrypto";

-- =========================================================
-- 17.1 GURU
-- =========================================================
create table if not exists guru (
  id uuid primary key default gen_random_uuid(),
  nama_guru text not null check (char_length(trim(nama_guru)) >= 3),
  status text not null default 'aktif' check (status in ('aktif', 'nonaktif')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 17.2 MATA PELAJARAN
-- =========================================================
create table if not exists mata_pelajaran (
  id uuid primary key default gen_random_uuid(),
  nama text not null check (char_length(trim(nama)) >= 2),
  kode text unique,
  status text not null default 'aktif' check (status in ('aktif', 'nonaktif')),
  target_jp_per_rombel integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 17.3 KELAS
-- =========================================================
create table if not exists kelas (
  id uuid primary key default gen_random_uuid(),
  tingkat text not null,
  nama_rombel text not null,
  status text not null default 'aktif' check (status in ('aktif', 'nonaktif')),
  tahun_ajaran text not null,
  semester text not null check (semester in ('ganjil', 'genap')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 17.4 RUANGAN
-- =========================================================
create table if not exists ruangan (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  kapasitas integer,
  tipe_ruangan text,
  status text not null default 'aktif' check (status in ('aktif', 'nonaktif')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Trigger updated_at otomatis (dipakai semua tabel Core Data)
-- =========================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_guru_updated_at before update on guru
  for each row execute function set_updated_at();
create trigger trg_mata_pelajaran_updated_at before update on mata_pelajaran
  for each row execute function set_updated_at();
create trigger trg_kelas_updated_at before update on kelas
  for each row execute function set_updated_at();
create trigger trg_ruangan_updated_at before update on ruangan
  for each row execute function set_updated_at();

-- =========================================================
-- Row Level Security — WAJIB aktif karena app pakai publishable key
-- di browser (Bagian 40 Authentication/Authorization).
-- Kebijakan di bawah masih permisif (authenticated = boleh semua)
-- sebagai starting point Fase Foundation — perketat begitu role/permission
-- model (Bagian 40.1) dibangun.
-- =========================================================
alter table guru enable row level security;
alter table mata_pelajaran enable row level security;
alter table kelas enable row level security;
alter table ruangan enable row level security;

create policy "authenticated_read_guru" on guru for select to authenticated using (true);
create policy "authenticated_write_guru" on guru for all to authenticated using (true) with check (true);

create policy "authenticated_read_mapel" on mata_pelajaran for select to authenticated using (true);
create policy "authenticated_write_mapel" on mata_pelajaran for all to authenticated using (true) with check (true);

create policy "authenticated_read_kelas" on kelas for select to authenticated using (true);
create policy "authenticated_write_kelas" on kelas for all to authenticated using (true) with check (true);

create policy "authenticated_read_ruangan" on ruangan for select to authenticated using (true);
create policy "authenticated_write_ruangan" on ruangan for all to authenticated using (true) with check (true);

-- =========================================================
-- ⚠️ SEMENTARA, HAPUS SETELAH LOGIN DIBANGUN ⚠️
-- Bagian 40 (Authentication/Authorization) belum dibangun di fase ini,
-- jadi request dari browser masih memakai role "anon", bukan "authenticated".
-- 4 policy di bawah membuka akses publik penuh supaya CRUD Guru bisa
-- langsung dites tanpa login. HAPUS 4 POLICY INI begitu step 22
-- (Authentication) selesai dibangun — jangan sampai terbawa ke production.
-- =========================================================
create policy "TEMP_anon_all_guru" on guru for all to anon using (true) with check (true);
create policy "TEMP_anon_all_mapel" on mata_pelajaran for all to anon using (true) with check (true);
create policy "TEMP_anon_all_kelas" on kelas for all to anon using (true) with check (true);
create policy "TEMP_anon_all_ruangan" on ruangan for all to anon using (true) with check (true);

-- =========================================================
-- PENTING — Data API exposure (kebijakan Supabase berubah 30 Mei 2026):
-- tabel baru TIDAK otomatis ter-expose ke Data API lagi.
-- Setelah run script ini, buka:
--   Supabase Dashboard → Table Editor → (pilih tabel) → API Settings
--   atau Project Settings → Data API → expose schema/table
-- dan aktifkan akses untuk: guru, mata_pelajaran, kelas, ruangan.
-- =========================================================
