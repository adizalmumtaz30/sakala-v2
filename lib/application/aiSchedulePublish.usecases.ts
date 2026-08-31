import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduleAssignmentDraft } from "@/lib/domain/scheduleAssignment";

/**
 * Publishes an AI-generated schedule directly as the new active schedule.
 * The database function performs insert + version activation + audit in one
 * transaction. There is deliberately no user-facing candidate/commit step.
 */
export async function publishAiScheduleAtomic(
  supabase: SupabaseClient,
  params: {
    academicContextId: string;
    scheduleModelId: string;
    drafts: ScheduleAssignmentDraft[];
    label: string;
    changeSummary: string;
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
  });

  if (error) {
    throw new Error(`Publikasi jadwal AI gagal dan dibatalkan: ${error.message}`);
  }

  const result = data as { version_id: string; assignment_ids: string[] } | null;
  if (!result?.version_id || !Array.isArray(result.assignment_ids)) {
    throw new Error("Publikasi jadwal AI tidak mengembalikan hasil verifikasi yang valid.");
  }

  return { versionId: result.version_id, assignmentIds: result.assignment_ids };
}
