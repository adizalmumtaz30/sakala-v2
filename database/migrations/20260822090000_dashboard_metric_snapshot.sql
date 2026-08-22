-- KPI Card sparkline + trend (permintaan user: "fokus sparkline+trend di KPI card").
-- Prinsip project (Bagian 70, "jangan fabrikasi data"): TIDAK ada histori bawaan —
-- tabel ini mulai kosong dan terisi organik satu baris per hari kalender per konteks
-- akademik, di-upsert setiap kali dashboard diakses (nilai hari ini selalu paling baru).
-- Sparkline & trend di UI HANYA menampilkan apa yang benar-benar terekam di sini —
-- kalau baru 1 hari terekam, trend ditampilkan "—" (belum ada pembanding), bukan angka
-- karangan.
create table if not exists dashboard_metric_snapshot (
  id uuid primary key default gen_random_uuid(),
  academic_context_id uuid not null references academic_context(id) on delete cascade,
  snapshot_date date not null,
  guru_aktif int not null default 0,
  kelas int not null default 0,
  mapel_aktif int not null default 0,
  ruangan int not null default 0,
  total_jtm int not null default 0,
  jadwal_committed int not null default 0,
  updated_at timestamptz not null default now(),
  unique (academic_context_id, snapshot_date)
);

create index if not exists idx_dashboard_metric_snapshot_context_date
  on dashboard_metric_snapshot (academic_context_id, snapshot_date desc);

alter table dashboard_metric_snapshot enable row level security;

-- Konsisten dengan pola RLS tabel lain di project ini (lihat migration 0010).
create policy "authenticated_read_dashboard_metric_snapshot" on dashboard_metric_snapshot
  for select to authenticated using (true);

create policy "authenticated_write_dashboard_metric_snapshot" on dashboard_metric_snapshot
  for insert to authenticated with check (true);

create policy "authenticated_update_dashboard_metric_snapshot" on dashboard_metric_snapshot
  for update to authenticated using (true) with check (true);

create policy "TEMP_anon_read_dashboard_metric_snapshot" on dashboard_metric_snapshot
  for select to anon using (true);

create policy "TEMP_anon_write_dashboard_metric_snapshot" on dashboard_metric_snapshot
  for insert to anon with check (true);

create policy "TEMP_anon_update_dashboard_metric_snapshot" on dashboard_metric_snapshot
  for update to anon using (true) with check (true);

comment on table dashboard_metric_snapshot is 'Snapshot harian KPI dashboard per konteks akademik — sumber sparkline+trend KPI card, terisi organik (bukan histori fabrikasi).';
