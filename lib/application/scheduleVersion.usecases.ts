import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAuditEvent } from "@/lib/application/auditLog.usecases";
import type { ScheduleVersion } from "@/lib/domain/scheduleVersion";
import { ScheduleVersionValidationError } from "@/lib/domain/scheduleVersion";
import { scheduleVersionRepository } from "@/lib/data-access/scheduleVersion.repository";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import type { ScheduleAssignment } from "@/lib/domain/scheduleAssignment";

export async function listScheduleVersions(supabase: SupabaseClient, academicContextId: string): Promise<ScheduleVersion[]> {
  return scheduleVersionRepository.findByContext(supabase, academicContextId);
}

export async function getScheduleVersion(supabase: SupabaseClient, id: string): Promise<ScheduleVersion | null> {
  return scheduleVersionRepository.findById(supabase, id);
}

export async function getScheduleVersionAssignments(supabase: SupabaseClient, versionId: string): Promise<ScheduleAssignment[]> {
  return scheduleAssignmentRepository.findByVersion(supabase, versionId);
}

export async function archiveScheduleVersion(supabase: SupabaseClient, id: string): Promise<ScheduleVersion> {
  return scheduleVersionRepository.setStatus(supabase, id, "archived");
}

export async function supersedeScheduleVersion(supabase: SupabaseClient, id: string): Promise<ScheduleVersion> {
  return scheduleVersionRepository.setStatus(supabase, id, "superseded");
}

/** Explicitly restores a previous committed version without deleting history. */
export async function restoreScheduleVersion(
  supabase: SupabaseClient,
  academicContextId: string,
  versionId: string,
  reason = "Pulihkan versi jadwal dari Riwayat"
): Promise<{ versionId: string; restoredAssignments: number }> {
  const target = await scheduleVersionRepository.findById(supabase, versionId);
  if (!target || target.academicContextId !== academicContextId) {
    throw new ScheduleVersionValidationError("versionId", "Versi jadwal tidak ditemukan pada Academic Context aktif.");
  }
  if (target.status === "active") {
    throw new ScheduleVersionValidationError("versionId", "Versi tersebut sudah menjadi versi aktif.");
  }

  const current = await scheduleVersionRepository.findActiveByContext(supabase, academicContextId);
  const targetAssignments = await scheduleAssignmentRepository.findByVersion(supabase, target.id);

  if (current && current.id !== target.id) {
    const currentAssignments = await scheduleAssignmentRepository.findByVersion(supabase, current.id);
    for (const assignment of currentAssignments) {
      await scheduleAssignmentRepository.setStatus(supabase, assignment.id, "archived", current.id);
    }
    await scheduleVersionRepository.setStatus(supabase, current.id, "superseded");
  }

  for (const assignment of targetAssignments) {
    await scheduleAssignmentRepository.setStatus(supabase, assignment.id, "committed", target.id);
  }

  await scheduleVersionRepository.setStatus(supabase, target.id, "active");

  await recordAuditEvent({
    supabase,
    academicContextId,
    action: "restore",
    entityType: "schedule_version",
    entityId: target.id,
    entityLabel: target.label,
    before: current,
    after: { version: target, restoredAssignments: targetAssignments.length },
    reason,
  });

  return { versionId: target.id, restoredAssignments: targetAssignments.length };
}
