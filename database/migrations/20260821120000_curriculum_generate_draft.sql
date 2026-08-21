-- GENERATE-KURIKULUM-MASTER-UX-FLOW poin 11 (Persistence).
-- Workspace Generate Kurikulum (sumber terpilih, parameter, candidate +
-- manual edit) harus tetap ada kalau operator pindah halaman lalu balik
-- lagi. Satu draft per Active Academic Context — last-write-wins, cukup
-- untuk skala penggunaan single-admin-per-sekolah seperti modul lain.

create table if not exists public.curriculum_generate_draft (
  id uuid primary key default gen_random_uuid(),
  academic_context_id uuid not null references public.academic_context(id) on delete cascade,
  curriculum_version_id uuid references public.curriculum_version(id) on delete set null,
  level text,
  class_ids uuid[] not null default '{}',
  -- candidate: [{ "itemId": uuid, "manualTarget": number|null }]
  candidate jsonb not null default '[]',
  -- baseline: { "<itemId>": number|null } — dipakai untuk hitung "berubah"
  baseline jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (academic_context_id)
);

create index if not exists idx_curriculum_generate_draft_context on public.curriculum_generate_draft (academic_context_id);

alter table public.curriculum_generate_draft enable row level security;

create policy "authenticated_all_curriculum_generate_draft" on public.curriculum_generate_draft
  for all to authenticated using (true) with check (true);

create policy "TEMP_anon_all_curriculum_generate_draft" on public.curriculum_generate_draft
  for all to anon using (true) with check (true);

comment on table public.curriculum_generate_draft is 'Draft workspace Generate Kurikulum per Active Academic Context — persistence lintas halaman (poin 11 master UX flow).';
