// Application layer — use case / orchestration. Memanggil Domain untuk validasi
// struktural, Conflict Engine untuk validasi lintas-entity (Bagian 22/23), dan
// Data Access untuk persistence. UI hanya boleh memanggil layer ini.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateScheduleAssignmentDraft,
  ScheduleAssignmentValidationError,
  type ScheduleAssignment,
  type ScheduleAssignmentDraft,
} from "@/lib/domain/scheduleAssignment";
import type { ScheduleConflict } from "@/lib/domain/conflict";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import { scheduleVersionRepository } from "@/lib/data-access/scheduleVersion.repository";
import { validateAssignmentCandidate } from "@/lib/application/conflictEngine";
import { recordAuditEvent } from "@/lib/application/auditLog.usecases";
import type { AuditSource } from "@/lib/domain/auditLog";

export interface ValidationResult {
  conflicts: ScheduleConflict[];
  hasBlockingConflict: boolean;
}

function toResult(conflicts: ScheduleConflict[]): ValidationResult {
  return { conflicts, hasBlockingConflict: conflicts.some((c) => c.blocking) };
}

export async function listScheduleAssignments(supabase: SupabaseClient, academicContextId: string): Promise<ScheduleAssignment[]> {
  return scheduleAssignmentRepository.findByContext(supabase, academicContextId);
}

export async function getScheduleAssignment(supabase: SupabaseClient, id: string): Promise<ScheduleAssignment | null> {
  return scheduleAssignmentRepository.findById(supabase, id);
}

/** Preview-only validation. No database mutation. */
export async function validateAssignment(supabase: SupabaseClient, draft: ScheduleAssignmentDraft, excludeId?: string): Promise<ValidationResult> {
  validateScheduleAssignmentDraft(draft);
  const conflicts = await validateAssignmentCandidate(supabase, draft, excludeId);
  return toResult(conflicts);
}

/** Save a non-committed draft/candidate. Committed rows have a dedicated commit path. */
export async function saveAssignmentDraft(supabase: SupabaseClient, draft: ScheduleAssignmentDraft): Promise<{ assignment: ScheduleAssignment; conflicts: ScheduleConflict[] }> {
  if (draft.status === "committed") {
    throw new ScheduleAssignmentValidationError("status", "Gunakan commitAssignments untuk menyimpan status committed, bukan saveAssignmentDraft.");
  }
  validateScheduleAssignmentDraft(draft);
  const conflicts = await validateAssignmentCandidate(supabase, draft);
  const blocking = conflicts.filter((c) => c.blocking);
  if (blocking.length > 0) {
    throw new ScheduleAssignmentValidationError("conflict", blocking.map((c) => c.message).join(" "));
  }
  const assignment = await scheduleAssignmentRepository.create(supabase, draft);
  return { assignment, conflicts };
}

export async function updateAssignmentDraft(
  supabase: SupabaseClient,
  id: string,
  draft: ScheduleAssignmentDraft
): Promise<{ assignment: ScheduleAssignment; conflicts: ScheduleConflict[] }> {
  if (draft.status === "committed") {
    throw new ScheduleAssignmentValidationError("status", "Gunakan commitAssignments untuk mengubah status ke committed, bukan updateAssignmentDraft.");
  }
  const existing = await scheduleAssignmentRepository.findById(supabase, id);
  if (!existing) throw new ScheduleAssignmentValidationError("id", "Assignment tidak ditemukan.");
  if (existing.status === "committed") {
    throw new ScheduleAssignmentValidationError("status", "Committed schedule tidak boleh dimutasi langsung. Buat candidate baru lalu commit secara eksplisit.");
  }
  validateScheduleAssignmentDraft(draft);
  const conflicts = await validateAssignmentCandidate(supabase, draft, id);
  const blocking = conflicts.filter((c) => c.blocking);
  if (blocking.length > 0) {
    throw new ScheduleAssignmentValidationError("conflict", blocking.map((c) => c.message).join(" "));
  }
  const assignment = await scheduleAssignmentRepository.update(supabase, id, draft);
  return { assignment, conflicts };
}

