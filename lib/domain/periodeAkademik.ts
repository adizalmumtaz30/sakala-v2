// Domain layer — entity, value object, invariant. TIDAK BOLEH import Supabase atau React.
// Kontrak Bagian 3.1: Domain hanya berisi aturan bisnis murni.
// Bagian 19 / 83 — Periode Akademik: pembagian rentang tanggal di dalam SATU
// Academic Context (mis. "Periode 1", "UTS", "UAS"). Selalu terikat via
// academicContextId, tidak pernah via text label tahun pelajaran.

export type StatusAktif = "aktif" | "nonaktif";

export interface PeriodeAkademik {
  id: string;
  academicContextId: string;
  nama: string;
  tanggalMulai: string; // ISO date "YYYY-MM-DD"
  tanggalSelesai: string; // ISO date "YYYY-MM-DD"
  urutan: number;
  status: StatusAktif;
}

export interface PeriodeAkademikDraft {
  academicContextId: string;
  nama: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  urutan: number;
  status: StatusAktif;
}

export class PeriodeAkademikValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "PeriodeAkademikValidationError";
  }
}

/**
 * Invariant Periode Akademik (Bagian 19/83): nama wajib diisi min 2 karakter,
 * wajib terikat ke satu konteks akademik, tanggal selesai wajib >= tanggal
 * mulai. Domain rule murni — tidak tahu soal Supabase atau form.
 */
export function validatePeriodeAkademikDraft(draft: PeriodeAkademikDraft): void {
  const nama = draft.nama.trim();
  if (nama.length < 2) {
    throw new PeriodeAkademikValidationError("nama", "Nama periode wajib diisi, minimal 2 karakter.");
  }
  if (!draft.academicContextId) {
    throw new PeriodeAkademikValidationError("academicContextId", "Periode wajib terkait satu konteks akademik.");
  }
  if (!draft.tanggalMulai || !draft.tanggalSelesai) {
    throw new PeriodeAkademikValidationError("tanggalMulai", "Tanggal mulai dan tanggal selesai wajib diisi.");
  }
  if (draft.tanggalSelesai < draft.tanggalMulai) {
    throw new PeriodeAkademikValidationError("tanggalSelesai", "Tanggal selesai tidak boleh sebelum tanggal mulai.");
  }
}

/**
 * Cek tumpang tindih rentang tanggal antar periode dalam konteks yang sama.
 * Claude addition — spesifikasi (Bagian 19/83) tidak menyebutkan aturan ini
 * eksplisit, tapi periode yang tumpang tindih akan membingungkan Minggu dan
 * Jadwal nanti. Lihat PHASE REPORT Phase 04 untuk detail keputusan ini.
 */
export function periodsOverlap(
  a: Pick<PeriodeAkademikDraft, "tanggalMulai" | "tanggalSelesai">,
  b: Pick<PeriodeAkademikDraft, "tanggalMulai" | "tanggalSelesai">
): boolean {
  return a.tanggalMulai <= b.tanggalSelesai && b.tanggalMulai <= a.tanggalSelesai;
}
