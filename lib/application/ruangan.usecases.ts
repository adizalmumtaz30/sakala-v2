import type { SupabaseClient } from "@supabase/supabase-js";
import { validateRuanganDraft, type Ruangan, type RuanganDraft } from "@/lib/domain/ruangan";
import { ruanganRepository } from "@/lib/data-access/ruangan.repository";

export async function listRuangan(supabase: SupabaseClient): Promise<Ruangan[]> {
  return ruanganRepository.findAll(supabase);
}

export async function createRuangan(supabase: SupabaseClient, draft: RuanganDraft): Promise<Ruangan> {
  validateRuanganDraft(draft);
  return ruanganRepository.create(supabase, draft);
}

export async function updateRuangan(
  supabase: SupabaseClient,
  id: string,
  draft: RuanganDraft
): Promise<Ruangan> {
  validateRuanganDraft(draft);
  return ruanganRepository.update(supabase, id, draft);
}

export async function deleteRuangan(supabase: SupabaseClient, id: string): Promise<void> {
  return ruanganRepository.remove(supabase, id);
}
