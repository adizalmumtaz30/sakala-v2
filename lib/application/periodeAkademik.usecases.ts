// Application layer — use case / orchestration. Memanggil Domain untuk validasi
// dan Data Access untuk persistence. UI (Presentation) hanya boleh memanggil layer ini.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validatePeriodeAkademikDraft,
  periodsOverlap,
  type PeriodeAkademik,
  type PeriodeAkademikDraft,
  PeriodeAkademikValidationError,
} from "@/lib/domain/periodeAkademik";
import { periodeAkademikRepository } from "@/lib/data-access/periodeAkademik.repository";

export async function listPeriodeAkademik(
  supabase: SupabaseClient,
  academicContextId: string
): Promise<PeriodeAkademik[]> {
  return periodeAkademikRepository.findByContext(supabase, academicContextId);
}

async function assertNoOverlap(
  supabase: SupabaseClient,
  draft: PeriodeAkademikDraft,
  excludeId?: string
): Promise<void> {
  const existing = await periodeAkademikRepository.findByContext(supabase, draft.academicContextId);
  const overlap = existing.find((p) => p.id !== excludeId && periodsOverlap(p, draft));
  if (overlap) {
    throw new PeriodeAkademikValidationError(
      "tanggalMulai",
      `Rentang tanggal tumpang tindih dengan periode "${overlap.nama}".`
    );
  }
}

export async function createPeriodeAkademik(
  supabase: SupabaseClient,
  draft: PeriodeAkademikDraft
): Promise<PeriodeAkademik> {
  validatePeriodeAkademikDraft(draft);
  await assertNoOverlap(supabase, draft);
  return periodeAkademikRepository.create(supabase, draft);
}

export async function updatePeriodeAkademik(
  supabase: SupabaseClient,
  id: string,
  draft: PeriodeAkademikDraft
): Promise<PeriodeAkademik> {
  validatePeriodeAkademikDraft(draft);
  await assertNoOverlap(supabase, draft, id);
  return periodeAkademikRepository.update(supabase, id, draft);
}

export async function deletePeriodeAkademik(supabase: SupabaseClient, id: string): Promise<void> {
  return periodeAkademikRepository.remove(supabase, id);
}
