// Application layer — use case / orchestration. Memanggil Domain untuk validasi
// dan Data Access untuk persistence. UI (Presentation) hanya boleh memanggil layer ini.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateJamPelajaranDraft,
  type JamPelajaran,
  type JamPelajaranDraft,
  JamPelajaranValidationError,
} from "@/lib/domain/jamPelajaran";
import { jamPelajaranRepository } from "@/lib/data-access/jamPelajaran.repository";

export async function listJamPelajaran(supabase: SupabaseClient, academicContextId: string): Promise<JamPelajaran[]> {
  return jamPelajaranRepository.findByContext(supabase, academicContextId);
}

async function assertNoClash(supabase: SupabaseClient, draft: JamPelajaranDraft, excludeId?: string): Promise<void> {
  const existing = await jamPelajaranRepository.findByContext(supabase, draft.academicContextId);

  const clashNomor = existing.find(
    (j) => j.id !== excludeId && j.hari === draft.hari && j.nomorUrut === draft.nomorUrut
  );
  if (clashNomor) {
    throw new JamPelajaranValidationError(
      "nomorUrut",
      `Nomor urut ${draft.nomorUrut} pada hari ${draft.hari} sudah dipakai oleh "${clashNomor.nama}".`
    );
  }

  const clashWaktu = existing.find(
    (j) =>
      j.id !== excludeId &&
      j.hari === draft.hari &&
      draft.waktuMulai < j.waktuSelesai &&
      j.waktuMulai < draft.waktuSelesai
  );
  if (clashWaktu) {
    throw new JamPelajaranValidationError(
      "waktuMulai",
      `Rentang waktu tumpang tindih dengan "${clashWaktu.nama}" pada hari yang sama.`
    );
  }
}

export async function createJamPelajaran(supabase: SupabaseClient, draft: JamPelajaranDraft): Promise<JamPelajaran> {
  validateJamPelajaranDraft(draft);
  await assertNoClash(supabase, draft);
  return jamPelajaranRepository.create(supabase, draft);
}

export async function updateJamPelajaran(
  supabase: SupabaseClient,
  id: string,
  draft: JamPelajaranDraft
): Promise<JamPelajaran> {
  validateJamPelajaranDraft(draft);
  await assertNoClash(supabase, draft, id);
  return jamPelajaranRepository.update(supabase, id, draft);
}

export async function deleteJamPelajaran(supabase: SupabaseClient, id: string): Promise<void> {
  return jamPelajaranRepository.remove(supabase, id);
}
