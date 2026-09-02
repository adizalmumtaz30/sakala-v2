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
 *
 * Bootstrap context (Tahun Pelajaran + Semester dari profil) HANYA terjadi saat
 * benar-benar belum ada academic_context sama sekali (onboarding sekolah baru).
 * Begitu satu context sudah ada, Profil TIDAK LAGI boleh membuat atau mencari
 * context — Akademik Context adalah satu-satunya gerbang untuk itu. Ini mencegah
 * Profil menjadi authority akademik kedua yang bisa diam-diam membuat context
 * duplikat/orphan (jenjang/institution hardcode) setiap kali admin sekadar
 * mengedit nama/jabatan.
 */
export async function saveSchoolProfile(
  supabase: SupabaseClient,
  existingId: string | null,
  draft: SchoolProfileDraft
): Promise<SchoolProfile> {
  validateSchoolProfileDraft(draft);

  const profile = await schoolProfileRepository.upsert(supabase, existingId, draft);

  const existingContexts = await academicContextRepository.findAll(supabase);
  if (existingContexts.length === 0) {
    // Onboarding sekolah baru: belum ada satu pun Academic Context, jadi profil
    // boleh membuat yang pertama. Jenjang/institution pakai default (backfill
    // lama MTs/Kemenag) — operator bisa mengubahnya lewat "Tambah Konteks
    // Akademik" setelah ini.
    await academicContextRepository.create(
      supabase,
      { tahunPelajaran: draft.tahunPelajaranDefault, semester: draft.semesterDefault, jenjang: "MTs", institution: "Kemenag" },
      true
    );
  }

  return profile;
}
