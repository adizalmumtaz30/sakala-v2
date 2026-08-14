// Domain layer — entity, value object, invariant. TIDAK BOLEH import Supabase atau React.
// Kontrak Bagian 3.1: Domain hanya berisi aturan bisnis murni.
//
// Pack 09 — SAKALA V2.3 Bagian 09-16, 83-87: Form Guru disederhanakan.
// Wajib: hanya Nama Lengkap. Semua field administratif lain bersifat optional
// dan tidak boleh memblokir pembuatan Guru (Bagian 11 & 98).

export type StatusAktif = "aktif" | "nonaktif";

export interface Guru {
  id: string;
  namaGuru: string;
  kodeGuru: string;
  status: StatusAktif;
  // Informasi Tambahan (Bagian 11) — semua optional
  nip?: string;
  nuptk?: string;
  email?: string;
  noTelepon?: string;
  // Computed (Bagian 17.1) — dihitung di Application layer, bukan disimpan mentah di sini
  jumlahJadwal?: number;
  totalJamMengajar?: number;
  bebanJadwal?: "ringan" | "normal" | "berat";
}

export interface GuruDraft {
  namaGuru: string;
  status: StatusAktif;
  nip?: string;
  nuptk?: string;
  email?: string;
  noTelepon?: string;
}

export class GuruValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "GuruValidationError";
  }
}

/**
 * Invariant Guru (Bagian 10, 17.1, 83): hanya Nama Guru yang wajib, minimal 3 karakter.
 * Kode Guru dihasilkan otomatis oleh database (lihat migration 0006), bukan oleh domain ini.
 * Field opsional (NIP/NUPTK/Email/Telepon) hanya divalidasi formatnya JIKA diisi —
 * kosong selalu valid (Bagian 22 & 98: optional field tidak boleh memblokir save).
 */
export function validateGuruDraft(draft: GuruDraft): void {
  const nama = draft.namaGuru.trim();
  if (nama.length === 0) {
    throw new GuruValidationError("namaGuru", "Nama guru wajib diisi.");
  }
  if (nama.length < 3) {
    throw new GuruValidationError("namaGuru", "Nama guru minimal 3 karakter.");
  }

  if (draft.email && draft.email.trim().length > 0) {
    const email = draft.email.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      throw new GuruValidationError("email", "Format email tidak valid.");
    }
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