export async function deleteAssignment(supabase: SupabaseClient, id: string): Promise<void> {
  return scheduleAssignmentRepository.remove(supabase, id);
}

export async function archiveOrDeleteAssignment(supabase: SupabaseClient, id: string, source: AuditSource = "manual", callerReason?: string | null): Promise<{ archived: boolean }> {
  const existing = await scheduleAssignmentRepository.findById(supabase, id);
  if (!existing) {
    throw new ScheduleAssignmentValidationError("id", "Assignment tidak ditemukan.");
  }
  if (existing.status === "committed") {
    await scheduleAssignmentRepository.setStatus(supabase, id, "archived", existing.versionId);
    await recordAuditEvent({
      supabase,
      academicContextId: existing.academicContextId,
      action: "delete",
      entityType: "schedule_assignment",
      entityId: id,
      entityLabel: null,
      before: existing,
      source,
      reason: callerReason ? `Assignment committed di-archive, bukan dihapus permanen. ${callerReason}` : "Assignment committed di-archive, bukan dihapus permanen.",
    });
    return { archived: true };
  }
  await scheduleAssignmentRepository.remove(supabase, id);
  await recordAuditEvent({
    supabase,
    academicContextId: existing.academicContextId,
    action: "delete",
    entityType: "schedule_assignment",
    entityId: id,
    entityLabel: null,
    before: existing,
    source,
    reason: callerReason ?? null,
  });
  return { archived: false };
}

/** Review → Validate → Save Draft/Candidate → optional explicit Commit. */
export async function addAssignment(
  supabase: SupabaseClient,
  draft: ScheduleAssignmentDraft,
  commit: boolean,
  label?: string
): Promise<{ assignment: ScheduleAssignment; conflicts: ScheduleConflict[]; versionId: string | null }> {
  const saved = await saveAssignmentDraft(supabase, { ...draft, status: "draft", versionId: null });
  if (!commit) {
    return { assignment: saved.assignment, conflicts: saved.conflicts, versionId: null };
  }
  const result = await commitAssignments(supabase, draft.academicContextId, [saved.assignment.id], label ?? "Tambah jadwal manual", null);
  const committed = await scheduleAssignmentRepository.findById(supabase, saved.assignment.id);
  return { assignment: committed ?? saved.assignment, conflicts: result.conflictsByAssignment[saved.assignment.id] ?? saved.conflicts, versionId: result.versionId };
}

/**
 * Move/Edit Schedule.
 *
 * IMPORTANT: committed rows are immutable history. Moving a committed row
 * creates a NEW candidate row; the old committed row is never mutated before
 * explicit commit. If commit=true, the new candidate is committed through the
 * same single commit path and the previous active version is superseded.
 */
export async function moveAssignment(
  supabase: SupabaseClient,
  id: string,
  changes: { day: ScheduleAssignmentDraft["day"]; periodStart: number; periodEnd: number; roomId: string | null; classId?: string; subjectId?: string; teacherId?: string },
  label?: string
): Promise<{ assignment: ScheduleAssignment; versionId: string; conflicts: ScheduleConflict[] }> {
  const existing = await scheduleAssignmentRepository.findById(supabase, id);
  if (!existing) {
    throw new ScheduleAssignmentValidationError("id", "Assignment tidak ditemukan.");
  }

  const draft: ScheduleAssignmentDraft = {
    academicContextId: existing.academicContextId,
    scheduleModelId: existing.scheduleModelId,
    classId: changes.classId ?? existing.classId,
    subjectId: changes.subjectId ?? existing.subjectId,
    teacherId: changes.teacherId ?? existing.teacherId,
    roomId: changes.roomId,
    day: changes.day,
    periodStart: changes.periodStart,
    periodEnd: changes.periodEnd,
    activityType: existing.activityType,
    status: "candidate",
    source: existing.source,
    versionId: null,
  };

  // Committed source rows are copied, never mutated. Non-committed rows can
  // still be edited in place while they remain outside the committed history.
  const candidate = existing.status === "committed"
    ? await saveAssignmentDraft(supabase, draft)
    : await updateAssignmentDraft(supabase, existing.id, draft);

  const result = await commitAssignments(supabase, existing.academicContextId, [candidate.assignment.id], label ?? "Pindah jadwal", "Dipindahkan via Jadwal Operational Workspace");
  const moved = await scheduleAssignmentRepository.findById(supabase, candidate.assignment.id);
  if (!moved) {
    throw new ScheduleAssignmentValidationError("id", "Assignment tidak ditemukan setelah dipindahkan.");
  }
  return { assignment: moved, versionId: result.versionId, conflicts: result.conflictsByAssignment[candidate.assignment.id] ?? [] };
}

