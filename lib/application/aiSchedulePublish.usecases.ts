import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduleAssignmentDraft } from "@/lib/domain/scheduleAssignment";

export type AiSchedulePublishMode = "fill" | "replace";

/**
 * Publishes an AI-generated schedule without exposing candidate/commit steps to
 * the operator. The database transaction either publishes a complete active
 * version or leaves the previous active version untouched.
 */
export async function publishAiScheduleAtomic(
  supabase: SupabaseClient,
  params: {
    academicContextId: string;
    scheduleModelId: string;
    drafts: ScheduleAssignmentDraft[];
    label: string;
    changeSummary: string;
    mode: AiSchedulePublishMode;
  }
): Promise<{ versionId: string; assignmentIds: string[] }> {
  if (params.drafts.length === 0) {
    throw new Error("Tidak ada penempatan jadwal untuk dipublikasikan.");
  }

  for (const draft of params.drafts) {
    if (draft.academicContextId !== params.academicContextId) {
      throw new Error("AI schedule memiliki Academic Context yang tidak konsisten.");
    }
    if (draft.scheduleModelId !== params.scheduleModelId) {
      throw new Error("AI schedule memiliki Schedule Model yang tidak konsisten.");
    }
  }

  // Domain objects are camelCase; the atomic RPC parses snake_case JSONB.
  // Explicit mapping prevents required fields from becoming NULL at the DB boundary.
  const rpcDrafts = params.drafts.map((draft) => ({
    class_id: draft.classId,
    subject_id: draft.subjectId,
    teacher_id: draft.teacherId,
    room_id: draft.roomId,
    day: draft.day,
    period_start: draft.periodStart,
    period_end: draft.periodEnd,
    activity_type: draft.activityType,
  }));

  for (const draft of rpcDrafts) {
    if (!draft.class_id || !draft.subject_id || !draft.teacher_id || !draft.day ||
        !Number.isInteger(draft.period_start) || !Number.isInteger(draft.period_end)) {
      throw new Error("Jadwal AI belum lengkap. Proses dibatalkan; jadwal lama tetap aman.");
    }
    if (draft.period_start < 1 || draft.period_end < draft.period_start) {
      throw new Error("Rentang jam jadwal AI tidak valid. Jadwal lama tetap aman.");
    }
  }

  const { data, error } = await supabase.rpc("publish_ai_schedule_atomic", {
    p_academic_context_id: params.academicContextId,
    p_schedule_model_id: params.scheduleModelId,
    p_drafts: rpcDrafts,
    p_label: params.label,
    p_change_summary: params.changeSummary,
    p_mode: params.mode,
  });

  if (error) {
    throw new Error(`Publikasi jadwal AI gagal dan dibatalkan. Jadwal lama tetap aman. ${error.message}`);
  }

  const result = data as { version_id: string; assignment_ids: string[] } | null;
  if (!result?.version_id || !Array.isArray(result.assignment_ids) || result.assignment_ids.length === 0) {
    throw new Error("Publikasi jadwal AI tidak menghasilkan jadwal yang dapat diverifikasi. Jadwal lama tetap aman.");
  }

  return { versionId: result.version_id, assignmentIds: result.assignment_ids };
}
