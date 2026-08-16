-- Bagian 34 (History/Audit) — step 18.
-- Mencatat mutation penting: who, what, when, context, entity, before, after,
-- source, reason. Scope awal: Schedule events (create/move/delete/commit) via
-- lib/application/scheduleAssignment.usecases.ts. Modul lain (Guru, Mapel,
-- Kelas, Ruangan, Pembagian Mengajar, Import) BELUM di-hook ke tabel ini —
-- dicatat eksplisit di UI Riwayat (Bagian 70: tidak boleh diam-diam
-- dihilangkan), lanjutan berikutnya.

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  academic_context_id uuid references academic_context(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null check (
    action in (
      'create', 'edit', 'move', 'delete', 'generate', 'optimize',
      'validate', 'commit', 'import', 'restore'
    )
  ),
  entity_type text not null,
  entity_id uuid,
  entity_label text,
  before jsonb,
  after jsonb,
  source text not null default 'manual' check (source in ('manual', 'import', 'ai', 'system')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_context on audit_log (academic_context_id, created_at desc);
create index if not exists idx_audit_log_entity on audit_log (entity_type, entity_id);
create index if not exists idx_audit_log_created_at on audit_log (created_at desc);

alter table audit_log enable row level security;

-- Konsisten dengan tabel lain: akses penuh untuk authenticated (Bagian 40 /
-- migration 0009 akan mencabut akses anon secara keseluruhan). Audit log
-- sifatnya append-only dari sisi aplikasi (repository tidak expose
-- update/delete), tapi RLS tetap izinkan insert+select untuk authenticated
-- supaya konsisten dengan pola tabel lain di project ini.
create policy "authenticated_read_audit_log" on audit_log
  for select to authenticated using (true);

create policy "authenticated_write_audit_log" on audit_log
  for insert to authenticated with check (true);

create policy "TEMP_anon_read_audit_log" on audit_log
  for select to anon using (true);

create policy "TEMP_anon_write_audit_log" on audit_log
  for insert to anon with check (true);

comment on table audit_log is 'Bagian 34 — History/Audit trail. Append-only dari sisi aplikasi.';
