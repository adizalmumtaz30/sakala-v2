// Application layer — use case / orchestration. Memanggil Domain untuk validasi
// struktural, Conflict Engine untuk validasi lintas-entity (Bagian 22/23), dan
// Data Access untuk persistence. UI (Presentation, step 14/15 nanti) hanya
// boleh memanggil layer ini — TIDAK PERNAH memanggil repository langsung.

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

export interface ValidationResult {
  conflicts: ScheduleConflict[];
  hasBlockingConflict: boolean;
}

/** Bagian 68 — "BLOCKING CONFLICT wajib mencegah commit." */
function toResult(conflicts: ScheduleConflict[]): ValidationResult {
  return { conflicts, hasBlockingConflict: conflicts.some((c) => c.blocking) };
}

export async function listScheduleAssignments(supabase: SupabaseClient, academicContextId: string): Promise<ScheduleAssignment[]> {
  return scheduleAssignmentRepository.findByContext(supabase, academicContextId);
}

export async function getScheduleAssignment(supabase: SupabaseClient, id: string): Promise<ScheduleAssignment | null> {
  return scheduleAssignmentRepository.findById(supabase, id);
}

/**
 * Menjalankan validasi (struktural + Conflict Engine) TANPA menyimpan apa
 * pun — dipakai UI (step 14/15) untuk preview real-time sebelum user
 * menekan simpan/commit ("Conflict should be visible at slot/row/summary",
 * Bagian 23.3).
 */
export async function validateAssignment(supabase: SupabaseClient, draft: ScheduleAssignmentDraft, excludeId?: string): Promise<ValidationResult> {
  validateScheduleAssignmentDraft(draft);
  const conflicts = await validateAssignmentCandidate(supabase, draft, excludeId);
  return toResult(conflicts);
}

/**
 * Simpan assignment sebagai draft/candidate. TIDAK blocking pada conflict
 * severity warning/info (Bagian 23.1) — hanya error yang mencegah simpan,
 * supaya user tetap bisa menyusun rencana bertahap sebelum commit.
 */
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

/**
 * Bagian 28 (Delete Schedule) — Claude addition: spesifikasi tidak
 * membedakan hard-delete vs soft-delete secara eksplisit, tapi domain
 * sudah punya status "archived" (Bagian 21.2) khusus untuk kasus ini, dan
 * History (step 18) belum dibangun untuk menyimpan jejak hapus terpisah.
 * Assignment COMMITTED di-archive (tetap ada sebagai jejak, versionId
 * dipertahankan) supaya tidak menghilang tanpa bekas dari Schedule Version
 * yang sudah tercatat; assignment draft/candidate (belum pernah jadi bagian
 * histori resmi) di-hapus permanen seperti sebelumnya. Flag untuk direview
 * saat step 18 dibangun.
 */
export async function archiveOrDeleteAssignment(supabase: SupabaseClient, id: string): Promise<{ archived: boolean }> {
  const existing = await scheduleAssignmentRepository.findById(supabase, id);
  if (!existing) {
    throw new ScheduleAssignmentValidationError("id", "Assignment tidak ditemukan.");
  }
  if (existing.status === "committed") {
    await scheduleAssignmentRepository.setStatus(supabase, id, "archived", existing.versionId);
    return { archived: true };
  }
  await scheduleAssignmentRepository.remove(supabase, id);
  return { archived: false };
}

/**
 * Bagian 26 (Add Schedule Workflow) — orkestrasi "Review → Validate → Save
 * Draft / Commit" dalam satu pemanggilan. Selalu disimpan sebagai draft
 * dulu (lewat saveAssignmentDraft, yang sudah menegakkan blocking conflict),
 * lalu — kalau user memilih Commit, bukan Save Draft — langsung di-commit
 * lewat commitAssignments (satu-satunya jalur status "committed", Bagian
 * 21.3/68) supaya tetap tercatat sebagai Schedule Version baru.
 */
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
  // Bagian 22.5 (JP_MISMATCH) hanya dievaluasi Conflict Engine saat status
  // sudah "committed" — pakai conflictsByAssignment hasil commit (bukan
  // saved.conflicts yang masih level draft) supaya reconciliation JP ikut
  // terlihat oleh pemanggil, bukan cuma dihitung lalu dibuang.
  return { assignment: committed ?? saved.assignment, conflicts: result.conflictsByAssignment[saved.assignment.id] ?? saved.conflicts, versionId: result.versionId };
}

