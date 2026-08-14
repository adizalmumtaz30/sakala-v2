"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  generateCandidatePreview,
  saveGeneratedCandidates,
  optimizeCandidateBatch,
  applyOptimization,
  type GenerationResult,
  type OptimizationPreview,
} from "@/lib/application/candidateGenerator";
import * as scheduleAssignmentUseCases from "@/lib/application/scheduleAssignment.usecases";
import { GenerationRequirementValidationError, type GenerationRequirement } from "@/lib/domain/candidateGeneration";
import { ScheduleAssignmentValidationError, type ScheduleAssignment } from "@/lib/domain/scheduleAssignment";
import type { ScheduleConflict } from "@/lib/domain/conflict";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Tahap Generate Candidate (preview, belum menulis DB) — Bagian 24.2. */
export async function generateCandidatesAction(
  academicContextId: string,
  scheduleModelId: string,
  requirements: GenerationRequirement[]
): Promise<ActionResult<GenerationResult>> {
  try {
    const supabase = await createClient();
    const result = await generateCandidatePreview(supabase, academicContextId, scheduleModelId, requirements);
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

/** Simpan hasil preview sebagai baris status="candidate" — transisi ke Candidate Review. */
export async function saveCandidatesAction(
  drafts: Parameters<typeof saveGeneratedCandidates>[1]
): Promise<ActionResult<{ savedCount: number; skippedCount: number }>> {
  try {
    const supabase = await createClient();
    const result = await saveGeneratedCandidates(supabase, drafts);
    revalidatePath("/jadwal-cerdas");
    revalidatePath("/");
    return { ok: true, data: { savedCount: result.saved.length, skippedCount: result.skipped.length } };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

/** Validasi ulang satu assignment (dipakai Candidate Review untuk refresh conflict list). */
export async function validateAssignmentAction(
  id: string
): Promise<ActionResult<Awaited<ReturnType<typeof scheduleAssignmentUseCases.getScheduleAssignment>>>> {
  try {
    const supabase = await createClient();
    const assignment = await scheduleAssignmentUseCases.getScheduleAssignment(supabase, id);
    return { ok: true, data: assignment };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function deleteAssignmentAction(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    await scheduleAssignmentUseCases.deleteAssignment(supabase, id);
    revalidatePath("/jadwal-cerdas");
    revalidatePath("/");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

/** Optimasi (preview, TIDAK menulis DB) — Bagian 24.4. */
export async function optimizeCandidatesAction(
  academicContextId: string,
  scheduleModelId: string,
  candidateIds: string[]
): Promise<ActionResult<OptimizationPreview>> {
  try {
    const supabase = await createClient();
    const preview = await optimizeCandidateBatch(supabase, academicContextId, scheduleModelId, candidateIds);
    return { ok: true, data: preview };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

/** Menerapkan hasil optimasi — hanya dipanggil setelah user memilih "Apply Optimization". */
export async function applyOptimizationAction(changes: OptimizationPreview["changes"]): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    await applyOptimization(supabase, changes);
    revalidatePath("/jadwal-cerdas");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

/** Final Validation + Commit + Create Version — Bagian 24.2/68 (satu-satunya jalur status jadi committed). */
export async function commitAssignmentsAction(
  academicContextId: string,
  assignmentIds: string[],
  label: string,
  changeSummary: string | null
): Promise<ActionResult<{ versionId: string }>> {
  try {
    const supabase = await createClient();
    const result = await scheduleAssignmentUseCases.commitAssignments(supabase, academicContextId, assignmentIds, label, changeSummary);
    revalidatePath("/jadwal-cerdas");
    revalidatePath("/jadwal");
    revalidatePath("/");
    return { ok: true, data: { versionId: result.versionId } };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function listCandidateAssignmentsAction(academicContextId: string): Promise<ActionResult<ScheduleAssignment[]>> {
  try {
    const supabase = await createClient();
    const all = await scheduleAssignmentUseCases.listScheduleAssignments(supabase, academicContextId);
    return { ok: true, data: all.filter((a) => a.status === "candidate") };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

/**
 * Candidate Review (Bagian 24.2/23.3) — daftar candidate assignment beserta
 * conflict masing-masing, supaya UI tidak perlu N+1 round-trip terpisah.
 */
export async function listCandidatesWithConflictsAction(
  academicContextId: string
): Promise<ActionResult<{ assignment: ScheduleAssignment; conflicts: ScheduleConflict[] }[]>> {
  try {
    const supabase = await createClient();
    const all = await scheduleAssignmentUseCases.listScheduleAssignments(supabase, academicContextId);
    const candidates = all.filter((a) => a.status === "candidate");
    const result: { assignment: ScheduleAssignment; conflicts: ScheduleConflict[] }[] = [];
    for (const assignment of candidates) {
      const validation = await scheduleAssignmentUseCases.validateAssignment(
        supabase,
        {
          academicContextId: assignment.academicContextId,
          scheduleModelId: assignment.scheduleModelId,
          classId: assignment.classId,
          subjectId: assignment.subjectId,
          teacherId: assignment.teacherId,
          roomId: assignment.roomId,
          day: assignment.day,
          periodStart: assignment.periodStart,
          periodEnd: assignment.periodEnd,
          activityType: assignment.activityType,
          status: assignment.status,
          source: assignment.source,
          versionId: assignment.versionId,
        },
        assignment.id
      );
      result.push({ assignment, conflicts: validation.conflicts });
    }
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

function toMessage(err: unknown): string {
  if (err instanceof GenerationRequirementValidationError) return err.message;
  if (err instanceof ScheduleAssignmentValidationError) return err.message;
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}
