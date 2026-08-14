// Application layer — use case / orchestration. Memanggil Domain untuk validasi
// dan Data Access untuk persistence. UI (Presentation) hanya boleh memanggil layer ini.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateSlotTemplateDraft,
  type SlotTemplate,
  type SlotTemplateDraft,
  SlotTemplateValidationError,
} from "@/lib/domain/slotTemplate";
import { slotTemplateRepository } from "@/lib/data-access/slotTemplate.repository";
import { scheduleModelRepository } from "@/lib/data-access/scheduleModel.repository";
import { jamPelajaranRepository } from "@/lib/data-access/jamPelajaran.repository";
import { formatHari } from "@/lib/domain/jamPelajaran";

export async function listSlotTemplate(supabase: SupabaseClient, scheduleModelId: string): Promise<SlotTemplate[]> {
  return slotTemplateRepository.findByModel(supabase, scheduleModelId);
}

/**
 * Claude addition — spesifikasi Bagian 20.2 tidak menyebutkan validasi ini
 * eksplisit, tapi tanpa ini Slot Template bisa mendefinisikan periode yang
 * tidak pernah ada di grid Jam Pelajaran (Phase 04) untuk konteks akademik
 * yang sama, menghasilkan slot "hantu". Periksa (hari, nomorUrut) memang
 * terdaftar di jam_pelajaran milik academic context dari Schedule Model ini.
 */
async function assertPeriodExistsInJamPelajaran(supabase: SupabaseClient, draft: SlotTemplateDraft): Promise<void> {
  const model = await scheduleModelRepository.findById(supabase, draft.scheduleModelId);
  if (!model) {
    throw new SlotTemplateValidationError("scheduleModelId", "Schedule Model tidak ditemukan.");
  }
  const jamList = await jamPelajaranRepository.findByContext(supabase, model.academicContextId);
  const exists = jamList.some((j) => j.hari === draft.hari && j.nomorUrut === draft.nomorUrut);
  if (!exists) {
    throw new SlotTemplateValidationError(
      "nomorUrut",
      `Jam ke-${draft.nomorUrut} pada hari ${formatHari(draft.hari)} belum terdaftar di Jam Pelajaran konteks ini.`
    );
  }
}

async function assertNoClash(supabase: SupabaseClient, draft: SlotTemplateDraft, excludeId?: string): Promise<void> {
  const existing = await slotTemplateRepository.findByModel(supabase, draft.scheduleModelId);
  const clash = existing.find((s) => s.id !== excludeId && s.hari === draft.hari && s.nomorUrut === draft.nomorUrut);
  if (clash) {
    throw new SlotTemplateValidationError(
      "nomorUrut",
      `Sudah ada Slot Template untuk jam ke-${draft.nomorUrut} pada hari ${formatHari(draft.hari)} di model ini.`
    );
  }
}

export async function createSlotTemplate(supabase: SupabaseClient, draft: SlotTemplateDraft): Promise<SlotTemplate> {
  validateSlotTemplateDraft(draft);
  await assertPeriodExistsInJamPelajaran(supabase, draft);
  await assertNoClash(supabase, draft);
  return slotTemplateRepository.create(supabase, draft);
}

export async function updateSlotTemplate(supabase: SupabaseClient, id: string, draft: SlotTemplateDraft): Promise<SlotTemplate> {
  validateSlotTemplateDraft(draft);
  await assertPeriodExistsInJamPelajaran(supabase, draft);
  await assertNoClash(supabase, draft, id);
  return slotTemplateRepository.update(supabase, id, draft);
}

export async function deleteSlotTemplate(supabase: SupabaseClient, id: string): Promise<void> {
  return slotTemplateRepository.remove(supabase, id);
}
