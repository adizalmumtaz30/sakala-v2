// Application layer — use case / orchestration. Memanggil Domain untuk validasi
// dan Data Access untuk persistence. UI (Presentation) hanya boleh memanggil layer ini.

import type { SupabaseClient } from "@supabase/supabase-js";
import { validateGuruDraft, type Guru, type GuruDraft } from "@/lib/domain/guru";
import { guruRepository } from "@/lib/data-access/guru.repository";

export async function listGuru(supabase: SupabaseClient): Promise<Guru[]> {
  return guruRepository.findAll(supabase);
}

export async function getGuruById(supabase: SupabaseClient, id: string): Promise<Guru | null> {
  return guruRepository.findById(supabase, id);
}

export async function createGuru(supabase: SupabaseClient, draft: GuruDraft): Promise<Guru> {
  validateGuruDraft(draft);
  return guruRepository.create(supabase, draft);
}

export async function updateGuru(
  supabase: SupabaseClient,
  id: string,
  draft: GuruDraft
): Promise<Guru> {
  validateGuruDraft(draft);
  return guruRepository.update(supabase, id, draft);
}

export async function deleteGuru(supabase: SupabaseClient, id: string): Promise<void> {
  return guruRepository.remove(supabase, id);
}

export async function toggleGuruStatus(supabase: SupabaseClient, guru: Guru): Promise<Guru> {
  const nextStatus = guru.status === "aktif" ? "nonaktif" : "aktif";
  return guruRepository.update(supabase, guru.id, {
    namaGuru: guru.namaGuru,
    status: nextStatus,
    nip: guru.nip,
    nuptk: guru.nuptk,
    email: guru.email,
    noTelepon: guru.noTelepon,
  });
}
