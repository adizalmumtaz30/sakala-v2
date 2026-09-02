// SAKALA V2 MASTER FINAL / PRACTICAL UI & OPERATOR EXPERIENCE §8, §12, §13:
// "Curriculum Validation" adalah SATU capability yang dipakai banyak Core
// (Target JP, Mata Pelajaran, Pembagian Mengajar, Dashboard, SAKALA AI).
// Fungsi ini BUKAN validator baru — ia hanya membaca curriculum_adoption
// (sudah ada, dipakai juga oleh /akademik/generate-kurikulum) dari sudut
// pandang Mata Pelajaran, supaya Core ini bisa menampilkan Contextual Action
// ("Periksa Mapping") tanpa duplikasi logic kurikulum.

import type { SupabaseClient } from "@supabase/supabase-js";

export type CurriculumMappingStatus = {
  // Belum ada kurikulum yang tersedia sama sekali untuk dijadikan acuan —
  // dalam kondisi ini UI tidak boleh menampilkan "N belum terhubung" (§26:
  // jangan salahkan Mata Pelajaran kalau akar masalahnya ada di Source).
  hasCurriculumAvailable: boolean;
  totalMapelAktif: number;
  unmappedCount: number;
};

export async function getMataPelajaranCurriculumMappingStatus(
  supabase: SupabaseClient
): Promise<CurriculumMappingStatus> {
  const [{ data: context }, { data: mapelRows }, { data: versionRows }] = await Promise.all([
    supabase.from("academic_context").select("id").eq("is_active", true).maybeSingle(),
    supabase.from("mata_pelajaran").select("id").eq("status", "aktif"),
    supabase.from("curriculum_version").select("id").limit(1),
  ]);

  const totalMapelAktif = mapelRows?.length ?? 0;
  const hasCurriculumAvailable = !!context && (versionRows?.length ?? 0) > 0;

  if (!hasCurriculumAvailable || totalMapelAktif === 0) {
    return { hasCurriculumAvailable, totalMapelAktif, unmappedCount: 0 };
  }

  const { data: adoptionRows } = await supabase
    .from("curriculum_adoption")
    .select("mata_pelajaran_id")
    .eq("academic_context_id", context!.id);

  const mappedIds = new Set((adoptionRows ?? []).map((r: { mata_pelajaran_id: string }) => r.mata_pelajaran_id));
  const mapelIds = (mapelRows ?? []).map((r: { id: string }) => r.id);
  const unmappedCount = mapelIds.filter((id) => !mappedIds.has(id)).length;

  return { hasCurriculumAvailable, totalMapelAktif, unmappedCount };
}
