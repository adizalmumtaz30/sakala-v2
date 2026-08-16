import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateMataPelajaranDraft,
  type MataPelajaran,
  type MataPelajaranDraft,
} from "@/lib/domain/mata-pelajaran";
import { mataPelajaranRepository } from "@/lib/data-access/mata-pelajaran.repository";

export async function listMataPelajaran(supabase: SupabaseClient): Promise<MataPelajaran[]> {
  return mataPelajaranRepository.findAll(supabase);
}

export async function getMataPelajaranById(
  supabase: SupabaseClient,
  id: string
): Promise<MataPelajaran | null> {
  return mataPelajaranRepository.findById(supabase, id);
}

export async function createMataPelajaran(
  supabase: SupabaseClient,
  draft: MataPelajaranDraft
): Promise<MataPelajaran> {
  validateMataPelajaranDraft(draft);
  return mataPelajaranRepository.create(supabase, draft);
}

export async function updateMataPelajaran(
  supabase: SupabaseClient,
  id: string,
  draft: MataPelajaranDraft
): Promise<MataPelajaran> {
  validateMataPelajaranDraft(draft);
  return mataPelajaranRepository.update(supabase, id, draft);
}

export async function deleteMataPelajaran(supabase: SupabaseClient, id: string): Promise<void> {
  return mataPelajaranRepository.remove(supabase, id);
}
