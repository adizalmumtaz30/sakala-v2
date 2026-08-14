-- SAKALA V2.3 — DATABASE REPAIR / IDEMPOTENT FOUNDATION
-- Purpose:
--   1. repair duplicate trigger failure seen in Supabase SQL Editor
--   2. make RLS policies safe to re-apply
--   3. restore temporary anon access required before Authentication (Step 22)
--   4. restore Data API table privileges
--
-- IMPORTANT:
-- This repair does NOT delete application data.
-- It only replaces triggers/policies and grants privileges.
-- Run once in Supabase SQL Editor.

begin;

-- ------------------------------------------------------------
-- 0. Safety: required trigger function
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 1. Triggers — DROP IF EXISTS, then recreate
-- ------------------------------------------------------------
drop trigger if exists trg_academic_context_updated_at on public.academic_context;
create trigger trg_academic_context_updated_at
before update on public.academic_context
for each row execute function public.set_updated_at();

drop trigger if exists trg_school_profile_updated_at on public.school_profile;
create trigger trg_school_profile_updated_at
before update on public.school_profile
for each row execute function public.set_updated_at();

drop trigger if exists trg_periode_akademik_updated_at on public.periode_akademik;
create trigger trg_periode_akademik_updated_at
before update on public.periode_akademik
for each row execute function public.set_updated_at();

drop trigger if exists trg_jam_pelajaran_updated_at on public.jam_pelajaran;
create trigger trg_jam_pelajaran_updated_at
before update on public.jam_pelajaran
for each row execute function public.set_updated_at();

drop trigger if exists trg_schedule_model_updated_at on public.schedule_model;
create trigger trg_schedule_model_updated_at
before update on public.schedule_model
for each row execute function public.set_updated_at();

drop trigger if exists trg_slot_template_updated_at on public.slot_template;
create trigger trg_slot_template_updated_at
before update on public.slot_template
for each row execute function public.set_updated_at();

drop trigger if exists trg_schedule_assignment_updated_at on public.schedule_assignment;
create trigger trg_schedule_assignment_updated_at
before update on public.schedule_assignment
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. RLS — keep enabled
-- ------------------------------------------------------------
alter table public.guru enable row level security;
alter table public.mata_pelajaran enable row level security;
alter table public.kelas enable row level security;
alter table public.ruangan enable row level security;
alter table public.academic_context enable row level security;
alter table public.school_profile enable row level security;
alter table public.periode_akademik enable row level security;
alter table public.jam_pelajaran enable row level security;
alter table public.schedule_model enable row level security;
alter table public.slot_template enable row level security;
alter table public.schedule_version enable row level security;
alter table public.schedule_assignment enable row level security;

-- ------------------------------------------------------------
-- 3. Rebuild policies idempotently
--    authenticated = normal future auth path
--    anon = TEMPORARY because Step 22 Authentication is not built yet
-- ------------------------------------------------------------

-- guru
drop policy if exists authenticated_read_guru on public.guru;
create policy authenticated_read_guru on public.guru
for select to authenticated using (true);

drop policy if exists authenticated_write_guru on public.guru;
create policy authenticated_write_guru on public.guru
for all to authenticated using (true) with check (true);

drop policy if exists TEMP_anon_all_guru on public.guru;
create policy TEMP_anon_all_guru on public.guru
for all to anon using (true) with check (true);

-- mata_pelajaran
drop policy if exists authenticated_read_mapel on public.mata_pelajaran;
create policy authenticated_read_mapel on public.mata_pelajaran
for select to authenticated using (true);

drop policy if exists authenticated_write_mapel on public.mata_pelajaran;
create policy authenticated_write_mapel on public.mata_pelajaran
for all to authenticated using (true) with check (true);

drop policy if exists TEMP_anon_all_mapel on public.mata_pelajaran;
create policy TEMP_anon_all_mapel on public.mata_pelajaran
for all to anon using (true) with check (true);

-- kelas
drop policy if exists authenticated_read_kelas on public.kelas;
create policy authenticated_read_kelas on public.kelas
for select to authenticated using (true);

drop policy if exists authenticated_write_kelas on public.kelas;
create policy authenticated_write_kelas on public.kelas
for all to authenticated using (true) with check (true);

drop policy if exists TEMP_anon_all_kelas on public.kelas;
create policy TEMP_anon_all_kelas on public.kelas
for all to anon using (true) with check (true);

-- ruangan
drop policy if exists authenticated_read_ruangan on public.ruangan;
create policy authenticated_read_ruangan on public.ruangan
for select to authenticated using (true);

drop policy if exists authenticated_write_ruangan on public.ruangan;
create policy authenticated_write_ruangan on public.ruangan
for all to authenticated using (true) with check (true);

drop policy if exists TEMP_anon_all_ruangan on public.ruangan;
create policy TEMP_anon_all_ruangan on public.ruangan
for all to anon using (true) with check (true);

-- academic_context
drop policy if exists authenticated_read_academic_context on public.academic_context;
create policy authenticated_read_academic_context on public.academic_context
for select to authenticated using (true);

drop policy if exists authenticated_write_academic_context on public.academic_context;
create policy authenticated_write_academic_context on public.academic_context
for all to authenticated using (true) with check (true);

