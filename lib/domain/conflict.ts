// Domain layer — entity, value object, invariant. TIDAK BOLEH import Supabase atau React.
// Bagian 23 / 86 — Conflict Engine: struktur hasil validasi jadwal. Engine
// (Application layer, lihat lib/application/conflictEngine.ts) menghasilkan
// array ScheduleConflict dari satu kandidat assignment terhadap assignment
// lain + Slot Template + status aktif entity terkait. Domain layer di sini
// HANYA mendefinisikan bentuk data & severity — logika deteksi ada di
// Application layer karena butuh data lintas-entity (bukan invariant satu
// entity saja).

import type { JpSummaryStatus } from "@/lib/domain/pembagianMengajar";

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
 * terkonfigurasi (Pembagian Mengajar, Bagian 35-36/72-75, `jpPerMinggu`) vs
 * jadwal yang sudah committed. Disambungkan ke Conflict Engine lewat blok
 * JP_MISMATCH di lib/application/conflictEngine.ts (Pack 09e) — engine
 * membaca target dari `pembagianMengajarRepository.findActiveByCombination()`
 * lalu memetakan hasil `summarizeJp()` ke state ini lewat
 * `toJpReconciliationState()` di bawah.
 */
export type JpReconciliationState = "complete" | "incomplete" | "over";

/**
 * Konversi status Indonesia dari `summarizeJp()` (Pembagian Mengajar) ke
 * `JpReconciliationState` (bahasa spesifikasi Bagian 22.5). "kosong" dan
 * "sebagian" sama-sama "incomplete" — seberapa jauh dari target sudah
 * tercermin di angka `jpTersisa` pada pesan conflict, bukan di state ini.
 */
export function toJpReconciliationState(status: JpSummaryStatus): JpReconciliationState {
  switch (status) {
    case "penuh":
      return "complete";
    case "lebih":
      return "over";
    default:
      return "incomplete";
  }
}

let counter = 0;
/** ID conflict sementara (in-memory, bukan PK database) — cukup unik per proses validasi satu kali panggil. */
export function nextConflictId(): string {
  counter += 1;
  return `conflict_${Date.now()}_${counter}`;
}

export function isBlockingSeverity(severity: ConflictSeverity): boolean {
  return severity === "error";
}
