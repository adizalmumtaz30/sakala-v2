"use server";

import { createClient } from "@/lib/supabase/server";
import { planScheduleFromCommand, type AiSchedulePlan } from "@/lib/application/aiSchedulePlanner";
import { saveCandidatesAction, commitAssignmentsAction } from "@/app/(shell)/jadwal-cerdas/actions";

export type AiActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** AI planning is preview-only. It never writes or commits a schedule. */
export async function planScheduleAction(command: string): Promise<AiActionResult<AiSchedulePlan>> {
  try {
    const supabase = await createClient();
    const contexts = await import("@/lib/application/academicContext.usecases").then((m) => m.listAcademicContexts(supabase));
    const active = contexts.find((c) => c.isActive);
    if (!active) return { ok: false, error: "Belum ada konteks akademik aktif." };
    const plan = await planScheduleFromCommand(supabase, active.id, command);
    return { ok: true, data: plan };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menyusun rancangan jadwal AI." };
  }
}

/** Explicit user action: save the AI preview as candidate rows. */
export async function saveAiCandidatesAction(
  drafts: Parameters<typeof saveCandidatesAction>[0]
): Promise<AiActionResult<{ savedCount: number; skippedCount: number }>> {
  return saveCandidatesAction(drafts);
}

/** Explicit user action: commit only after candidate review/approval. */
export async function commitAiCandidatesAction(
  academicContextId: string,
  assignmentIds: string[],
  label: string,
  changeSummary: string | null
): Promise<AiActionResult<{ versionId: string; conflictsByAssignment: Record<string, import("@/lib/domain/conflict").ScheduleConflict[]> }>> {
  return commitAssignmentsAction(academicContextId, assignmentIds, label, changeSummary);
}
