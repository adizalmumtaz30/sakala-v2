// Domain layer — Audit Log (Bagian 34 History/Audit).

export type AuditAction =
  | "create"
  | "edit"
  | "move"
  | "delete"
  | "generate"
  | "optimize"
  | "validate"
  | "commit"
  | "import"
  | "restore";

export type AuditSource = "manual" | "import" | "ai" | "system";

export interface AuditLogEntry {
  id: string;
  academicContextId: string | null;
  actorId: string | null;
  actorEmail: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  before: unknown | null;
  after: unknown | null;
  source: AuditSource;
  reason: string | null;
  createdAt: string;
}

export interface AuditLogDraft {
  academicContextId: string | null;
  actorId: string | null;
  actorEmail: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  before?: unknown | null;
  after?: unknown | null;
  source?: AuditSource;
  reason?: string | null;
}

export interface AuditLogFilter {
  academicContextId?: string;
  entityType?: string;
  action?: AuditAction;
  limit?: number;
  offset?: number;
}

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  create: "Dibuat",
  edit: "Diubah",
  move: "Dipindahkan",
  delete: "Dihapus",
  generate: "Digenerate",
  optimize: "Dioptimasi",
  validate: "Divalidasi",
  commit: "Di-commit",
  import: "Diimpor",
  restore: "Dipulihkan",
};

export const AUDIT_ENTITY_LABEL: Record<string, string> = {
  schedule_assignment: "Jadwal",
  schedule_version: "Versi Jadwal",
};
