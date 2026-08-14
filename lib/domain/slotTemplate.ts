// Domain layer — entity, value object, invariant. TIDAK BOLEH import Supabase atau React.
// Bagian 20.2 — Slot Template: menandai jenis slot (Belajar Mengajar / Upacara /
// Religi / Istirahat / Libur / Custom) untuk satu (hari, nomor urut) di dalam
// satu Schedule Model. "Fixed slots block ordinary teaching assignments" —
// slot selain "belajar_mengajar" akan memblokir penempatan pengajaran biasa
// di step Schedule Domain (13) nanti.

import type { HariSekolah } from "@/lib/domain/jamPelajaran";

export type JenisSlot = "belajar_mengajar" | "upacara" | "religi" | "istirahat" | "libur" | "custom";

export interface SlotTemplate {
  id: string;
  scheduleModelId: string;
  hari: HariSekolah;
  nomorUrut: number;
  jenisSlot: JenisSlot;
  namaCustom: string | null;
}

export interface SlotTemplateDraft {
  scheduleModelId: string;
  hari: HariSekolah;
  nomorUrut: number;
  jenisSlot: JenisSlot;
  namaCustom: string | null;
}

export class SlotTemplateValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "SlotTemplateValidationError";
  }
}

const JENIS_SLOT_VALID: JenisSlot[] = ["belajar_mengajar", "upacara", "religi", "istirahat", "libur", "custom"];

/**
 * Invariant Slot Template (Bagian 20.2): wajib terikat ke satu Schedule
 * Model, nomor urut bilangan bulat >= 1, jenis slot wajib salah satu nilai
 * yang diizinkan, dan nama custom wajib diisi (min 2 karakter) kalau jenis
 * slot = "custom" — sebaliknya nama custom diabaikan.
 */
export function validateSlotTemplateDraft(draft: SlotTemplateDraft): void {
  if (!draft.scheduleModelId) {
    throw new SlotTemplateValidationError("scheduleModelId", "Slot Template wajib terkait satu Schedule Model.");
  }
  if (!Number.isInteger(draft.nomorUrut) || draft.nomorUrut < 1) {
    throw new SlotTemplateValidationError("nomorUrut", "Nomor urut wajib bilangan bulat mulai dari 1.");
  }
  if (!JENIS_SLOT_VALID.includes(draft.jenisSlot)) {
    throw new SlotTemplateValidationError("jenisSlot", "Jenis slot tidak dikenal.");
  }
  if (draft.jenisSlot === "custom" && (!draft.namaCustom || draft.namaCustom.trim().length < 2)) {
    throw new SlotTemplateValidationError("namaCustom", "Nama custom wajib diisi (minimal 2 karakter) untuk jenis slot Custom.");
  }
}

export function formatJenisSlot(slot: Pick<SlotTemplate, "jenisSlot" | "namaCustom">): string {
  switch (slot.jenisSlot) {
    case "belajar_mengajar":
      return "Belajar Mengajar";
    case "upacara":
      return "Upacara";
    case "religi":
      return "Religi";
    case "istirahat":
      return "Istirahat";
    case "libur":
      return "Libur";
    case "custom":
      return slot.namaCustom ?? "Custom";
  }
}

/** Fixed slot = selain "belajar_mengajar" — memblokir penempatan pengajaran biasa (Bagian 20.2). */
export function isFixedSlot(jenisSlot: JenisSlot): boolean {
  return jenisSlot !== "belajar_mengajar";
}
