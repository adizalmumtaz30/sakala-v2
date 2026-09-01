// Application layer — use case / orchestration. UI hanya memanggil layer ini.
// School Profile adalah profil operator/lembaga dan TIDAK memiliki authority
// atas Academic Context. Field default yang masih ada di schema diperlakukan
// sebagai legacy onboarding preference selama masa migrasi; menyimpan profil
// tidak boleh membuat, mengubah, atau memilih Academic Context.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateSchoolProfileDraft,
  type SchoolProfile,
  type SchoolProfileDraft,
} from "@/lib/domain/schoolProfile";
import { schoolProfileRepository } from "@/lib/data-access/schoolProfile.repository";

export async function getSchoolProfile(supabase: SupabaseClient): Promise<SchoolProfile | null> {
  return schoolProfileRepository.findOne(supabase);
}

export async function saveSchoolProfile(
  supabase: SupabaseClient,
  existingId: string | null,
  draft: SchoolProfileDraft
): Promise<SchoolProfile> {
  validateSchoolProfileDraft(draft);
  return schoolProfileRepository.upsert(supabase, existingId, draft);
}
