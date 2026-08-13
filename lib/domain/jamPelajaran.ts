// Domain layer — entity, value object, invariant. TIDAK BOLEH import Supabase atau React.
// Bagian 19.1 / 83 — Time model Jam Pelajaran: periodNumber, startTime,
// endTime, durationMinutes, day, status. "Break is not a teaching period" —
// dibedakan lewat field `jenis`. "School days are configurable" — satu baris
// mewakili satu slot pada satu hari tertentu (bukan template global), supaya
// durasi/jumlah jam boleh berbeda per hari (mis. Jumat lebih pendek).

export type HariSekolah = "senin" | "selasa" | "rabu" | "kamis" | "jumat" | "sabtu" | "minggu";
export type JenisJamPelajaran = "pembelajaran" | "istirahat";
export type StatusAktif = "aktif" | "nonaktif";

export const URUTAN_HARI: HariSekolah[] = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu"];

export interface JamPelajaran {
  id: string;
  academicContextId: string;
  hari: HariSekolah;
  nomorUrut: number;
  nama: string;
  jenis: JenisJamPelajaran;
  waktuMulai: string; // "HH:MM"
  waktuSelesai: string; // "HH:MM"
  status: StatusAktif;
}

export interface JamPelajaranDraft {
  academicContextId: string;
  hari: HariSekolah;
  nomorUrut: number;
  nama: string;
  jenis: JenisJamPelajaran;
  waktuMulai: string;
  waktuSelesai: string;
  status: StatusAktif;
}

export class JamPelajaranValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "JamPelajaranValidationError";
  }
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Invariant Jam Pelajaran (Bagian 19.1): nama wajib diisi min 2 karakter,
 * wajib terikat ke satu konteks akademik, nomor urut bilangan bulat >= 1,
 * waktu format HH:MM valid, waktu selesai wajib setelah waktu mulai.
 */
export function validateJamPelajaranDraft(draft: JamPelajaranDraft): void {
  const nama = draft.nama.trim();
  if (nama.length < 2) {
    throw new JamPelajaranValidationError("nama", "Nama jam pelajaran wajib diisi, minimal 2 karakter.");
  }
  if (!draft.academicContextId) {
    throw new JamPelajaranValidationError("academicContextId", "Jam pelajaran wajib terkait satu konteks akademik.");
  }
  if (!Number.isInteger(draft.nomorUrut) || draft.nomorUrut < 1) {
    throw new JamPelajaranValidationError("nomorUrut", "Nomor urut wajib bilangan bulat mulai dari 1.");
  }
  if (!TIME_PATTERN.test(draft.waktuMulai) || !TIME_PATTERN.test(draft.waktuSelesai)) {
    throw new JamPelajaranValidationError("waktuMulai", "Format waktu wajib HH:MM, mis. 07:00.");
  }
  if (draft.waktuSelesai <= draft.waktuMulai) {
    throw new JamPelajaranValidationError("waktuSelesai", "Waktu selesai wajib setelah waktu mulai.");
  }
}

/**
 * Durasi menit dihitung dari waktu mulai/selesai — Bagian 19.1 mendaftar
 * durationMinutes sebagai bagian time model, tapi TIDAK disimpan mentah di
 * database supaya tidak ada dua sumber kebenaran (lihat migration 0003).
 */
export function calculateDurationMinutes(waktuMulai: string, waktuSelesai: string): number {
  const [h1, m1] = waktuMulai.split(":").map(Number);
  const [h2, m2] = waktuSelesai.split(":").map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
}

export function formatHari(hari: HariSekolah): string {
  return hari.charAt(0).toUpperCase() + hari.slice(1);
}
