// Domain layer — Mata Pelajaran.
// Target JP is owned by target_jp (context + class + subject), not by Mata Pelajaran.

export type StatusAktif = "aktif" | "nonaktif";
export type PrioritasPenjadwalan = "tinggi" | "normal" | "rendah";
export type JenisMapel = "akademik" | "muatan_lokal" | "ekstrakurikuler" | "bimbingan_konseling";

export const PRIORITAS_OPTIONS: PrioritasPenjadwalan[] = ["tinggi", "normal", "rendah"];
export const JENIS_MAPEL_OPTIONS: JenisMapel[] = [
  "akademik",
  "muatan_lokal",
  "ekstrakurikuler",
  "bimbingan_konseling",
];

export const JENIS_MAPEL_LABEL: Record<JenisMapel, string> = {
  akademik: "Akademik",
  muatan_lokal: "Muatan Lokal",
  ekstrakurikuler: "Ekstrakurikuler",
  bimbingan_konseling: "Bimbingan Konseling",
};

export const PRIORITAS_LABEL: Record<PrioritasPenjadwalan, string> = {
  tinggi: "Tinggi",
  normal: "Normal",
  rendah: "Rendah",
};

export const WARNA_JADWAL_PRESET = [
  "#6366F1",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
];

export interface MataPelajaran {
  id: string;
  nama: string;
  kode: string | null;
  status: StatusAktif;
  kelompok?: string;
  warnaJadwal?: string;
  prioritasPenjadwalan?: PrioritasPenjadwalan;
  jenisMapel?: JenisMapel;
}

export interface MataPelajaranDraft {
  nama: string;
  kode: string;
  status: StatusAktif;
  kelompok?: string;
  warnaJadwal?: string;
  prioritasPenjadwalan?: PrioritasPenjadwalan;
  jenisMapel?: JenisMapel;
}

export class MataPelajaranValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "MataPelajaranValidationError";
  }
}

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function validateMataPelajaranDraft(draft: MataPelajaranDraft): void {
  const nama = draft.nama.trim();
  if (nama.length < 2) {
    throw new MataPelajaranValidationError("nama", "Nama mata pelajaran minimal 2 karakter.");
  }
  if (draft.warnaJadwal && !HEX_COLOR_PATTERN.test(draft.warnaJadwal)) {
    throw new MataPelajaranValidationError("warnaJadwal", "Warna jadwal harus format hex, mis. #6366F1.");
  }
  if (draft.prioritasPenjadwalan && !PRIORITAS_OPTIONS.includes(draft.prioritasPenjadwalan)) {
    throw new MataPelajaranValidationError("prioritasPenjadwalan", "Prioritas penjadwalan tidak valid.");
  }
  if (draft.jenisMapel && !JENIS_MAPEL_OPTIONS.includes(draft.jenisMapel)) {
    throw new MataPelajaranValidationError("jenisMapel", "Jenis mapel tidak valid.");
  }
}
