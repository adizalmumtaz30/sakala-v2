-- SAKALA V2 — Schedule Model + Slot Template Schema (Bagian 20 / 84)
-- Jalankan lewat Supabase SQL Editor, atau `supabase db push` kalau pakai CLI.
-- Prasyarat: 0003_academic_core.sql sudah dijalankan (jam_pelajaran dipakai
-- sebagai referensi grid hari+nomor_urut yang valid, dicek di Application layer).

-- =========================================================
-- 20 / 84 — SCHEDULE MODEL
-- Konfigurasi, BUKAN timetable itu sendiri. Satu Academic Context boleh
-- punya lebih dari satu model (mis. "Model Reguler", "Model Ramadhan") —
-- status aktif/nonaktif di sini murni flag per baris (pola sama seperti
-- Periode Akademik & Jam Pelajaran), bukan singleton seperti Academic
-- Context. Claude addition: dibiarkan tidak eksklusif karena spesifikasi
-- tidak menyebutkan "hanya satu model aktif" secara eksplisit — flag untuk
-- direview kalau ternyata harus singleton begitu Jadwal Cerdas (step 14)
-- butuh menentukan model mana yang dipakai generate.
-- =========================================================
create table if not exists schedule_model (
  id uuid primary key default gen_random_uuid(),
  academic_context_id uuid not null references academic_context(id) on delete cascade,
  nama_model text not null check (char_length(trim(nama_model)) >= 2),
  waktu_mulai time not null,
  durasi_standar_menit integer not null check (durasi_standar_menit > 0 and durasi_standar_menit <= 300),
  maks_jam_per_hari integer not null check (maks_jam_per_hari >= 1 and maks_jam_per_hari <= 20),
  -- Bagian 20 — "active days": hari sekolah yang dipakai model ini.
  hari_aktif text[] not null check (
    hari_aktif <@ array['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']
    and cardinality(hari_aktif) >= 1
  ),
  -- Bagian 20 — "holidays": tanggal libur eksplisit untuk model ini.
  hari_libur date[] not null default '{}',
  -- Bagian 20.1 — Room mode, tidak boleh diinfer otomatis.
  mode_ruangan text not null check (mode_ruangan in ('wajib', 'opsional', 'tidak_dipakai')),
  -- Bagian 20 — "rombel usage". Claude addition: dimodelkan sebagai dua mode
  -- eksplisit (seragam untuk semua rombel vs per-rombel) karena spesifikasi
  -- menyebut field ini tanpa merinci nilai yang mungkin — flag untuk direview.
  penggunaan_rombel text not null default 'seragam' check (penggunaan_rombel in ('seragam', 'per_rombel')),
  status text not null default 'aktif' check (status in ('aktif', 'nonaktif')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_context_id, nama_model)
);

create index if not exists schedule_model_context_idx on schedule_model (academic_context_id);

-- =========================================================
-- 20.2 — SLOT TEMPLATE
-- Fixed slots block ordinary teaching assignments. Hanya menyimpan slot yang
-- BUKAN pengajaran biasa (Upacara/Religi/Istirahat/Libur/Custom) ATAU yang
-- eksplisit ditandai "Belajar Mengajar" — satu baris per (model, hari,
-- nomor_urut). Application layer memvalidasi bahwa hari+nomor_urut yang
-- dirujuk memang terdaftar di jam_pelajaran konteks akademik model ini,
-- supaya slot template tidak pernah mendefinisikan periode hantu.
-- =========================================================
create table if not exists slot_template (
  id uuid primary key default gen_random_uuid(),
  schedule_model_id uuid not null references schedule_model(id) on delete cascade,
  hari text not null check (hari in ('senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu')),
  nomor_urut integer not null check (nomor_urut >= 1),
  jenis_slot text not null check (
    jenis_slot in ('belajar_mengajar', 'upacara', 'religi', 'istirahat', 'libur', 'custom')
  ),
  nama_custom text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_model_id, hari, nomor_urut),
  constraint slot_template_custom_nama_check check (
    jenis_slot <> 'custom' or (nama_custom is not null and char_length(trim(nama_custom)) >= 2)
  )
);

create index if not exists slot_template_model_idx on slot_template (schedule_model_id);

-- =========================================================
-- Trigger updated_at otomatis
-- =========================================================
create trigger trg_schedule_model_updated_at before update on schedule_model
  for each row execute function set_updated_at();
create trigger trg_slot_template_updated_at before update on slot_template
  for each row execute function set_updated_at();

-- =========================================================
-- Row Level Security — WAJIB aktif (Bagian 40).
-- =========================================================
alter table schedule_model enable row level security;
alter table slot_template enable row level security;

create policy "authenticated_read_schedule_model" on schedule_model for select to authenticated using (true);
create policy "authenticated_write_schedule_model" on schedule_model for all to authenticated using (true) with check (true);

create policy "authenticated_read_slot_template" on slot_template for select to authenticated using (true);
create policy "authenticated_write_slot_template" on slot_template for all to authenticated using (true) with check (true);

-- =========================================================
-- ⚠️ SEMENTARA, HAPUS SETELAH LOGIN DIBANGUN ⚠️
-- HAPUS 2 POLICY INI begitu Authentication (step 22) selesai.
-- =========================================================
create policy "TEMP_anon_all_schedule_model" on schedule_model for all to anon using (true) with check (true);
create policy "TEMP_anon_all_slot_template" on slot_template for all to anon using (true) with check (true);

-- =========================================================
-- PENTING — Data API exposure (kebijakan Supabase berubah 30 Mei 2026):
-- tabel baru TIDAK otomatis ter-expose ke Data API lagi.
-- Setelah run script ini, buka:
--   Supabase Dashboard → Table Editor → (pilih tabel) → API Settings
-- dan aktifkan akses untuk: schedule_model, slot_template.
-- =========================================================
