// Application layer — use case / orchestration. Memanggil Domain untuk validasi
// dan Data Access untuk persistence. UI (Presentation) hanya boleh memanggil layer ini.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateSchoolProfileDraft,
  type SchoolProfile,
  type SchoolProfileDraft,
} from "@/lib/domain/schoolProfile";
import { schoolProfileRepository } from "@/lib/data-access/schoolProfile.repository";
import { academicContextRepository } from "@/lib/data-access/academicContext.repository";

export async function getSchoolProfile(supabase: SupabaseClient): Promise<SchoolProfile | null> {
  return schoolProfileRepository.findOne(supabase);
}

/**
 * Bagian 78 save flow: Validate → Persist → Update Cache → Success.
 * Setelah persist, pastikan default context (Tahun Pelajaran + Semester) punya
 * baris di academic_context — dibuat kalau belum ada, TAPI tidak dipaksa aktif
 * (default context ≠ active context), kecuali ini context pertama di sistem
 * (aturan bootstrap yang sama seperti createAcademicContext).
 */
export async function saveSchoolProfile(
  supabase: SupabaseClient,
  existingId: string | null,
  draft: SchoolProfileDraft
): Promise<SchoolProfile> {
  validateSchoolProfileDraft(draft);

  const profile = await schoolProfileRepository.upsert(supabase, existingId, draft);

  const defaultContext = await academicContextRepository.findByPair(
    supabase,
    draft.tahunPelajaranDefault.trim(),
    draft.semesterDefault
  );

  if (!defaultContext) {
    const all = await academicContextRepository.findAll(supabase);
    const isFirstEver = all.length === 0;
    await academicContextRepository.create(
      supabase,
      { tahunPelajaran: draft.tahunPelajaranDefault, semester: draft.semesterDefault },
      isFirstEver
    );
  }

  return profile;
}
