// Application layer — use case / orchestration untuk Audit Log (Bagian 34).
// UI dan modul lain hanya boleh memanggil layer ini — tidak pernah
// memanggil repository langsung.

import type { SupabaseClient } from "@supabase/supabase-js";
import { auditLogRepository } from "@/lib/data-access/auditLog.repository";
import type { AuditAction, AuditLogEntry, AuditLogFilter, AuditSource } from "@/lib/domain/auditLog";

export interface RecordAuditEventInput {
  supabase: SupabaseClient;
  academicContextId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  before?: unknown | null;
  after?: unknown | null;
  source?: AuditSource;
  reason?: string | null;
}

/**
 * Dipanggil dari use case lain (mis. scheduleAssignment.usecases.ts) setelah
 * mutation berhasil. Mengambil identitas actor dari sesi Supabase Auth yang
 * sedang aktif (Bagian 34 — "Who").
 */
export async function recordAuditEvent(input: RecordAuditEventInput): Promise<void> {
  const {
    data: { user },
  } = await input.supabase.auth.getUser();

  await auditLogRepository.record(input.supabase, {
    academicContextId: input.academicContextId,
    actorId: user?.id ?? null,
    actorEmail: user?.email ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    before: input.before ?? null,
    after: input.after ?? null,
    source: input.source ?? "manual",
    reason: input.reason ?? null,
  });
}

export async function listAuditLog(
  supabase: SupabaseClient,
  filter: AuditLogFilter
): Promise<{ items: AuditLogEntry[]; total: number }> {
  return auditLogRepository.findMany(supabase, filter);
}
