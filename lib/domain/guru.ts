// Domain layer — entity, value object, invariant. TIDAK BOLEH import Supabase atau React.
// Kontrak Bagian 3.1: Domain hanya berisi aturan bisnis murni.

export type StatusAktif = "aktif" | "nonaktif";

export interface Guru {
  id: string;
  namaGuru: string;
  status: StatusAktif;
  // Computed (Bagian 17.1) — dihitung di Application layer, bukan disimpan mentah di sini
  jumlahJadwal?: number;
  totalJamMengajar?: number;
  bebanJadwal?: "ringan" | "normal" | "berat";
}

export interface GuruDraft {
  namaGuru: string;
  status: StatusAktif;
}

export class GuruValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "GuruValidationError";
  }
}

/**
 * Invariant Guru (Bagian 17.1): Nama Guru wajib diisi, minimal 3 karakter.
 * Domain rule murni — tidak tahu soal Supabase atau form.
 */
export function validateGuruDraft(draft: GuruDraft): void {
  const nama = draft.namaGuru.trim();
  if (nama.length === 0) {
    throw new GuruValidationError("namaGuru", "Nama guru wajib diisi.");
  }
  if (nama.length < 3) {
    throw new GuruValidationError("namaGuru", "Nama guru minimal 3 karakter.");
  }
}

/**
 * Klasifikasi beban jadwal (dipakai juga oleh Dashboard nanti — Bagian 17.1 & 31).
 * Ringan ≤ 20 JP, Normal 21–32 JP, Berat ≥ 33 JP.
 */
export function classifyBeban(totalJamMengajar: number): "ringan" | "normal" | "berat" {
  if (totalJamMengajar <= 20) return "ringan";
  if (totalJamMengajar <= 32) return "normal";
  return "berat";
}
