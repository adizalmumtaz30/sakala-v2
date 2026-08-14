// Application layer — use case / orchestration. Memanggil Domain untuk validasi
// dan Data Access untuk persistence. UI (Presentation) hanya boleh memanggil layer ini.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateScheduleModelDraft,
  type ScheduleModel,
  type ScheduleModelDraft,
  ScheduleModelValidationError,
} from "@/lib/domain/scheduleModel";
import { scheduleModelRepository } from "@/lib/data-access/scheduleModel.repository";

export async function listScheduleModels(supabase: SupabaseClient, academicContextId: string): Promise<ScheduleModel[]> {
  return scheduleModelRepository.findByContext(supabase, academicContextId);
}

export async function getScheduleModel(supabase: SupabaseClient, id: string): Promise<ScheduleModel | null> {
  return scheduleModelRepository.findById(supabase, id);
}

/**
 * Claude addition — spesifikasi tidak menyebutkan aturan nama unik secara
 * eksplisit, tapi dua Schedule Model dengan nama sama dalam satu konteks
 * akan membingungkan saat memilih model untuk generate (step 14). Lihat
 * catatan desain di README/checkpoint.
 */
async function assertNoDuplicateName(supabase: SupabaseClient, draft: ScheduleModelDraft, excludeId?: string): Promise<void> {
  const existing = await scheduleModelRepository.findByContext(supabase, draft.academicContextId);
  const clash = existing.find(
    (m) => m.id !== excludeId && m.namaModel.trim().toLowerCase() === draft.namaModel.trim().toLowerCase()
  );
  if (clash) {
    throw new ScheduleModelValidationError("namaModel", `Nama model "${draft.namaModel.trim()}" sudah dipakai di konteks ini.`);
  }
}

export async function createScheduleModel(supabase: SupabaseClient, draft: ScheduleModelDraft): Promise<ScheduleModel> {
  validateScheduleModelDraft(draft);
  await assertNoDuplicateName(supabase, draft);
  return scheduleModelRepository.create(supabase, draft);
}

export async function updateScheduleModel(supabase: SupabaseClient, id: string, draft: ScheduleModelDraft): Promise<ScheduleModel> {
  validateScheduleModelDraft(draft);
  await assertNoDuplicateName(supabase, draft, id);
  return scheduleModelRepository.update(supabase, id, draft);
}

export async function deleteScheduleModel(supabase: SupabaseClient, id: string): Promise<void> {
  return scheduleModelRepository.remove(supabase, id);
}
