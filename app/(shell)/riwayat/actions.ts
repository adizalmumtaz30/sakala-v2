"use server";

import { createClient } from "@/lib/supabase/server";
import { listAuditLog } from "@/lib/application/auditLog.usecases";
import { restoreScheduleVersion } from "@/lib/application/scheduleVersion.usecases";
import { toPlainErrorMessage } from "@/lib/utils/databaseError";
import type { AuditAction, AuditLogEntry } from "@/lib/domain/auditLog";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function loadAuditLogAction(
  academicContextId: string | null,
  action: AuditAction | null,
  offset: number,
  limit: number
): Promise<ActionResult<{ items: AuditLogEntry[]; total: number }>> {
  try {
    const supabase = await createClient();
    const result = await listAuditLog(supabase, {
      academicContextId: academicContextId ?? undefined,
      action: action ?? undefined,
      offset,
      limit,
    });
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: toPlainErrorMessage(err, "Terjadi kesalahan yang tidak diketahui.") };
  }
}

export async function restoreScheduleVersionAction(
  academicContextId: string | null,
  versionId: string
): Promise<ActionResult<{ versionId: string; restoredAssignments: number }>> {
  try {
    if (!academicContextId) return { ok: false, error: "Academic Context aktif tidak tersedia." };
    const supabase = await createClient();
    const result = await restoreScheduleVersion(supabase, academicContextId, versionId);
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: toPlainErrorMessage(err, "Gagal memulihkan versi jadwal.") };
  }
}
