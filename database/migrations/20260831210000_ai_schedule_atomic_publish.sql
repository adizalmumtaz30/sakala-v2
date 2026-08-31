-- AI one-click schedule publication.
-- Candidate/Commit remains available for explicit/manual workflows, but AI does
-- not expose either state to the operator. AI publishes a complete active
-- version in one transaction.
--
-- fill   = copy the current active committed schedule into the new version,
--          then add AI-generated placements.
-- replace = publish the generated full-week schedule as the new version.
--
-- In both modes, failure rolls back the entire transaction. The previous
-- active version is never superseded until the new version is complete.

create or replace function public.publish_ai_schedule_atomic(
  p_academic_context_id uuid,
  p_schedule_model_id uuid,
  p_drafts jsonb,
  p_label text,
  p_change_summary text,
  p_mode text default 'fill'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_previous_active_id uuid;
  v_new_version_id uuid;
  v_actor_id uuid;
  v_assignment_id uuid;
  v_assignment_ids uuid[] := '{}';
  v_draft record;
begin
  if p_academic_context_id is null or p_schedule_model_id is null then
    raise exception 'Academic Context dan Schedule Model wajib diisi';
  end if;

  if p_drafts is null or jsonb_typeof(p_drafts) <> 'array' or jsonb_array_length(p_drafts) = 0 then
    raise exception 'Draft jadwal AI kosong';
  end if;

  if p_mode not in ('fill', 'replace') then
    raise exception 'Mode publikasi AI tidak valid';
  end if;

  if not exists (
    select 1
    from schedule_model
    where id = p_schedule_model_id
      and academic_context_id = p_academic_context_id
  ) then
    raise exception 'Schedule Model tidak cocok dengan Academic Context';
  end if;

  -- Serialize AI publication per academic context so two one-click AI runs
  -- cannot publish over each other concurrently.
  perform pg_advisory_xact_lock(hashtext(p_academic_context_id::text));

  select id into v_previous_active_id
  from schedule_version
  where academic_context_id = p_academic_context_id
    and status = 'active'
  order by created_at desc
  limit 1
  for update;

  v_actor_id := auth.uid();

  insert into schedule_version (
    academic_context_id,
    label,
    created_by,
    source,
    status,
    change_summary
  )
  values (
    p_academic_context_id,
    coalesce(nullif(trim(p_label), ''), 'SAKALA AI'),
    v_actor_id,
    'ai_assisted',
    'active',
    p_change_summary
  )
  returning id into v_new_version_id;

  -- A partial "fill" must not replace the whole timetable. Copy the current
  -- active committed version into the new version first; committed rows are
  -- immutable, so this creates a new version snapshot rather than mutating
  -- historical rows.
  if p_mode = 'fill' and v_previous_active_id is not null then
    insert into schedule_assignment (
      academic_context_id,
      schedule_model_id,
      class_id,
      subject_id,
      teacher_id,
      room_id,
      day,
      period_start,
      period_end,
      activity_type,
      status,
      source,
      version_id
    )
    select
      academic_context_id,
      schedule_model_id,
      class_id,
      subject_id,
      teacher_id,
      room_id,
      day,
      period_start,
      period_end,
      activity_type,
      'committed',
      source,
      v_new_version_id
    from schedule_assignment
    where academic_context_id = p_academic_context_id
      and schedule_model_id = p_schedule_model_id
      and version_id = v_previous_active_id
      and status = 'committed';
  end if;

  for v_draft in
    select *
    from jsonb_to_recordset(p_drafts) as d(
      class_id uuid,
      subject_id uuid,
      teacher_id uuid,
      room_id uuid,
      day text,
      period_start integer,
      period_end integer,
      activity_type text
    )
  loop
    if v_draft.class_id is null
       or v_draft.subject_id is null
       or v_draft.teacher_id is null
       or v_draft.day is null
       or v_draft.period_start is null
       or v_draft.period_end is null then
      raise exception 'Draft AI memiliki field wajib yang kosong';
    end if;

    if v_draft.period_start < 1 or v_draft.period_end < v_draft.period_start then
      raise exception 'Rentang jam AI tidak valid';
    end if;

    insert into schedule_assignment (
      academic_context_id,
      schedule_model_id,
      class_id,
      subject_id,
      teacher_id,
      room_id,
      day,
      period_start,
      period_end,
      activity_type,
      status,
      source,
      version_id
    )
    values (
      p_academic_context_id,
      p_schedule_model_id,
      v_draft.class_id,
      v_draft.subject_id,
      v_draft.teacher_id,
      v_draft.room_id,
      v_draft.day,
      v_draft.period_start,
      v_draft.period_end,
      coalesce(nullif(v_draft.activity_type, ''), 'belajar_mengajar'),
      'committed',
      'ai_assisted',
      v_new_version_id
    )
    returning id into v_assignment_id;

    v_assignment_ids := array_append(v_assignment_ids, v_assignment_id);
  end loop;

  -- The new version is only allowed to replace the old active version after
  -- every row in the new snapshot has been written successfully.
  if v_previous_active_id is not null and v_previous_active_id <> v_new_version_id then
    update schedule_version
    set status = 'superseded'
    where id = v_previous_active_id;
  end if;

  foreach v_assignment_id in array v_assignment_ids
  loop
    begin
      insert into audit_log (
        academic_context_id,
        actor_id,
        actor_email,
        action,
        entity_type,
        entity_id,
        entity_label,
        source,
        reason
      )
      values (
        p_academic_context_id,
        v_actor_id,
        null,
        'commit',
        'schedule_assignment',
        v_assignment_id,
        coalesce(nullif(trim(p_label), ''), 'SAKALA AI'),
        'ai',
        p_change_summary
      );
    exception when others then
      raise warning 'audit_log insert gagal untuk assignment %: %', v_assignment_id, sqlerrm;
    end;
  end loop;

  return jsonb_build_object(
    'version_id', v_new_version_id,
    'assignment_ids', to_jsonb(v_assignment_ids),
    'assignment_count', coalesce(array_length(v_assignment_ids, 1), 0),
    'mode', p_mode
  );
end;
$$;

comment on function public.publish_ai_schedule_atomic is
  'Publikasi jadwal SAKALA AI satu-klik secara atomic. Mode fill mempertahankan snapshot jadwal aktif lalu menambah hasil AI; mode replace mengganti snapshot hanya setelah jadwal baru lengkap. Candidate/commit tidak menjadi langkah operator.';
