// Domain layer — Mata Pelajaran (Bagian 17.2 / Bagian 29-34 / Bagian 82).
//
// Pack 09b (lanjutan): field diperkaya (Kelompok, Warna Jadwal, Prioritas
// Penjadwalan, Jenis Mapel) sesuai Bagian 30-32. TIDAK ADA konsep linearitas —
// Jenis Mapel di sini murni klasifikasi domain (Bagian 31), bukan Linear/Non-Linear.
// targetJpPerRombel TIDAK diganti nama/dihapus karena sudah dipakai candidateGeneration.

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

/** Palet warna jadwal preset (Bagian 30) — dipilih lewat swatch, bukan color picker bebas. */
export const WARNA_JADWAL_PRESET = [
  "#6366F1", // indigo
  "#0EA5E9", // sky
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // rose/red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
];

export interface MataPelajaran {
  id: string;
  nama: string;
  kode: string | null;
  status: StatusAktif;
  targetJpPerRombel: number | null;
  kelompok?: string;
  warnaJadwal?: string;
  prioritasPenjadwalan?: PrioritasPenjadwalan;
  jenisMapel?: JenisMapel;
}

export interface MataPelajaranDraft {
  nama: string;
  kode: string;
  status: StatusAktif;
  targetJpPerRombel: number | null;
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

/**
 * Invariant Mata Pelajaran (Bagian 32): hanya Nama yang wajib. Field baru
 * (Kelompok, Warna, Prioritas, Jenis) semuanya optional — kosong selalu valid,
 * hanya divalidasi formatnya JIKA diisi (pola sama dengan Guru, Bagian 98).
 */
export function validateMataPelajaranDraft(draft: MataPelajaranDraft): void {
  const nama = draft.nama.trim();
  if (nama.length < 2) {
    throw new MataPelajaranValidationError("nama", "Nama mata pelajaran minimal 2 karakter.");
  }
  if (draft.targetJpPerRombel != null && draft.targetJpPerRombel < 0) {
    throw new MataPelajaranValidationError("targetJpPerRombel", "Target JP tidak boleh negatif.");
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
