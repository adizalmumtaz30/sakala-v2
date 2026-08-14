// Domain layer — entity, value object, invariant. TIDAK BOLEH import Supabase atau React.
// Bagian 21 / 85 — Schedule Domain Model: satu baris "penempatan" pengajaran
// (atau aktivitas tetap) pada satu (hari, rentang periode) untuk satu kelas,
// di dalam satu Schedule Model. Ini BUKAN Jadwal Cerdas (generator, step 14)
// ataupun Jadwal Operational Workspace (UI, step 15) — keduanya akan
// memanggil layer ini. Step 13 hanya menyediakan entity + invariant
// struktural + Conflict Engine (lib/application/conflictEngine.ts).

import type { HariSekolah } from "@/lib/domain/jamPelajaran";
import type { JenisSlot } from "@/lib/domain/slotTemplate";

/** Bagian 21.1 */
export type ScheduleSource = "manual" | "generated" | "imported" | "ai_assisted";

/** Bagian 21.2 */
export type ScheduleStatus = "draft" | "candidate" | "committed" | "archived" | "cancelled";

export interface ScheduleAssignment {
  id: string;
  academicContextId: string;
  /** Claude addition — spesifikasi Bagian 21/85 tidak mendaftar scheduleModelId
   * secara eksplisit, tapi setiap assignment butuh tahu Schedule Model mana
   * yang mengatur konfigurasinya (room mode, hari aktif) supaya Conflict
   * Engine bisa menegakkan Bagian 22.3/22.4 — flag untuk direview. */
  scheduleModelId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  roomId: string | null;
  day: HariSekolah;
  /** Nomor urut Jam Pelajaran (Phase 04) — inklusif, boleh sama untuk 1 periode. */
  periodStart: number;
  periodEnd: number;
  /** Reuse JenisSlot (Bagian 20.2) — assignment biasa = "belajar_mengajar";
   * nilai lain merepresentasikan aktivitas tetap yang sengaja dijadwalkan eksplisit. */
  activityType: JenisSlot;
  status: ScheduleStatus;
  source: ScheduleSource;
  versionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleAssignmentDraft {
  academicContextId: string;
  scheduleModelId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  roomId: string | null;
  day: HariSekolah;
  periodStart: number;
  periodEnd: number;
  activityType: JenisSlot;
  status: ScheduleStatus;
  source: ScheduleSource;
  versionId: string | null;
}

export class ScheduleAssignmentValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "ScheduleAssignmentValidationError";
  }
}

const STATUS_VALID: ScheduleStatus[] = ["draft", "candidate", "committed", "archived", "cancelled"];
const SOURCE_VALID: ScheduleSource[] = ["manual", "generated", "imported", "ai_assisted"];

/**
 * Invariant STRUKTURAL (Bagian 21) — field wajib ada & bentuk dasarnya valid.
 * Ini TIDAK mencakup pengecekan lintas-entity (overlap, fixed slot, status
 * aktif, JP reconciliation) — itu tanggung jawab Conflict Engine
 * (Application layer, Bagian 23/86) karena butuh data entity lain.
 * validateScheduleAssignmentDraft dipanggil pertama, sebelum Conflict Engine.
 */
export function validateScheduleAssignmentDraft(draft: ScheduleAssignmentDraft): void {
  if (!draft.academicContextId) {
    throw new ScheduleAssignmentValidationError("academicContextId", "Assignment wajib terkait satu konteks akademik.");
  }
  if (!draft.scheduleModelId) {
    throw new ScheduleAssignmentValidationError("scheduleModelId", "Assignment wajib terkait satu Schedule Model.");
  }
  if (!draft.classId) {
    throw new ScheduleAssignmentValidationError("classId", "Kelas wajib dipilih.");
  }
  if (!draft.subjectId) {
    throw new ScheduleAssignmentValidationError("subjectId", "Mata pelajaran wajib dipilih.");
  }
  if (!draft.teacherId) {
    throw new ScheduleAssignmentValidationError("teacherId", "Guru wajib dipilih.");
  }
  if (!Number.isInteger(draft.periodStart) || draft.periodStart < 1) {
    throw new ScheduleAssignmentValidationError("periodStart", "Periode mulai wajib bilangan bulat mulai dari 1.");
  }
  if (!Number.isInteger(draft.periodEnd) || draft.periodEnd < draft.periodStart) {
    throw new ScheduleAssignmentValidationError("periodEnd", "Periode selesai wajib >= periode mulai.");
  }
  if (!STATUS_VALID.includes(draft.status)) {
    throw new ScheduleAssignmentValidationError("status", "Status tidak dikenal.");
  }
  if (!SOURCE_VALID.includes(draft.source)) {
    throw new ScheduleAssignmentValidationError("source", "Source tidak dikenal.");
  }
  // Bagian 21.3 — "Committed schedule must belong to a schedule version."
  if (draft.status === "committed" && !draft.versionId) {
    throw new ScheduleAssignmentValidationError("versionId", "Schedule berstatus committed wajib terkait satu Schedule Version.");
  }
}

export function formatScheduleStatus(status: ScheduleStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "candidate":
      return "Candidate";
    case "committed":
      return "Committed";
    case "archived":
      return "Archived";
    case "cancelled":
      return "Cancelled";
  }
}

export function formatScheduleSource(source: ScheduleSource): string {
  switch (source) {
    case "manual":
      return "Manual";
    case "generated":
      return "Generated";
    case "imported":
      return "Imported";
    case "ai_assisted":
      return "AI Assisted";
  }
}

/** Dua rentang periode pada hari yang sama tumpang tindih kalau salah satu mulai <= akhir yang lain. */
export function periodsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
