-- SAKALA V2 — Curriculum Intelligence Layer
-- Authority: official regulation only. AI/interpreter data must remain traceable.

create table if not exists public.curriculum_source (
  id uuid primary key default gen_random_uuid(),
  institution text not null check (institution in ('kementerian_agama','kemendikdasmen')),
  source_tier integer not null check (source_tier between 1 and 3),
  source_type text not null,
  name text not null,
  official_url text not null,
  status text not null default 'unverified' check (status in ('official','unverified','stale','blocked')),
  last_checked_at timestamptz,
  last_verified_at timestamptz,
  document_hash text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution, official_url)
);

create table if not exists public.curriculum_version (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.curriculum_source(id) on delete restrict,
  curriculum_name text not null,
  regulation_number text,
  regulation_year integer,
  regulation_title text,
  issuing_institution text not null,
  effective_status text not null default 'unknown' check (effective_status in ('berlaku','dicabut','diubah','unknown')),
  effective_date date,
  retrieved_at timestamptz not null default now(),
  verified_at timestamptz,
  version_key text not null unique,
  document_url text,
  document_hash text,
  verification_status text not null default 'unverified' check (verification_status in ('verified','unverified','blocked','stale')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.curriculum_item (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid not null references public.curriculum_version(id) on delete cascade,
  subject_name text not null,
  subject_code text,
  class_level text not null,
  allocation_type text not null check (allocation_type in ('weekly','annual','semester','other')),
  official_allocation numeric,
  allocation_unit text,
  effective_weeks numeric,
  weekly_target numeric,
  derivation_status text not null default 'not_derived' check (derivation_status in ('official','derived','not_derived','blocked')),
  derivation_method text,
  category text not null default 'other' check (category in ('wajib','pilihan','muatan_lokal','kokurikuler','lainnya')),
  extraction_status text not null default 'unverified' check (extraction_status in ('verified','unverified','blocked')),
  source_locator text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_version_id, subject_name, class_level)
);

create table if not exists public.curriculum_adoption (
  id uuid primary key default gen_random_uuid(),
  academic_context_id uuid not null references public.academic_context(id) on delete cascade,
  kelas_id uuid not null references public.kelas(id) on delete cascade,
  mata_pelajaran_id uuid not null references public.mata_pelajaran(id) on delete cascade,
  curriculum_item_id uuid not null references public.curriculum_item(id) on delete restrict,
  status text not null default 'selected' check (status in ('selected','active','overridden')),
  official_target_jp numeric,
  school_target_jp numeric,
  override_reason text,
  selected_at timestamptz not null default now(),
  activated_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (academic_context_id, kelas_id, mata_pelajaran_id, curriculum_item_id)
);

create index if not exists idx_curriculum_version_source on public.curriculum_version(source_id);
create index if not exists idx_curriculum_item_version on public.curriculum_item(curriculum_version_id);
create index if not exists idx_curriculum_adoption_context on public.curriculum_adoption(academic_context_id);
create index if not exists idx_curriculum_adoption_mapel on public.curriculum_adoption(mata_pelajaran_id);

create or replace function public.set_curriculum_intelligence_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_curriculum_source_updated_at on public.curriculum_source;
create trigger trg_curriculum_source_updated_at before update on public.curriculum_source for each row execute function public.set_curriculum_intelligence_updated_at();
drop trigger if exists trg_curriculum_version_updated_at on public.curriculum_version;
create trigger trg_curriculum_version_updated_at before update on public.curriculum_version for each row execute function public.set_curriculum_intelligence_updated_at();
drop trigger if exists trg_curriculum_item_updated_at on public.curriculum_item;
create trigger trg_curriculum_item_updated_at before update on public.curriculum_item for each row execute function public.set_curriculum_intelligence_updated_at();
drop trigger if exists trg_curriculum_adoption_updated_at on public.curriculum_adoption;
create trigger trg_curriculum_adoption_updated_at before update on public.curriculum_adoption for each row execute function public.set_curriculum_intelligence_updated_at();

alter table public.curriculum_source enable row level security;
alter table public.curriculum_version enable row level security;
alter table public.curriculum_item enable row level security;
alter table public.curriculum_adoption enable row level security;

drop policy if exists curriculum_source_anon_all on public.curriculum_source;
drop policy if exists curriculum_version_anon_all on public.curriculum_version;
drop policy if exists curriculum_item_anon_all on public.curriculum_item;
drop policy if exists curriculum_adoption_anon_all on public.curriculum_adoption;
create policy curriculum_source_anon_all on public.curriculum_source for all to anon using (true) with check (true);
create policy curriculum_version_anon_all on public.curriculum_version for all to anon using (true) with check (true);
create policy curriculum_item_anon_all on public.curriculum_item for all to anon using (true) with check (true);
create policy curriculum_adoption_anon_all on public.curriculum_adoption for all to anon using (true) with check (true);

-- Official-source registry only. No regulation facts are seeded here.
insert into public.curriculum_source (institution, source_tier, source_type, name, official_url, status, notes)
values
('kementerian_agama', 1, 'jdih', 'JDIH Kementerian Agama RI', 'https://jdih.kemenag.go.id/', 'official', 'Authority registry; regulation details must be verified from the actual document.'),
('kementerian_agama', 1, 'ministry', 'Kementerian Agama RI', 'https://kemenag.go.id/', 'official', 'Discovery/cross-check only; regulation authority remains the official document.'),
('kemendikdasmen', 1, 'ministry', 'Kementerian Pendidikan Dasar dan Menengah RI', 'https://www.kemdikdasmen.go.id/', 'official', 'Discovery/cross-check only; regulation authority remains the official document.')
on conflict (institution, official_url) do nothing;
