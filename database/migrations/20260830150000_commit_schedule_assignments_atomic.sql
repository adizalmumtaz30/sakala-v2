-- 20260830150000_commit_schedule_assignments_atomic.sql
--
-- SAKALA MASTER RULE (Transaction Safety / Bagian 21.3 & 68):
-- commitAssignments() sebelumnya menulis lewat BEBERAPA panggilan Supabase
-- terpisah dari application layer (create version -> supersede versi lama ->
-- update status tiap assignment satu-satu -> insert audit tiap assignment).
-- Tiap panggilan itu adalah transaksi Postgres sendiri-sendiri -- kalau salah
-- satu gagal di tengah (mis. assignment ke-5 dari 10), versi baru sudah
-- terlanjur dibuat dan sebagian assignment sudah ter-commit: state parsial.
--
-- Fungsi ini menyatukan seluruh fase TULIS commit (bukan fase validasi --
-- validasi conflict tetap di application layer/TS, karena butuh reuse logic
-- validateAssignmentCandidate yang sudah ada) ke dalam SATU transaksi
-- Postgres. Kalau ada langkah yang gagal, seluruh fungsi rollback otomatis --
-- tidak ada lagi versi baru "menggantung" tanpa assignment yang benar-benar
-- ter-commit.
--
-- Audit log tetap best-effort (tidak boleh menggagalkan commit utama, sesuai
-- prinsip yang sudah ada di lib/data-access/auditLog.repository.ts) --
-- dibungkus blok EXCEPTION terpisah supaya kegagalan insert audit tidak
-- me-rollback commit assignment yang sudah valid.

create or replace function public.commit_schedule_assignments(
  p_academic_context_id uuid,
  p_assignment_ids uuid[],
  p_label text,
  p_change_summary text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_previous_active_id uuid;
  v_new_version_id uuid;
  v_assignment_id uuid;
  v_actor_id uuid;
begin
  if p_assignment_ids is null or array_length(p_assignment_ids, 1) is null then
    raise exception 'assignmentIds kosong';
  end if;

  select id into v_previous_active_id
  from schedule_version
  where academic_context_id = p_academic_context_id
    and status = 'active'
  order by created_at desc
  limit 1;

  insert into schedule_version (academic_context_id, label, created_by, source, status, change_summary)
  values (p_academic_context_id, p_label, null, 'manual', 'active', p_change_summary)
  returning id into v_new_version_id;

  if v_previous_active_id is not null and v_previous_active_id <> v_new_version_id then
    update schedule_version set status = 'superseded' where id = v_previous_active_id;
  end if;

  update schedule_assignment
  set status = 'committed', version_id = v_new_version_id, updated_at = now()
  where id = any(p_assignment_ids);

  begin
    v_actor_id := auth.uid();
  exception when others then
    v_actor_id := null;
  end;

  foreach v_assignment_id in array p_assignment_ids
  loop
    begin
      insert into audit_log (
        academic_context_id, actor_id, actor_email, action,
        entity_type, entity_id, entity_label, source, reason
      )
      values (
        p_academic_context_id, v_actor_id, null, 'commit',
        'schedule_assignment', v_assignment_id, p_label, 'manual', p_change_summary
      );
    exception when others then
      raise warning 'audit_log insert gagal untuk assignment %: %', v_assignment_id, sqlerrm;
    end;
  end loop;

  return v_new_version_id;
end;
$$;

comment on function public.commit_schedule_assignments is
  'Menulis seluruh fase commit jadwal (versi baru + supersede versi lama + status assignment + audit) dalam satu transaksi atomic. Validasi conflict tetap dilakukan di application layer sebelum memanggil fungsi ini.';
