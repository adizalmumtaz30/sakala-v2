import type { SupabaseClient } from "@supabase/supabase-js";
import { validateKelasDraft, type Kelas, type KelasDraft } from "@/lib/domain/kelas";
import { kelasRepository } from "@/lib/data-access/kelas.repository";

export async function listKelas(supabase: SupabaseClient): Promise<Kelas[]> {
  return kelasRepository.findAll(supabase);
}

export async function createKelas(supabase: SupabaseClient, draft: KelasDraft): Promise<Kelas> {
  validateKelasDraft(draft);
  return kelasRepository.create(supabase, draft);
}

export async function updateKelas(
  supabase: SupabaseClient,
  id: string,
  draft: KelasDraft
): Promise<Kelas> {
  validateKelasDraft(draft);
  return kelasRepository.update(supabase, id, draft);
}

export async function deleteKelas(supabase: SupabaseClient, id: string): Promise<void> {
  return kelasRepository.remove(supabase, id);
}
