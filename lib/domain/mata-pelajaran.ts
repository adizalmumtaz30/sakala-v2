// Domain layer — Mata Pelajaran (Bagian 17.2 / Bagian 82).

export type StatusAktif = "aktif" | "nonaktif";

export interface MataPelajaran {
  id: string;
  nama: string;
  kode: string | null;
  status: StatusAktif;
  targetJpPerRombel: number | null;
}

export interface MataPelajaranDraft {
  nama: string;
  kode: string;
  status: StatusAktif;
  targetJpPerRombel: number | null;
}

export class MataPelajaranValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "MataPelajaranValidationError";
  }
}

export function validateMataPelajaranDraft(draft: MataPelajaranDraft): void {
  const nama = draft.nama.trim();
  if (nama.length < 2) {
    throw new MataPelajaranValidationError("nama", "Nama mata pelajaran minimal 2 karakter.");
  }
  if (draft.targetJpPerRombel != null && draft.targetJpPerRombel < 0) {
    throw new MataPelajaranValidationError("targetJpPerRombel", "Target JP tidak boleh negatif.");
  }
}
