// Domain layer — entity, value object, invariant. TIDAK BOLEH import Supabase atau React.
// Bagian 23 / 86 — Conflict Engine: struktur hasil validasi jadwal. Engine
// (Application layer, lihat lib/application/conflictEngine.ts) menghasilkan
// array ScheduleConflict dari satu kandidat assignment terhadap assignment
// lain + Slot Template + status aktif entity terkait. Domain layer di sini
// HANYA mendefinisikan bentuk data & severity — logika deteksi ada di
// Application layer karena butuh data lintas-entity (bukan invariant satu
// entity saja).

export type ConflictSeverity = "error" | "warning" | "info";

/** Bagian 23.2 / 86 — minimum conflict type, tidak boleh dikurangi. */
export type ConflictType =
  | "TEACHER_OVERLAP"
  | "CLASS_OVERLAP"
  | "ROOM_OVERLAP"
  | "FIXED_SLOT"
  | "INVALID_PERIOD"
  | "INACTIVE_ENTITY"
  | "JP_MISMATCH"
  | "MISSING_REQUIRED_FIELD"
  | "CONTEXT_MISMATCH";

export type ConflictEntityType = "teacher" | "class" | "room" | "subject" | "schedule" | "slot";

export interface ScheduleConflict {
  conflictId: string;
  severity: ConflictSeverity;
  type: ConflictType;
  entityType: ConflictEntityType;
  entityIds: string[];
  scheduleIds: string[];
  message: string;
  resolutionHint: string;
  /** Bagian 22 — "BLOCKING CONFLICT wajib mencegah commit." Hanya conflict
   * severity "error" yang blocking=true (Bagian 23.1: Error = blocks commit). */
  blocking: boolean;
}

/**
 * Bagian 22.5 — JP reconciliation state antara target jam pelajaran
 * terkonfigurasi vs jadwal yang sudah committed. Target belum punya sumber
 * data resmi di baseline ini (menyusul di step 21/29 — Target JP View),
 * jadi engine hanya bisa menghasilkan state ini kalau target eksplisit
 * disediakan pemanggil — flag untuk direview saat step tersebut dibangun.
 */
export type JpReconciliationState = "complete" | "incomplete" | "over";

let counter = 0;
/** ID conflict sementara (in-memory, bukan PK database) — cukup unik per proses validasi satu kali panggil. */
export function nextConflictId(): string {
  counter += 1;
  return `conflict_${Date.now()}_${counter}`;
}

export function isBlockingSeverity(severity: ConflictSeverity): boolean {
  return severity === "error";
}
