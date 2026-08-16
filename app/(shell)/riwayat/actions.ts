"use server";

import { createClient } from "@/lib/supabase/server";
import { listAuditLog } from "@/lib/application/auditLog.usecases";
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
    return { ok: false, error: err instanceof Error ? err.message : "Terjadi kesalahan yang tidak diketahui." };
  }
}