/**
 * CANDIDATE → COMMITTED is the only legal transition into committed state.
 * All assignments are validated first; if any blocking conflict exists the
 * whole operation stops before a new version is created. Committed rows are
 * rejected as input, preventing accidental re-commit or silent mutation.
 */
export async function commitAssignments(
  supabase: SupabaseClient,
  academicContextId: string,
  assignmentIds: string[],
  label: string,
  changeSummary: string | null
): Promise<{ versionId: string; conflictsByAssignment: Record<string, ScheduleConflict[]> }> {
  if (assignmentIds.length === 0) {
    throw new ScheduleAssignmentValidationError("assignmentIds", "Pilih minimal satu assignment untuk di-commit.");
  }

  const uniqueIds = [...new Set(assignmentIds)];
  const conflictsByAssignment: Record<string, ScheduleConflict[]> = {};
  const assignments: ScheduleAssignment[] = [];

  for (const id of uniqueIds) {
    const existing = await scheduleAssignmentRepository.findById(supabase, id);
    if (!existing) {
      throw new ScheduleAssignmentValidationError("assignmentIds", `Assignment ${id} tidak ditemukan.`);
    }
    if (existing.academicContextId !== academicContextId) {
      throw new ScheduleAssignmentValidationError("academicContextId", "Semua assignment yang di-commit wajib berada dalam Academic Context yang sama.");
    }
    if (existing.status === "committed") {
      throw new ScheduleAssignmentValidationError("status", "Committed schedule bersifat immutable. Buat candidate baru untuk perubahan lalu commit candidate tersebut.");
    }
    if (existing.status !== "candidate" && existing.status !== "draft") {
      throw new ScheduleAssignmentValidationError("status", `Assignment ${id} tidak berada pada status candidate/draft yang dapat di-commit.`);
    }

    const draftForCommitCheck = { ...existing, status: "committed" as const };
    const conflicts = await validateAssignmentCandidate(supabase, draftForCommitCheck, id);
    conflictsByAssignment[id] = conflicts;
    assignments.push(existing);
  }

  const blocking = Object.values(conflictsByAssignment).some((conflicts) => conflicts.some((c) => c.blocking));
  if (blocking) {
    throw new ScheduleAssignmentValidationError(
      "conflict",
      "Ada assignment dengan blocking conflict — commit dibatalkan untuk seluruh batch. Perbaiki semua conflict severity Error sebelum commit ulang."
    );
  }

  // Only now create the committed version. The previous active version is
  // superseded after the new version exists, so candidate review never alters
  // the current committed version.
  const previousActive = await scheduleVersionRepository.findActiveByContext(supabase, academicContextId);
  const version = await scheduleVersionRepository.create(supabase, {
    academicContextId,
    label,
    createdBy: null,
    source: "manual",
    changeSummary,
  });

  if (previousActive && previousActive.id !== version.id) {
    await scheduleVersionRepository.setStatus(supabase, previousActive.id, "superseded");
  }

  for (const assignment of assignments) {
    await scheduleAssignmentRepository.setStatus(supabase, assignment.id, "committed", version.id);
  }

  for (const id of uniqueIds) {
    const committed = await scheduleAssignmentRepository.findById(supabase, id);
    await recordAuditEvent({
      supabase,
      academicContextId,
      action: "commit",
      entityType: "schedule_assignment",
      entityId: id,
      entityLabel: label,
      after: committed,
      source: "manual",
      reason: changeSummary,
    });
  }

  return { versionId: version.id, conflictsByAssignment };
}
