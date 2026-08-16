// Data Access layer — repository. Satu-satunya tempat yang boleh menulis
// query Supabase untuk entity Audit Log. Append-only dari sisi aplikasi:
// tidak ada update()/remove() disengaja.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditAction, AuditLogDraft, AuditLogEntry, AuditLogFilter, AuditSource } from "@/lib/domain/auditLog";

type Row = {
  id: string;
  academic_context_id: string | null;
  actor_id: string | null;
  actor_email: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  before: unknown | null;
  after: unknown | null;
  source: AuditSource;
  reason: string | null;
  created_at: string;
};

const SELECT_COLUMNS =
  "id, academic_context_id, actor_id, actor_email, action, entity_type, entity_id, entity_label, before, after, source, reason, created_at";

function rowToEntity(row: Row): AuditLogEntry {
  return {
    id: row.id,
    academicContextId: row.academic_context_id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    before: row.before,
    after: row.after,
    source: row.source,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export const auditLogRepository = {
  async record(supabase: SupabaseClient, draft: AuditLogDraft): Promise<void> {
    const { error } = await supabase.from("audit_log").insert({
      academic_context_id: draft.academicContextId,
      actor_id: draft.actorId,
      actor_email: draft.actorEmail,
      action: draft.action,
      entity_type: draft.entityType,
      entity_id: draft.entityId,
      entity_label: draft.entityLabel,
      before: draft.before ?? null,
      after: draft.after ?? null,
      source: draft.source ?? "manual",
      reason: draft.reason ?? null,
    });
    // Audit log tidak boleh menggagalkan mutation utama (Bagian 21 —
    // presentation/application tidak boleh silent-fail, tapi audit trail
    // sendiri bersifat best-effort supaya tidak jadi single point of
    // failure untuk operasional jadwal). Dicatat ke console saja.
    if (error) {
      console.error("[audit_log] gagal mencatat entry:", error.message);
    }
  },

  async findMany(supabase: SupabaseClient, filter: AuditLogFilter): Promise<{ items: AuditLogEntry[]; total: number }> {
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    let query = supabase.from("audit_log").select(SELECT_COLUMNS, { count: "exact" });

    if (filter.academicContextId) {
      query = query.eq("academic_context_id", filter.academicContextId);
    }
    if (filter.entityType) {
      query = query.eq("entity_type", filter.entityType);
    }
    if (filter.action) {
      query = query.eq("action", filter.action);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { items: (data as Row[]).map(rowToEntity), total: count ?? 0 };
  },
};
