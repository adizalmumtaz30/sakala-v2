-- SAKALA V2.3 — Official Target JP domain
create table if not exists public.target_jp (
  id uuid primary key default gen_random_uuid(),
  academic_context_id uuid not null references public.academic_context(id) on delete cascade,
  kelas_id uuid not null references public.kelas(id) on delete cascade,
  mata_pelajaran_id uuid not null references public.mata_pelajaran(id) on delete cascade,
  target_jp integer not null check (target_jp >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint target_jp_context_kelas_mapel_unique unique (academic_context_id, kelas_id, mata_pelajaran_id)
);

create index if not exists idx_target_jp_context on public.target_jp(academic_context_id);
create index if not exists idx_target_jp_kelas on public.target_jp(kelas_id);
create index if not exists idx_target_jp_mapel on public.target_jp(mata_pelajaran_id);

alter table public.target_jp enable row level security;

-- Application has no authentication gate; retain public CRUD for the current architecture.
drop policy if exists target_jp_select_public on public.target_jp;
drop policy if exists target_jp_insert_public on public.target_jp;
drop policy if exists target_jp_update_public on public.target_jp;
drop policy if exists target_jp_delete_public on public.target_jp;
create policy target_jp_select_public on public.target_jp for select to anon, authenticated using (true);
create policy target_jp_insert_public on public.target_jp for insert to anon, authenticated with check (true);
create policy target_jp_update_public on public.target_jp for update to anon, authenticated using (true) with check (true);
create policy target_jp_delete_public on public.target_jp for delete to anon, authenticated using (true);

create or replace function public.set_target_jp_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_target_jp_updated_at on public.target_jp;
create trigger trg_target_jp_updated_at before update on public.target_jp for each row execute function public.set_target_jp_updated_at();