/**
 * Bagian 27 (Move/Edit Schedule) — "Validate → Confirm → Commit → Create
 * history". Tidak ada jalur backend terpisah untuk "edit assignment
 * committed di tempat" — itu akan melanggar Bagian 21.3 (candidate tidak
 * boleh mengubah committed sebelum explicit commit). Sebagai gantinya,
 * assignment dikembalikan ke "draft" dengan field baru (divalidasi ulang
 * penuh oleh Conflict Engine, excludeId supaya tidak konflik dengan dirinya
 * sendiri), lalu langsung di-commit ulang lewat commitAssignments — ini
 * secara alami menghasilkan Schedule Version baru sebagai "history" tanpa
 * butuh tabel riwayat terpisah (step 18 belum dibangun).
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
    status: "draft",
    source: existing.source,
    versionId: null,
  };
  await updateAssignmentDraft(supabase, id, draft);
  const result = await commitAssignments(supabase, existing.academicContextId, [id], label ?? "Pindah jadwal", "Dipindahkan via Jadwal Operational Workspace");
  const moved = await scheduleAssignmentRepository.findById(supabase, id);
  if (!moved) {
    throw new ScheduleAssignmentValidationError("id", "Assignment tidak ditemukan setelah dipindahkan.");
  }
  // Sama seperti addAssignment() — conflictsByAssignment hasil commit
  // dikembalikan supaya JP_MISMATCH (dan non-blocking conflict lain) ikut
  // terlihat setelah pindah jadwal, bukan cuma dihitung lalu dibuang.
  return { assignment: moved, versionId: result.versionId, conflicts: result.conflictsByAssignment[id] ?? [] };
}


/**
 * Bagian 21.3 / 68 — "CANDIDATE tidak boleh mengubah COMMITTED SCHEDULE
 * sebelum explicit commit." commitAssignments() adalah SATU-SATUNYA jalur
 * yang boleh mengubah status assignment jadi "committed": membuat satu
 * Schedule Version baru, lalu memindahkan seluruh assignmentIds yang
 * diberikan ke status committed + versionId tersebut — atomik dari sisi
 * pemanggil (semua assignment tervalidasi dulu sebelum ada satu pun yang
 * ditulis). Assignment dengan blocking conflict (termasuk INACTIVE_ENTITY
 * yang di-escalate jadi error khusus status committed) MENCEGAH seluruh
 * commit — tidak ada commit sebagian.
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

  const conflictsByAssignment: Record<string, ScheduleConflict[]> = {};
  let hasBlocking = false;

  for (const id of assignmentIds) {
    const existing = await scheduleAssignmentRepository.findById(supabase, id);
    if (!existing) {
      throw new ScheduleAssignmentValidationError("assignmentIds", `Assignment ${id} tidak ditemukan.`);
    }
    const draftForCommitCheck = { ...existing, status: "committed" as const };
    const conflicts = await validateAssignmentCandidate(supabase, draftForCommitCheck, id);
    conflictsByAssignment[id] = conflicts;
    if (conflicts.some((c) => c.blocking)) hasBlocking = true;
  }

  if (hasBlocking) {
    throw new ScheduleAssignmentValidationError(
      "conflict",
      "Ada assignment dengan blocking conflict — commit dibatalkan untuk seluruh batch. Perbaiki semua conflict severity Error sebelum commit ulang."
    );
  }

  const version = await scheduleVersionRepository.create(supabase, {
    academicContextId,
    label,
    createdBy: null,
    source: "manual",
    changeSummary,
  });

  for (const id of assignmentIds) {
    await scheduleAssignmentRepository.setStatus(supabase, id, "committed", version.id);
  }

  return { versionId: version.id, conflictsByAssignment };
}
