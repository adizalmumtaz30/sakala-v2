// Domain layer — entity, value object, invariant. TIDAK BOLEH import Supabase atau React.
// Bagian 21.3 — Schedule Version: wadah untuk assignment berstatus committed.
// "CANDIDATE tidak boleh mengubah COMMITTED SCHEDULE sebelum explicit
// commit" (Bagian 68/Aturan Absolut) — versi baru dibuat lewat commit
// eksplisit, bukan mutasi diam-diam terhadap versi yang sudah ada.

export type ScheduleVersionStatus = "active" | "superseded" | "archived";

export interface ScheduleVersion {
  id: string;
  academicContextId: string;
  label: string;
  createdBy: string | null;
  createdAt: string;
  source: string;
  status: ScheduleVersionStatus;
  changeSummary: string | null;
}

export interface ScheduleVersionDraft {
  academicContextId: string;
  label: string;
  createdBy: string | null;
  source: string;
  changeSummary: string | null;
}

export class ScheduleVersionValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "ScheduleVersionValidationError";
  }
}

export function validateScheduleVersionDraft(draft: ScheduleVersionDraft): void {
  if (!draft.academicContextId) {
    throw new ScheduleVersionValidationError("academicContextId", "Schedule Version wajib terkait satu konteks akademik.");
  }
  const label = draft.label.trim();
  if (label.length < 2) {
    throw new ScheduleVersionValidationError("label", "Label version wajib diisi, minimal 2 karakter.");
  }
}
