// Domain layer — entity, value object, invariant. TIDAK BOLEH import Supabase atau React.
// Bagian 20 / 84 — Schedule Model: konfigurasi jadwal (BUKAN timetable itu
// sendiri) — model name, start time, standard duration, max periods/day,
// active days, holidays, room mode, rombel usage, status. Dibangun di atas
// academic_context + jam_pelajaran (Phase 04).

import type { HariSekolah } from "@/lib/domain/jamPelajaran";
import { URUTAN_HARI } from "@/lib/domain/jamPelajaran";

export type ModeRuangan = "wajib" | "opsional" | "tidak_dipakai";
export type PenggunaanRombel = "seragam" | "per_rombel";
export type StatusAktif = "aktif" | "nonaktif";

export interface ScheduleModel {
  id: string;
  academicContextId: string;
  namaModel: string;
  waktuMulai: string; // "HH:MM"
  durasiStandarMenit: number;
  maksJamPerHari: number;
  hariAktif: HariSekolah[];
  hariLibur: string[]; // ISO date "YYYY-MM-DD"
  modeRuangan: ModeRuangan;
  penggunaanRombel: PenggunaanRombel;
  status: StatusAktif;
}

export interface ScheduleModelDraft {
  academicContextId: string;
  namaModel: string;
  waktuMulai: string;
  durasiStandarMenit: number;
  maksJamPerHari: number;
  hariAktif: HariSekolah[];
  hariLibur: string[];
  modeRuangan: ModeRuangan;
  penggunaanRombel: PenggunaanRombel;
  status: StatusAktif;
}

export class ScheduleModelValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "ScheduleModelValidationError";
  }
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Invariant Schedule Model (Bagian 20/84): nama wajib diisi min 2 karakter,
 * wajib terikat ke satu konteks akademik, waktu mulai format HH:MM valid,
 * durasi standar & maks jam per hari bilangan bulat positif dalam batas
 * wajar, minimal satu hari aktif (tanpa duplikat), setiap tanggal libur
 * format ISO valid (tanpa duplikat), room mode & penggunaan rombel wajib
 * salah satu nilai yang diizinkan (tidak boleh diinfer).
 */
export function validateScheduleModelDraft(draft: ScheduleModelDraft): void {
  const nama = draft.namaModel.trim();
  if (nama.length < 2) {
    throw new ScheduleModelValidationError("namaModel", "Nama model wajib diisi, minimal 2 karakter.");
  }
  if (!draft.academicContextId) {
    throw new ScheduleModelValidationError("academicContextId", "Schedule Model wajib terkait satu konteks akademik.");
  }
  if (!TIME_PATTERN.test(draft.waktuMulai)) {
    throw new ScheduleModelValidationError("waktuMulai", "Format waktu mulai wajib HH:MM, mis. 07:00.");
  }
  if (!Number.isInteger(draft.durasiStandarMenit) || draft.durasiStandarMenit <= 0 || draft.durasiStandarMenit > 300) {
    throw new ScheduleModelValidationError("durasiStandarMenit", "Durasi standar wajib bilangan bulat 1–300 menit.");
  }
  if (!Number.isInteger(draft.maksJamPerHari) || draft.maksJamPerHari < 1 || draft.maksJamPerHari > 20) {
    throw new ScheduleModelValidationError("maksJamPerHari", "Maks jam per hari wajib bilangan bulat 1–20.");
  }
  if (draft.hariAktif.length === 0) {
    throw new ScheduleModelValidationError("hariAktif", "Pilih minimal satu hari aktif.");
  }
  if (new Set(draft.hariAktif).size !== draft.hariAktif.length) {
    throw new ScheduleModelValidationError("hariAktif", "Hari aktif tidak boleh mengandung duplikat.");
  }
  for (const h of draft.hariAktif) {
    if (!URUTAN_HARI.includes(h)) {
      throw new ScheduleModelValidationError("hariAktif", `Hari "${h}" tidak dikenal.`);
    }
  }
  const uniqueHolidays = new Set(draft.hariLibur);
  if (uniqueHolidays.size !== draft.hariLibur.length) {
    throw new ScheduleModelValidationError("hariLibur", "Tanggal libur tidak boleh mengandung duplikat.");
  }
  for (const tanggal of draft.hariLibur) {
    if (!DATE_PATTERN.test(tanggal)) {
      throw new ScheduleModelValidationError("hariLibur", `Format tanggal libur tidak valid: "${tanggal}".`);
    }
  }
  if (!["wajib", "opsional", "tidak_dipakai"].includes(draft.modeRuangan)) {
    throw new ScheduleModelValidationError("modeRuangan", "Room mode wajib salah satu: Wajib, Opsional, atau Tidak Dipakai.");
  }
  if (!["seragam", "per_rombel"].includes(draft.penggunaanRombel)) {
    throw new ScheduleModelValidationError("penggunaanRombel", "Penggunaan rombel wajib salah satu nilai yang valid.");
  }
}

export function formatModeRuangan(mode: ModeRuangan): string {
  switch (mode) {
    case "wajib":
      return "Wajib";
    case "opsional":
      return "Opsional";
    case "tidak_dipakai":
      return "Tidak Dipakai";
  }
}

export function formatPenggunaanRombel(p: PenggunaanRombel): string {
  return p === "seragam" ? "Seragam (semua rombel)" : "Per Rombel";
}
