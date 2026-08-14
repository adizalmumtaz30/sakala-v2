// Data Access layer — repository. Satu-satunya tempat yang boleh menulis query
// Supabase untuk entity Schedule Assignment. Application layer (termasuk
// Conflict Engine) memanggil fungsi di sini, tidak pernah memanggil Supabase
// langsung.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HariSekolah } from "@/lib/domain/jamPelajaran";
import type { JenisSlot } from "@/lib/domain/slotTemplate";
import type {
  ScheduleAssignment,
  ScheduleAssignmentDraft,
  ScheduleSource,
  ScheduleStatus,
} from "@/lib/domain/scheduleAssignment";

type Row = {
  id: string;
  academic_context_id: string;
  schedule_model_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  room_id: string | null;
  day: HariSekolah;
  period_start: number;
  period_end: number;
  activity_type: JenisSlot;
  status: ScheduleStatus;
  source: ScheduleSource;
  version_id: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT_COLUMNS =
  "id, academic_context_id, schedule_model_id, class_id, subject_id, teacher_id, room_id, day, period_start, period_end, activity_type, status, source, version_id, created_at, updated_at";

function rowToEntity(row: Row): ScheduleAssignment {
  return {
    id: row.id,
    academicContextId: row.academic_context_id,
    scheduleModelId: row.schedule_model_id,
    classId: row.class_id,
    subjectId: row.subject_id,
    teacherId: row.teacher_id,
    roomId: row.room_id,
    day: row.day,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    activityType: row.activity_type,
    status: row.status,
    source: row.source,
    versionId: row.version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function draftToRow(draft: ScheduleAssignmentDraft) {
  return {
    academic_context_id: draft.academicContextId,
    schedule_model_id: draft.scheduleModelId,
    class_id: draft.classId,
    subject_id: draft.subjectId,
    teacher_id: draft.teacherId,
    room_id: draft.roomId,
    day: draft.day,
    period_start: draft.periodStart,
    period_end: draft.periodEnd,
    activity_type: draft.activityType,
    status: draft.status,
    source: draft.source,
    version_id: draft.versionId,
  };
}

export const scheduleAssignmentRepository = {
  /**
   * Dipakai Conflict Engine (Bagian 22.1-22.3) — semua assignment aktif
   * (draft/candidate/committed; TIDAK archived/cancelled) pada satu hari
   * di satu konteks akademik, untuk dicek overlap terhadap kandidat baru.
   * excludeId dipakai saat validasi update (assignment tidak boleh dianggap
   * konflik dengan dirinya sendiri).
   */
  async findActiveByContextAndDay(
    supabase: SupabaseClient,
    academicContextId: string,
    day: HariSekolah,
    excludeId?: string
  ): Promise<ScheduleAssignment[]> {
    let query = supabase
      .from("schedule_assignment")
      .select(SELECT_COLUMNS)
      .eq("academic_context_id", academicContextId)
      .eq("day", day)
      .in("status", ["draft", "candidate", "committed"]);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async findByContext(supabase: SupabaseClient, academicContextId: string): Promise<ScheduleAssignment[]> {
    const { data, error } = await supabase
      .from("schedule_assignment")
      .select(SELECT_COLUMNS)
      .eq("academic_context_id", academicContextId)
      .order("day", { ascending: true })
      .order("period_start", { ascending: true });

    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async findByVersion(supabase: SupabaseClient, versionId: string): Promise<ScheduleAssignment[]> {
    const { data, error } = await supabase.from("schedule_assignment").select(SELECT_COLUMNS).eq("version_id", versionId);
    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async findById(supabase: SupabaseClient, id: string): Promise<ScheduleAssignment | null> {
    const { data, error } = await supabase.from("schedule_assignment").select(SELECT_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToEntity(data as Row) : null;
  },

  async create(supabase: SupabaseClient, draft: ScheduleAssignmentDraft): Promise<ScheduleAssignment> {
    const { data, error } = await supabase.from("schedule_assignment").insert(draftToRow(draft)).select(SELECT_COLUMNS).single();
    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async update(supabase: SupabaseClient, id: string, draft: ScheduleAssignmentDraft): Promise<ScheduleAssignment> {
    const { data, error } = await supabase
      .from("schedule_assignment")
      .update(draftToRow(draft))
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async setStatus(supabase: SupabaseClient, id: string, status: ScheduleStatus, versionId: string | null): Promise<ScheduleAssignment> {
    const { data, error } = await supabase
      .from("schedule_assignment")
      .update({ status, version_id: versionId })
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("schedule_assignment").delete().eq("id", id);
    if (error) throw error;
  },
};
