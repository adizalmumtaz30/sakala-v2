"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as scheduleAssignmentUseCases from "@/lib/application/scheduleAssignment.usecases";
import { validateJadwalImportRows, commitJadwalImportRows, type JadwalImportRowResult } from "@/lib/application/jadwalImport.usecases";
import { ScheduleAssignmentValidationError, type ScheduleAssignment, type ScheduleAssignmentDraft } from "@/lib/domain/scheduleAssignment";
import type { ScheduleConflict } from "@/lib/domain/conflict";
import type { HariSekolah } from "@/lib/domain/jamPelajaran";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function toMessage(err: unknown): string {
  if (err instanceof ScheduleAssignmentValidationError) return err.message;
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}

function revalidateJadwal() {
  revalidatePath("/jadwal");
  revalidatePath("/jadwal-cerdas");
  revalidatePath("/");
}

/** Preview validasi (Bagian 26.2 "Review sebelum commit") — TIDAK menulis DB. */
export async function validateAssignmentAction(draft: ScheduleAssignmentDraft, excludeId?: string): Promise<ActionResult<{ conflicts: ScheduleConflict[]; hasBlockingConflict: boolean }>> {
  try {
    const supabase = await createClient();
    const result = await scheduleAssignmentUseCases.validateAssignment(supabase, draft, excludeId);
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

/** Bagian 26 — Add Schedule Workflow, tahap akhir "Save Draft / Commit". */
export async function addAssignmentAction(
  draft: ScheduleAssignmentDraft,
  commit: boolean,
  label?: string
): Promise<ActionResult<{ assignment: ScheduleAssignment; conflicts: ScheduleConflict[]; versionId: string | null }>> {
  try {
    const supabase = await createClient();
    const result = await scheduleAssignmentUseCases.addAssignment(supabase, draft, commit, label);
    revalidateJadwal();
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

/** Bagian 27 — Move/Edit Schedule: pindah slot dan/atau ganti kelas/mapel/guru, lalu commit ulang sebagai Schedule Version baru. */
export async function moveAssignmentAction(
  id: string,
  changes: { day: HariSekolah; periodStart: number; periodEnd: number; roomId: string | null; classId?: string; subjectId?: string; teacherId?: string },
  label?: string
): Promise<ActionResult<{ assignment: ScheduleAssignment; versionId: string; conflicts: ScheduleConflict[] }>> {
  try {
    const supabase = await createClient();
    const result = await scheduleAssignmentUseCases.moveAssignment(supabase, id, changes, label);
    revalidateJadwal();
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

/** Bagian 28 — Delete Schedule (committed di-archive, draft/candidate dihapus permanen — lihat catatan di usecases). */
export async function deleteAssignmentAction(id: string): Promise<ActionResult<{ archived: boolean }>> {
  try {
    const supabase = await createClient();
    const result = await scheduleAssignmentUseCases.archiveOrDeleteAssignment(supabase, id);
    revalidateJadwal();
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

/** Preview impor Jadwal (Data Jadwal -> Impor Template) — TIDAK menulis DB. */
export async function validateJadwalImportAction(rows: Record<string, string>[]): Promise<ActionResult<JadwalImportRowResult[]>> {
  try {
    const supabase = await createClient();
    const result = await validateJadwalImportRows(supabase, rows);
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

/** Commit impor Jadwal — baris valid disimpan sbg CANDIDATE, bukan committed langsung. Review & terapkan lewat Jadwal Cerdas. */
export async function commitJadwalImportAction(academicContextId: string, scheduleModelId: string, rows: Record<string, string>[]): Promise<ActionResult<{ imported: number; skipped: number }>> {
  try {
    const supabase = await createClient();
    const result = await commitJadwalImportRows(supabase, academicContextId, scheduleModelId, rows);
    revalidateJadwal();
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}
