// Domain layer — entity, value object, invariant. TIDAK BOLEH import Supabase atau React.
// Bagian 24 / 87 — Jadwal Cerdas: "Load Constraints" untuk generator butuh
// tahu berapa JP yang harus ditempatkan per kombinasi kelas+mapel+guru.
// Target JP resmi (Bagian 89) BELUM punya sumber data view di baseline ini
// (menyusul step 21/29 — Target JP View) — sesuai keputusan eksplisit user,
// jpTarget diisi MANUAL oleh user per run generate (boleh di-pre-fill UI
// dari targetJpPerRombel Mata Pelajaran kalau tersedia, tapi domain ini
// tidak tahu soal itu — murni menerima angka yang sudah diputuskan user).

import type { HariSekolah } from "@/lib/domain/jamPelajaran";
import type { JenisSlot } from "@/lib/domain/slotTemplate";

/** Satu baris "constraint" — satu kombinasi kelas+mapel+guru yang perlu ditempatkan. */
export interface GenerationRequirement {
  id: string; // temp client-side id (bukan PK database) — dipakai UI mencocokkan hasil generate.
  classId: string;
  subjectId: string;
  teacherId: string;
  roomId: string | null;
  activityType: JenisSlot;
  jpTarget: number;
}

export class GenerationRequirementValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "GenerationRequirementValidationError";
  }
}

/**
 * Invariant Generation Requirement: kelas, mapel, guru wajib dipilih; target
 * JP wajib bilangan bulat 1–40 (batas wajar per minggu, mencegah input keliru
 * seperti 0 atau ribuan).
 */
export function validateGenerationRequirement(req: GenerationRequirement): void {
  if (!req.classId) {
    throw new GenerationRequirementValidationError("classId", "Kelas wajib dipilih.");
  }
  if (!req.subjectId) {
    throw new GenerationRequirementValidationError("subjectId", "Mata pelajaran wajib dipilih.");
  }
  if (!req.teacherId) {
    throw new GenerationRequirementValidationError("teacherId", "Guru wajib dipilih.");
  }
  if (!Number.isInteger(req.jpTarget) || req.jpTarget < 1 || req.jpTarget > 40) {
    throw new GenerationRequirementValidationError("jpTarget", "Target JP wajib bilangan bulat 1–40.");
  }
}

export interface GeneratedSlotPlacement {
  day: HariSekolah;
  periodStart: number;
  periodEnd: number;
}

/** Ringkasan hasil generate untuk satu requirement — dipakai UI Candidate Review (Bagian 24.2). */
export interface RequirementGenerationOutcome {
  requirementId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  jpTarget: number;
  placed: number;
  unplaced: number;
  placements: GeneratedSlotPlacement[];
}
