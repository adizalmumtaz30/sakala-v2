// Domain layer — entity, value object, invariant. TIDAK BOLEH import Supabase atau React.
// Kontrak Bagian 3.1: Domain hanya berisi aturan bisnis murni.
// Bagian 8.2 / 77 — Active Academic Context: satu-satunya context aktif yang
// boleh menjadi dasar query/mutation akademik. Identifikasi SELALU via id,
// tidak pernah via text label ("2025/2026 Ganjil" hanya untuk tampilan).

export type Semester = "ganjil" | "genap";
export type Jenjang = "SD" | "MI" | "SMP" | "MTs" | "SMA" | "MA";
export type Institution = "Kemenag" | "Kemendikdasmen";

export const JENJANG_OPTIONS: Jenjang[] = ["SD", "MI", "SMP", "MTs", "SMA", "MA"];
export const INSTITUTION_OPTIONS: Institution[] = ["Kemenag", "Kemendikdasmen"];

export interface AcademicContext {
  id: string;
  tahunPelajaran: string; // format "YYYY/YYYY", mis. "2025/2026"
  semester: Semester;
  jenjang: Jenjang;
  institution: Institution;
  isActive: boolean;
}

export interface AcademicContextDraft {
  tahunPelajaran: string;
  semester: Semester;
  jenjang: Jenjang;
  institution: Institution;
}

export class AcademicContextValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "AcademicContextValidationError";
  }
}

const TAHUN_PELAJARAN_PATTERN = /^(\d{4})\/(\d{4})$/;

/**
 * Invariant Academic Context (Bagian 8.2): Tahun Pelajaran wajib format
 * "YYYY/YYYY" dengan tahun kedua = tahun pertama + 1. Semester wajib salah
 * satu dari ganjil/genap. Domain rule murni — tidak tahu soal Supabase.
 */
export function validateAcademicContextDraft(draft: AcademicContextDraft): void {
  const tahun = draft.tahunPelajaran.trim();
  const match = tahun.match(TAHUN_PELAJARAN_PATTERN);

  if (!match) {
    throw new AcademicContextValidationError(
      "tahunPelajaran",
      "Format tahun pelajaran wajib YYYY/YYYY, contoh 2025/2026."
    );
  }

  const first = Number(match[1]);
  const second = Number(match[2]);
  if (second !== first + 1) {
    throw new AcademicContextValidationError(
      "tahunPelajaran",
      "Tahun kedua harus tahun pertama + 1, contoh 2025/2026."
    );
  }

  if (draft.semester !== "ganjil" && draft.semester !== "genap") {
    throw new AcademicContextValidationError("semester", "Semester wajib ganjil atau genap.");
  }

  if (!JENJANG_OPTIONS.includes(draft.jenjang)) {
    throw new AcademicContextValidationError("jenjang", "Jenjang wajib dipilih dari daftar yang tersedia.");
  }

  if (!INSTITUTION_OPTIONS.includes(draft.institution)) {
    throw new AcademicContextValidationError("institution", "Kementerian/Badan wajib dipilih dari daftar yang tersedia.");
  }
}

/** Label tampilan konsisten untuk context — dipakai UI, tidak pernah dipakai sebagai identifier query. */
export function formatContextLabel(context: Pick<AcademicContext, "tahunPelajaran" | "semester">): string {
  const semesterLabel = context.semester === "ganjil" ? "Ganjil" : "Genap";
  return `${context.tahunPelajaran} · ${semesterLabel}`;
}

/** Label lengkap termasuk jenjang & institusi — dipakai di Generate Kurikulum,
 * yang sebelumnya menampilkan "SMP/MTs · Kemenag" hardcoded untuk semua context. */
export function formatFullContextLabel(context: Pick<AcademicContext, "tahunPelajaran" | "semester" | "jenjang" | "institution">): string {
  const semesterLabel = context.semester === "ganjil" ? "Ganjil" : "Genap";
  return `${context.jenjang} · ${context.institution} · ${context.tahunPelajaran} · ${semesterLabel}`;
}
