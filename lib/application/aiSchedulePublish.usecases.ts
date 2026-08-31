import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduleAssignmentDraft } from "@/lib/domain/scheduleAssignment";

export type AiSchedulePublishMode = "fill" | "replace";

/**
 * Publishes an AI-generated schedule without exposing candidate/commit steps to
 * the operator. The database transaction either publishes a complete active
 * version or leaves the previous active version untouched.
 *
 * fill: copies the current active committed schedule into the new version and
 * adds the newly generated placements. This prevents a partial "fill" action
 * from accidentally replacing the entire timetable.
 *
 * replace: publishes only the generated full-week schedule as the new version.
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

  const { data, error } = await supabase.rpc("publish_ai_schedule_atomic", {
    p_academic_context_id: params.academicContextId,
    p_schedule_model_id: params.scheduleModelId,
    p_drafts: params.drafts,
    p_label: params.label,
    p_change_summary: params.changeSummary,
    p_mode: params.mode,
  });

  if (error) {
    throw new Error(`Publikasi jadwal AI gagal dan dibatalkan: ${error.message}`);
  }

  const result = data as { version_id: string; assignment_ids: string[] } | null;
  if (!result?.version_id || !Array.isArray(result.assignment_ids) || result.assignment_ids.length === 0) {
    throw new Error("Publikasi jadwal AI tidak mengembalikan hasil verifikasi yang valid.");
  }

  return { versionId: result.version_id, assignmentIds: result.assignment_ids };
}
