-- 20260901120000_fix_ai_schedule_publish_duplication.sql
--
-- ROOT CAUSE (ditemukan lewat evidence langsung ke database production,
-- bukan asumsi): publish_ai_schedule_atomic mode 'fill' MENYALIN seluruh
-- baris committed dari versi aktif lama ke versi baru, tapi baris LAMA
-- tidak pernah ditandai tidak berlaku (status tetap 'committed'). Karena
-- app layer (aiScheduleFill.usecases.ts) menghitung "sudah terjadwal"
-- berdasarkan version_id versi aktif, dan version_id berubah tiap publish,
-- perhitungan itu selalu kembali ke 0 di publish berikutnya -- akibatnya
-- setiap klik AI menggandakan SELURUH jadwal yang sudah ada, bukan cuma
-- menambah kekurangan. Production sempat 3x klik/percobaan berturut-turut
-- -> data jadi tepat 3x lipat (7A: 89 baris utk target 30 JP, dst).
--
-- FIX -- dua perubahan fundamental, bukan tambal gejala:
--
-- 1. Mode 'fill' TIDAK LAGI membuat versi baru & menyalin baris lama.
--    Draft baru langsung ditulis ke version_id AKTIF yang sama (append,
--    bukan copy-replace). Kalau belum ada versi aktif, baru dibuat satu.
--    Ini juga otomatis memperbaiki bug penghitungan "sudah terjadwal" di
--    app layer, karena version_id tidak lagi berubah tiap klik AI.
--
-- 2. Mode 'replace' (susun ulang seminggu) meng-ARSIPKAN (status =
--    'archived') seluruh baris committed lama SEBELUM menulis draft baru
--    ke versi baru -- bukan membiarkannya menggantung sebagai 'committed'
--    ganda seperti sebelumnya.
--
-- 3. HARD CONSTRAINT baru sebelum insert apa pun (sesuai prinsip "AI tidak
--    boleh mempublikasikan JP berlebih atau bentrok"): cek konflik kelas,
--    guru, dan duplikat SEBELUM menulis apa pun. Kalau ada satu saja
--    konflik -- SELURUH transaksi dibatalkan (tidak ada partial publish),
--    jadwal lama tetap 100% aman.

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
set search_path to 'public'
as $function$
declare
  v_previous_active_id uuid;
  v_target_version_id uuid;
  v_actor_id uuid;
  v_assignment_id uuid;
  v_assignment_ids uuid[] := '{}';
  v_draft record;
  v_dup_check text;
  v_class_conflict record;
  v_teacher_conflict record;
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
    select 1 from schedule_model
    where id = p_schedule_model_id and academic_context_id = p_academic_context_id
  ) then
    raise exception 'Schedule Model tidak cocok dengan Academic Context';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_academic_context_id::text));

  -- Validasi field wajib & rentang jam dulu, sebelum menyentuh apa pun.
  for v_draft in
    select * from jsonb_to_recordset(p_drafts) as d(
      class_id uuid, subject_id uuid, teacher_id uuid, room_id uuid,
      day text, period_start integer, period_end integer, activity_type text
    )
  loop
    if v_draft.class_id is null or v_draft.subject_id is null or v_draft.teacher_id is null
       or v_draft.day is null or v_draft.period_start is null or v_draft.period_end is null then
      raise exception 'Draft AI memiliki field wajib yang kosong';
    end if;
    if v_draft.period_start < 1 or v_draft.period_end < v_draft.period_start then
      raise exception 'Rentang jam AI tidak valid';
    end if;
  end loop;

  -- HARD GUARD 1: duplikat slot kelas DI DALAM batch draft itu sendiri.
  select string_agg(distinct class_id::text || ' ' || day || ' jam ' || period_start, '; ')
  into v_dup_check
  from (
    select class_id, day, period_start, count(*) c
    from jsonb_to_recordset(p_drafts) as d(class_id uuid, day text, period_start integer)
    group by class_id, day, period_start
    having count(*) > 1
  ) dupes;
  if v_dup_check is not null then
    raise exception 'AI menghasilkan slot kelas ganda pada batch yang sama: %. Tidak ada yang dipublikasikan.', v_dup_check;
  end if;

  -- HARD GUARD 2: duplikat slot guru DI DALAM batch draft itu sendiri.
  select string_agg(distinct teacher_id::text || ' ' || day || ' jam ' || period_start, '; ')
  into v_dup_check
  from (
    select teacher_id, day, period_start, count(*) c
    from jsonb_to_recordset(p_drafts) as d(teacher_id uuid, day text, period_start integer)
    group by teacher_id, day, period_start
    having count(*) > 1
  ) dupes;
  if v_dup_check is not null then
    raise exception 'AI menempatkan satu guru di dua tempat pada jam yang sama: %. Tidak ada yang dipublikasikan.', v_dup_check;
  end if;

  select id into v_previous_active_id
  from schedule_version
  where academic_context_id = p_academic_context_id and status = 'active'
  order by created_at desc limit 1
  for update;

  -- HARD GUARD 3: bentrok terhadap jadwal committed yang SUDAH ADA (bukan
  -- cuma sesama draft baru). Untuk mode 'replace', baris lama akan diarsipkan
  -- di bawah SEBELUM guard ini dievaluasi, jadi guard ini otomatis hanya
  -- relevan untuk mode 'fill' (jadwal lama tetap dipertahankan).
  if p_mode = 'replace' and v_previous_active_id is not null then
    update schedule_assignment
    set status = 'archived'
    where academic_context_id = p_academic_context_id
      and schedule_model_id = p_schedule_model_id
      and version_id = v_previous_active_id
      and status = 'committed';
  end if;

  select sa.class_id, sa.day, sa.period_start into v_class_conflict
  from jsonb_to_recordset(p_drafts) as d(class_id uuid, day text, period_start integer)
  join schedule_assignment sa
    on sa.class_id = d.class_id and sa.day = d.day and sa.period_start = d.period_start
  where sa.academic_context_id = p_academic_context_id
    and sa.schedule_model_id = p_schedule_model_id
    and sa.status = 'committed'
  limit 1;
  if v_class_conflict is not null then
    raise exception 'Kelas sudah punya jadwal di slot % jam %. Tidak ada yang dipublikasikan, jadwal lama tetap aman.', v_class_conflict.day, v_class_conflict.period_start;
  end if;

  select sa.teacher_id, sa.day, sa.period_start into v_teacher_conflict
  from jsonb_to_recordset(p_drafts) as d(teacher_id uuid, day text, period_start integer)
  join schedule_assignment sa
    on sa.teacher_id = d.teacher_id and sa.day = d.day and sa.period_start = d.period_start
  where sa.academic_context_id = p_academic_context_id
    and sa.schedule_model_id = p_schedule_model_id
    and sa.status = 'committed'
  limit 1;
  if v_teacher_conflict is not null then
    raise exception 'Guru sudah mengajar di tempat lain pada slot % jam %. Tidak ada yang dipublikasikan, jadwal lama tetap aman.', v_teacher_conflict.day, v_teacher_conflict.period_start;
  end if;

  v_actor_id := auth.uid();

  if p_mode = 'replace' or v_previous_active_id is null then
    insert into schedule_version (academic_context_id, label, created_by, source, status, change_summary)
    values (p_academic_context_id, coalesce(nullif(trim(p_label), ''), 'SAKALA AI'), v_actor_id, 'ai_assisted', 'active', p_change_summary)
    returning id into v_target_version_id;

    if v_previous_active_id is not null and v_previous_active_id <> v_target_version_id then
      update schedule_version set status = 'superseded' where id = v_previous_active_id;
    end if;
  else
    -- mode 'fill' dengan versi aktif yang sudah ada: APPEND ke versi yang
    -- SAMA, jangan buat versi baru & jangan salin baris lama. Ini yang
    -- menghilangkan seluruh kelas bug duplikasi.
    v_target_version_id := v_previous_active_id;
  end if;

  for v_draft in
    select * from jsonb_to_recordset(p_drafts) as d(
      class_id uuid, subject_id uuid, teacher_id uuid, room_id uuid,
      day text, period_start integer, period_end integer, activity_type text
    )
  loop
    insert into schedule_assignment (
      academic_context_id, schedule_model_id, class_id, subject_id, teacher_id,
      room_id, day, period_start, period_end, activity_type, status, source, version_id
    )
    values (
      p_academic_context_id, p_schedule_model_id, v_draft.class_id, v_draft.subject_id, v_draft.teacher_id,
      v_draft.room_id, v_draft.day, v_draft.period_start, v_draft.period_end,
      coalesce(nullif(v_draft.activity_type, ''), 'belajar_mengajar'), 'committed', 'ai_assisted', v_target_version_id
    )
    returning id into v_assignment_id;

    v_assignment_ids := array_append(v_assignment_ids, v_assignment_id);
  end loop;

  foreach v_assignment_id in array v_assignment_ids
  loop
    begin
      insert into audit_log (academic_context_id, actor_id, actor_email, action, entity_type, entity_id, entity_label, source, reason)
      values (p_academic_context_id, v_actor_id, null, 'commit', 'schedule_assignment', v_assignment_id, coalesce(nullif(trim(p_label), ''), 'SAKALA AI'), 'ai', p_change_summary);
    exception when others then
      raise warning 'audit_log insert gagal untuk assignment %: %', v_assignment_id, sqlerrm;
    end;
  end loop;

  return jsonb_build_object(
    'version_id', v_target_version_id,
    'assignment_ids', to_jsonb(v_assignment_ids),
    'assignment_count', coalesce(array_length(v_assignment_ids, 1), 0),
    'mode', p_mode
  );
end;
$function$;

comment on function public.publish_ai_schedule_atomic is
  'Publikasi jadwal SAKALA AI: fill = append ke versi aktif yang sama (tidak menyalin/duplikasi baris lama), replace = arsipkan baris lama lalu tulis versi baru. Hard guard kelas/guru/duplikat batch dicek sebelum insert apa pun -- gagal satu, batal semua.';
