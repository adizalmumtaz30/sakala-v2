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

const ROMAN_TINGKAT: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12,
};

/**
 * Urutan jenjang naik (7, 8, 9, ...) tidak bisa diandalkan dari sort string biasa —
 * data tingkat di lapangan ada yang ditulis angka ("7") ada yang angka Romawi ("VII"),
 * dan alfabet-sort keduanya tidak menghasilkan urutan jenjang yang benar. Fungsi ini
 * menormalkan kedua format ke angka supaya bisa dibandingkan; format lain (tidak
 * dikenali) taruh di akhir tapi tetap tersusun stabil berdasarkan teks aslinya.
 */
export function tingkatSortValue(tingkat: string): number {
  const trimmed = tingkat.trim();
  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber) && trimmed !== "") return asNumber;
  const roman = ROMAN_TINGKAT[trimmed.toUpperCase()];
  if (roman !== undefined) return roman;
  return Number.POSITIVE_INFINITY;
}

/** Kelas terurut jenjang naik (7, 8, 9, ...), lalu nama rombel A-Z pada jenjang yang sama. */
export function sortKelasByTingkat(kelasList: Kelas[]): Kelas[] {
  return [...kelasList].sort((a, b) => {
    const diff = tingkatSortValue(a.tingkat) - tingkatSortValue(b.tingkat);
    if (diff !== 0) return diff;
    return a.namaRombel.localeCompare(b.namaRombel, "id");
  });
}
