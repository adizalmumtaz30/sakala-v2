// SAKALA V2 MASTER FINAL / PRACTICAL UI & OPERATOR EXPERIENCE §7, §10, §13:
// "Kenapa Target JP saya tidak sesuai kurikulum?" — SAKALA AI menjawab pakai
// capability yang SAMA dengan Konteks Akademik/Mata Pelajaran/Dashboard
// (listCurriculumIntelligenceAction, kriteria verified+official+tier1) plus
// deriveWeeklyTarget yang sudah ada di domain layer. Read-only: hanya
// membandingkan dan menjelaskan, TIDAK mengubah target_jp — penyesuaian
// tetap lewat alur Target JP/Generate Kurikulum yang sudah punya
// candidate->commit sendiri (§01: AI tidak boleh mengubah data diam-diam).

import { listCurriculumIntelligenceAction } from "@/app/(shell)/akademik/mata-pelajaran/curriculum-actions";
import { deriveWeeklyTarget } from "@/lib/domain/curriculumIntelligence";
import type { TargetJpRow } from "@/lib/application/targetJp.usecases";

export type CurriculumJpMismatch = {
  kelasId: string;
  kelasLabel: string;
  mataPelajaranNama: string;
  currentTargetJp: number;
  curriculumTargetJp: number;
  diffJp: number; // curriculumTargetJp - currentTargetJp
};

export async function getCurriculumJpMismatches(
  kelasList: Array<{ id: string; tingkat: string }>,
  targetJpRows: TargetJpRow[]
): Promise<CurriculumJpMismatch[]> {
  if (targetJpRows.length === 0) return [];

  const intelligence = await listCurriculumIntelligenceAction("all");
  if (!intelligence.ok) return [];

  const officialVersionIds = new Set(
    intelligence.data.versions
      .filter((v) => v.verification_status === "verified")
      .filter((v) => intelligence.data.sources.some((s) => s.id === v.source_id && s.status === "official" && s.source_tier === 1))
      .map((v) => v.id)
  );
  const officialItems = intelligence.data.items.filter((item) => officialVersionIds.has(item.curriculum_version_id));
  if (officialItems.length === 0) return [];

  const tingkatByKelasId = new Map(kelasList.map((k) => [k.id, k.tingkat]));

  const mismatches: CurriculumJpMismatch[] = [];
  for (const row of targetJpRows) {
    const tingkat = tingkatByKelasId.get(row.kelasId);
    if (!tingkat) continue;
    const item = officialItems.find(
      (it) => it.class_level === tingkat && it.subject_name.trim().toLowerCase() === row.mataPelajaranNama.trim().toLowerCase()
    );
    if (!item) continue; // tidak ada padanan resmi — bukan mismatch, tapi "belum terhubung" (sudah ditangani di Mata Pelajaran/Dashboard)
    const curriculumTargetRaw = item.weekly_target ?? deriveWeeklyTarget(item.official_allocation, item.allocation_type, item.effective_weeks);
    if (curriculumTargetRaw === null || curriculumTargetRaw === undefined) continue;
    const curriculumTargetJp = Math.round(curriculumTargetRaw);
    const diffJp = curriculumTargetJp - row.targetJp;
    if (diffJp !== 0) {
      mismatches.push({ kelasId: row.kelasId, kelasLabel: row.kelasLabel, mataPelajaranNama: row.mataPelajaranNama, currentTargetJp: row.targetJp, curriculumTargetJp, diffJp });
    }
  }
  return mismatches;
}
