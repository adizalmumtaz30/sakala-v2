-- 0008_pembagian_mengajar.sql
-- SAKALA V2.3 — Pack 09c: Pembagian Mengajar (Bagian 35-36 / 72-75).
-- Layer penghubung Guru + Mata Pelajaran + Kelas + JP, terikat satu Academic
-- Context (pola sama dengan schedule_model/schedule_assignment — Bagian 8.2/77:
-- identifikasi tahun ajaran/semester SELALU via academic_context_id, bukan teks).

create table if not exists pembagian_mengajar (
  id uuid primary key default gen_random_uuid(),
  academic_context_id uuid not null references academic_context(id) on delete cascade,
  guru_id uuid not null references guru(id) on delete restrict,
  mata_pelajaran_id uuid not null references mata_pelajaran(id) on delete restrict,
  kelas_id uuid not null references kelas(id) on delete restrict,
  jp_per_minggu integer not null check (jp_per_minggu > 0),
  status text not null default 'aktif' check (status in ('aktif', 'nonaktif')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Bagian 74: satu kombinasi Guru+Mapel+Kelas hanya boleh satu Pembagian Mengajar
  -- per Academic Context (mencegah duplikasi saat CRUD manual maupun import).
  unique (academic_context_id, guru_id, mata_pelajaran_id, kelas_id)
);

create index if not exists idx_pembagian_mengajar_context on pembagian_mengajar (academic_context_id);
create index if not exists idx_pembagian_mengajar_guru on pembagian_mengajar (guru_id);

create trigger trg_pembagian_mengajar_updated_at before update on pembagian_mengajar
  for each row execute function set_updated_at();

alter table pembagian_mengajar enable row level security;

create policy "authenticated_read_pembagian_mengajar" on pembagian_mengajar
  for select to authenticated using (true);
create policy "authenticated_write_pembagian_mengajar" on pembagian_mengajar
  for all to authenticated using (true) with check (true);

-- ⚠️ SEMENTARA, HAPUS SETELAH LOGIN DIBANGUN (sama seperti policy TEMP di 0001-0007) ⚠️
create policy "TEMP_anon_all_pembagian_mengajar" on pembagian_mengajar
  for all to anon using (true) with check (true);

-- PENTING — expose tabel ini juga ke Data API (Supabase Dashboard → Table Editor
-- → pembagian_mengajar → API Settings), sama seperti tabel-tabel migration sebelumnya.
