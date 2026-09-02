// SAKALA V2 MASTER FINAL / PRACTICAL UI & OPERATOR EXPERIENCE §9, §13, §17:
// Dashboard adalah MONITOR, bukan tempat menjalankan proses — cukup baca
// status kesiapan kurikulum dari capability yang sama dipakai Konteks
// Akademik (app/(shell)/akademik/page.tsx) dan Mata Pelajaran
// (app/(shell)/mata-pelajaran/page.tsx), lewat listCurriculumIntelligenceAction
// yang sama. Bukan validator baru, bukan salinan logic — kriteria "resmi"
// (verified + official + source_tier 1) disamakan persis dengan dua Core itu
// supaya tidak pernah ada dua jawaban berbeda untuk pertanyaan yang sama.

import { listCurriculumIntelligenceAction } from "@/app/(shell)/akademik/mata-pelajaran/curriculum-actions";

export type DashboardCurriculumStatus = {
  curriculumAvailable: boolean;
  unmatchedSubjectCount: number;
};

export async function getDashboardCurriculumStatus(
  classLevels: Set<string>,
  existingMapelNames: Set<string>
): Promise<DashboardCurriculumStatus> {
  if (classLevels.size === 0) return { curriculumAvailable: true, unmatchedSubjectCount: 0 };

  const intelligence = await listCurriculumIntelligenceAction("all");
  if (!intelligence.ok) {
    // Gagal cek → jangan tampilkan klaim yang keliru (sama seperti Konteks Akademik).
    return { curriculumAvailable: true, unmatchedSubjectCount: 0 };
  }

  const officialVersionIds = new Set(
    intelligence.data.versions
      .filter((v) => v.verification_status === "verified")
      .filter((v) => intelligence.data.sources.some((s) => s.id === v.source_id && s.status === "official" && s.source_tier === 1))
      .map((v) => v.id)
  );

  const curriculumAvailable = intelligence.data.items.some(
    (item) => officialVersionIds.has(item.curriculum_version_id) && classLevels.has(item.class_level)
  );

  const relevantNames = new Set(
    intelligence.data.items
      .filter((item) => officialVersionIds.has(item.curriculum_version_id) && classLevels.has(item.class_level))
      .map((item) => item.subject_name)
  );
  const unmatchedSubjectCount = Array.from(relevantNames).filter((name) => !existingMapelNames.has(name.trim().toLowerCase())).length;

  return { curriculumAvailable, unmatchedSubjectCount };
}
