// Domain layer — Kelas (Bagian 17.3 / Bagian 82).

export type StatusAktif = "aktif" | "nonaktif";
export type Semester = "ganjil" | "genap";

export interface Kelas {
  id: string;
  tingkat: string;
  namaRombel: string;
  status: StatusAktif;
  tahunAjaran: string;
  semester: Semester;
}

export interface KelasDraft {
  tingkat: string;
  namaRombel: string;
  status: StatusAktif;
  tahunAjaran: string;
  semester: Semester;
}

export class KelasValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "KelasValidationError";
  }
}

export function validateKelasDraft(draft: KelasDraft): void {
  if (draft.tingkat.trim().length === 0) {
    throw new KelasValidationError("tingkat", "Tingkat wajib diisi.");
  }
  if (draft.namaRombel.trim().length === 0) {
    throw new KelasValidationError("namaRombel", "Nama rombel wajib diisi.");
  }
  if (draft.tahunAjaran.trim().length === 0) {
    throw new KelasValidationError("tahunAjaran", "Tahun ajaran wajib diisi.");
  }
}