drop policy if exists TEMP_anon_all_academic_context on public.academic_context;
create policy TEMP_anon_all_academic_context on public.academic_context
for all to anon using (true) with check (true);

-- school_profile
drop policy if exists authenticated_read_school_profile on public.school_profile;
create policy authenticated_read_school_profile on public.school_profile
for select to authenticated using (true);

drop policy if exists authenticated_write_school_profile on public.school_profile;
create policy authenticated_write_school_profile on public.school_profile
for all to authenticated using (true) with check (true);

drop policy if exists TEMP_anon_all_school_profile on public.school_profile;
create policy TEMP_anon_all_school_profile on public.school_profile
for all to anon using (true) with check (true);

-- periode_akademik
drop policy if exists authenticated_read_periode_akademik on public.periode_akademik;
create policy authenticated_read_periode_akademik on public.periode_akademik
for select to authenticated using (true);

drop policy if exists authenticated_write_periode_akademik on public.periode_akademik;
create policy authenticated_write_periode_akademik on public.periode_akademik
for all to authenticated using (true) with check (true);

drop policy if exists TEMP_anon_all_periode_akademik on public.periode_akademik;
create policy TEMP_anon_all_periode_akademik on public.periode_akademik
for all to anon using (true) with check (true);

-- jam_pelajaran
drop policy if exists authenticated_read_jam_pelajaran on public.jam_pelajaran;
create policy authenticated_read_jam_pelajaran on public.jam_pelajaran
for select to authenticated using (true);

drop policy if exists authenticated_write_jam_pelajaran on public.jam_pelajaran;
create policy authenticated_write_jam_pelajaran on public.jam_pelajaran
for all to authenticated using (true) with check (true);

drop policy if exists TEMP_anon_all_jam_pelajaran on public.jam_pelajaran;
create policy TEMP_anon_all_jam_pelajaran on public.jam_pelajaran
for all to anon using (true) with check (true);

-- schedule_model
drop policy if exists authenticated_read_schedule_model on public.schedule_model;
create policy authenticated_read_schedule_model on public.schedule_model
for select to authenticated using (true);

drop policy if exists authenticated_write_schedule_model on public.schedule_model;
create policy authenticated_write_schedule_model on public.schedule_model
for all to authenticated using (true) with check (true);

drop policy if exists TEMP_anon_all_schedule_model on public.schedule_model;
create policy TEMP_anon_all_schedule_model on public.schedule_model
for all to anon using (true) with check (true);

-- slot_template
drop policy if exists authenticated_read_slot_template on public.slot_template;
create policy authenticated_read_slot_template on public.slot_template
for select to authenticated using (true);

drop policy if exists authenticated_write_slot_template on public.slot_template;
create policy authenticated_write_slot_template on public.slot_template
for all to authenticated using (true) with check (true);

drop policy if exists TEMP_anon_all_slot_template on public.slot_template;
create policy TEMP_anon_all_slot_template on public.slot_template
for all to anon using (true) with check (true);

-- schedule_version
drop policy if exists authenticated_read_schedule_version on public.schedule_version;
create policy authenticated_read_schedule_version on public.schedule_version
for select to authenticated using (true);

drop policy if exists authenticated_write_schedule_version on public.schedule_version;
create policy authenticated_write_schedule_version on public.schedule_version
for all to authenticated using (true) with check (true);

drop policy if exists TEMP_anon_all_schedule_version on public.schedule_version;
create policy TEMP_anon_all_schedule_version on public.schedule_version
for all to anon using (true) with check (true);

-- schedule_assignment
drop policy if exists authenticated_read_schedule_assignment on public.schedule_assignment;
create policy authenticated_read_schedule_assignment on public.schedule_assignment
for select to authenticated using (true);

drop policy if exists authenticated_write_schedule_assignment on public.schedule_assignment;
create policy authenticated_write_schedule_assignment on public.schedule_assignment
for all to authenticated using (true) with check (true);

drop policy if exists TEMP_anon_all_schedule_assignment on public.schedule_assignment;
create policy TEMP_anon_all_schedule_assignment on public.schedule_assignment
for all to anon using (true) with check (true);

-- ------------------------------------------------------------
-- 4. Data API / PostgREST privileges
--    RLS remains the row-level security boundary.
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.guru,
  public.mata_pelajaran,
  public.kelas,
  public.ruangan,
  public.academic_context,
  public.school_profile,
  public.periode_akademik,
  public.jam_pelajaran,
  public.schedule_model,
  public.slot_template,
  public.schedule_version,
  public.schedule_assignment
to anon, authenticated;

commit;

-- ------------------------------------------------------------
-- 5. Verification
-- ------------------------------------------------------------
select
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'guru','mata_pelajaran','kelas','ruangan',
    'academic_context','school_profile',
    'periode_akademik','jam_pelajaran',
    'schedule_model','slot_template',
    'schedule_version','schedule_assignment'
  )
order by tablename;

select
  c.relname as table_name,
  t.tgname as trigger_name
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and t.tgname like 'trg_%_updated_at'
order by c.relname, t.tgname;
