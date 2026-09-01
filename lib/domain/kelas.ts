// Domain layer — Kelas.
// Academic year/semester are owned by Academic Context, not duplicated on Kelas.

export type StatusAktif = "aktif" | "nonaktif";

export interface Kelas {
  id: string;
  academicContextId: string;
  tingkat: string;
  namaRombel: string;
  status: StatusAktif;
  // Derived display values resolved from academic_context by the repository.
  // They are not persisted on kelas and are not writable by this domain.
  tahunAjaran: string;
  semester: "ganjil" | "genap";
}

export interface KelasDraft {
  tingkat: string;
  namaRombel: string;
  status: StatusAktif;
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
}

const ROMAN_TINGKAT: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12,
};

export function tingkatSortValue(tingkat: string): number {
  const trimmed = tingkat.trim();
  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber) && trimmed !== "") return asNumber;
  const roman = ROMAN_TINGKAT[trimmed.toUpperCase()];
  if (roman !== undefined) return roman;
  return Number.POSITIVE_INFINITY;
}

export function sortKelasByTingkat(kelasList: Kelas[]): Kelas[] {
  return [...kelasList].sort((a, b) => {
    const diff = tingkatSortValue(a.tingkat) - tingkatSortValue(b.tingkat);
    if (diff !== 0) return diff;
    return a.namaRombel.localeCompare(b.namaRombel, "id");
  });
}
