// Domain layer — Pembagian Mengajar (Bagian 35-36 / 72-75).
// Layer penghubung Guru + Mata Pelajaran + Kelas + JP, terikat satu Academic
// Context. Entity ini TIDAK menyimpan tahunAjaran/semester sebagai teks —
// selalu lewat academicContextId (Bagian 8.2/77), konsisten dengan
// scheduleModel/scheduleAssignment.
//
// Bagian 73: ringkasan pemakaian JP (jpTerjadwal/jpTersisa) dihitung di
// Application layer dari data schedule_assignment — TIDAK disimpan mentah di
// sini (sama prinsip dengan Guru.totalJamMengajar).

export type StatusAktif = "aktif" | "nonaktif";

export interface PembagianMengajar {
  id: string;
  academicContextId: string;
  guruId: string;
  mataPelajaranId: string;
  kelasId: string;
  jpPerMinggu: number;
  status: StatusAktif;
  // Denormalized display fields (Bagian 73 contoh UI) — diisi Data Access
  // layer lewat join, BUKAN field yang bisa ditulis lewat Draft.
  guruNama?: string;
  guruKode?: string;
  mataPelajaranNama?: string;
  mataPelajaranKode?: string;
  mataPelajaranWarna?: string;
  kelasLabel?: string;
  // Computed di Application layer (Bagian 73) — butuh data schedule_assignment.
  jpTerjadwal?: number;
  jpTersisa?: number;
}

export interface PembagianMengajarDraft {
  academicContextId: string;
  guruId: string;
  mataPelajaranId: string;
  kelasId: string;
  jpPerMinggu: number;
  status: StatusAktif;
}

export class PembagianMengajarValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "PembagianMengajarValidationError";
  }
}

/**
 * Invariant struktural (Bagian 35-36): keempat relasi wajib dipilih, JP wajib
 * bilangan bulat positif. Pengecekan duplikat kombinasi Guru+Mapel+Kelas per
 * konteks TIDAK di sini — itu tanggung jawab unique constraint database +
 * pesan forensic di Application layer (Bagian 28), karena butuh query lintas
 * baris yang tidak boleh dilakukan Domain layer.
 */
export function validatePembagianMengajarDraft(draft: PembagianMengajarDraft): void {
  if (!draft.academicContextId) {
    throw new PembagianMengajarValidationError(
      "academicContextId",
      "Pembagian mengajar wajib terkait satu konteks akademik aktif."
    );
  }
  if (!draft.guruId) {
    throw new PembagianMengajarValidationError("guruId", "Guru wajib dipilih.");
  }
  if (!draft.mataPelajaranId) {
    throw new PembagianMengajarValidationError("mataPelajaranId", "Mata pelajaran wajib dipilih.");
  }
  if (!draft.kelasId) {
    throw new PembagianMengajarValidationError("kelasId", "Kelas wajib dipilih.");
  }
  if (!Number.isInteger(draft.jpPerMinggu) || draft.jpPerMinggu <= 0) {
    throw new PembagianMengajarValidationError("jpPerMinggu", "JP per minggu wajib bilangan bulat lebih dari 0.");
  }
}

/** Status ringkas pemakaian JP satu kombinasi — diekspor supaya Conflict
 * Engine (Bagian 22.5, lib/domain/conflict.ts) bisa memetakan ke
 * JpReconciliationState tanpa duplikasi daftar nilai. */
export type JpSummaryStatus = "kosong" | "sebagian" | "penuh" | "lebih";

/** Bagian 73: label ringkas "2 JP sudah dijadwalkan, 2 JP tersisa". */
export function summarizeJp(jpPerMinggu: number, jpTerjadwal: number): { jpTersisa: number; status: JpSummaryStatus } {
  const jpTersisa = jpPerMinggu - jpTerjadwal;
  if (jpTerjadwal <= 0) return { jpTersisa: jpPerMinggu, status: "kosong" };
  if (jpTersisa > 0) return { jpTersisa, status: "sebagian" };
  if (jpTersisa === 0) return { jpTersisa: 0, status: "penuh" };
  return { jpTersisa, status: "lebih" };
}
