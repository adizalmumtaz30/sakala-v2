"use server";

import { createClient } from "@/lib/supabase/server";

export type AiActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface AiClassInsight {
  id: string;
  label: string;
  level: string;
  expectedSubjects: number;
  integratedSubjects: number;
  missingSubjects: number;
  targetRows: number;
  filledTargets: number;
  emptyTargets: number;
  officialJp: number;
  schoolJp: number;
  gapJp: number;
  ready: boolean;
}

export interface AiSubjectInsight {
  id: string;
  name: string;
  level: string;
  officialJp: number | null;
  schoolTargetJp: number | null;
  targetJp: number | null;
  status: "siap" | "belum_terintegrasi" | "target_belum_diisi" | "berbeda" | "perlu_ditinjau";
  reason: string;
}

export interface AiSourceInsight {
  id: string;
  name: string;
  institution: string;
  curriculumName: string;
  regulationYear: number | null;
  verificationStatus: string;
  officialUrl: string;
  retrievedAt: string;
}

export interface AiCopilotContext {
  academicContextId: string;
  academicYear: string;
  semester: string;
  classes: AiClassInsight[];
  subjects: AiSubjectInsight[];
  source: AiSourceInsight | null;
  sourceCount: number;
  dataScope: string[];
}

async function getCurriculumWorkspace() {
  const supabase = await createClient();
  const { data: contexts, error: contextError } = await supabase
    .from("academic_context")
    .select("id,tahun_pelajaran,semester,is_active")
    .order("is_active", { ascending: false })
    .order("tahun_pelajaran", { ascending: false });
  if (contextError) throw new Error(contextError.message);

  const active = (contexts ?? []).find((context) => context.is_active);
  if (!active) throw new Error("Belum ada konteks akademik aktif.");

  const [classesResult, versionsResult, sourcesResult, itemsResult, adoptionResult, targetResult] = await Promise.all([
    supabase.from("kelas").select("id,tingkat,nama_rombel,tahun_ajaran,semester").eq("tahun_ajaran", active.tahun_pelajaran).eq("semester", active.semester).order("tingkat").order("nama_rombel"),
    supabase.from("curriculum_version").select("id,source_id,curriculum_name,regulation_year,verification_status,retrieved_at,document_url").eq("verification_status", "verified").order("retrieved_at", { ascending: false }),
    supabase.from("curriculum_source").select("id,name,institution,official_url,status").order("source_tier").order("name"),
    supabase.from("curriculum_item").select("id,curriculum_version_id,subject_name,subject_code,class_level,weekly_target,official_allocation,extraction_status,derivation_status").eq("extraction_status", "verified"),
    supabase.from("curriculum_adoption").select("id,kelas_id,mata_pelajaran_id,curriculum_item_id,status,official_target_jp,school_target_jp").eq("academic_context_id", active.id),
    supabase.from("target_jp").select("id,kelas_id,mata_pelajaran_id,target_jp").eq("academic_context_id", active.id),
  ]);

  const errors = [classesResult, versionsResult, sourcesResult, itemsResult, adoptionResult, targetResult].map((result) => result.error).find(Boolean);
  if (errors) throw new Error(errors.message);

  return { active, classes: classesResult.data ?? [], versions: versionsResult.data ?? [], sources: sourcesResult.data ?? [], items: itemsResult.data ?? [], adoptions: adoptionResult.data ?? [], targets: targetResult.data ?? [] };
}

/** Read-only intelligence snapshot. SAKALA AI never generates curriculum and never mutates curriculum, Target JP, or schedule data from this surface. */
export async function getAiCopilotContextAction(): Promise<AiActionResult<AiCopilotContext>> {
  try {
    const { active, classes, versions, sources, items, adoptions, targets } = await getCurriculumWorkspace();
    const verifiedVersionIds = new Set(versions.map((version) => version.id));
    const verifiedItems = items.filter((item) => verifiedVersionIds.has(item.curriculum_version_id) && item.derivation_status !== "blocked");
    const sourceById = new Map(sources.map((source) => [source.id, source]));
    const adoptionByClass = new Map<string, typeof adoptions>();
    for (const adoption of adoptions) {
      const rows = adoptionByClass.get(adoption.kelas_id) ?? [];
      rows.push(adoption);
      adoptionByClass.set(adoption.kelas_id, rows);
    }
    const targetByKey = new Map(targets.map((target) => [`${target.kelas_id}:${target.mata_pelajaran_id}`, target.target_jp]));

    const classInsights: AiClassInsight[] = classes.map((kelas) => {
      const expected = verifiedItems.filter((item) => item.class_level === kelas.tingkat);
      const classAdoptions = adoptionByClass.get(kelas.id) ?? [];
      const integratedIds = new Set(classAdoptions.map((row) => row.curriculum_item_id));
      const targetRows = targets.filter((target) => target.kelas_id === kelas.id);
      const filledTargets = targetRows.filter((target) => Number(target.target_jp) > 0);
      const emptyTargets = targetRows.filter((target) => Number(target.target_jp) === 0);
      const officialJp = expected.reduce((sum, item) => sum + Number(item.weekly_target ?? 0), 0);
      const schoolJp = classAdoptions.reduce((sum, row) => sum + Number(row.school_target_jp ?? row.official_target_jp ?? 0), 0);
      const effectiveSchoolJp = classAdoptions.length ? schoolJp : filledTargets.reduce((sum, row) => sum + Number(row.target_jp ?? 0), 0);
      const gapJp = Math.max(0, officialJp - effectiveSchoolJp);
      const missingSubjects = Math.max(0, expected.length - integratedIds.size);

      return {
        id: kelas.id,
        label: `${kelas.tingkat} ${kelas.nama_rombel}`.trim(),
        level: kelas.tingkat,
        expectedSubjects: expected.length,
        integratedSubjects: integratedIds.size,
        missingSubjects,
        targetRows: targetRows.length,
        filledTargets: filledTargets.length,
        emptyTargets: emptyTargets.length,
        officialJp,
        schoolJp: effectiveSchoolJp,
        gapJp,
        ready: expected.length > 0 && missingSubjects === 0 && gapJp === 0 && emptyTargets.length === 0,
      };
    });

    const selectedLevel = classInsights[0]?.level ?? null;
    const selectedClassId = classInsights[0]?.id ?? null;
    const subjects: AiSubjectInsight[] = verifiedItems
      .filter((item) => !selectedLevel || item.class_level === selectedLevel)
      .map((item) => {
        const adoption = adoptions.find((row) => row.curriculum_item_id === item.id && (!selectedClassId || row.kelas_id === selectedClassId));
        const target = adoption ? targetByKey.get(`${adoption.kelas_id}:${adoption.mata_pelajaran_id}`) ?? null : null;
        if (!adoption) return { id: item.id, name: item.subject_name, level: item.class_level, officialJp: Number(item.weekly_target ?? item.official_allocation ?? 0), schoolTargetJp: null, targetJp: null, status: "belum_terintegrasi", reason: "Belum masuk ke integrasi kurikulum kelas." };
        const official = Number(adoption.official_target_jp ?? item.weekly_target ?? 0);
        const school = adoption.school_target_jp == null ? null : Number(adoption.school_target_jp);
        if (target == null || Number(target) === 0) return { id: item.id, name: item.subject_name, level: item.class_level, officialJp: official, schoolTargetJp: school, targetJp: target, status: "target_belum_diisi", reason: "Target JP belum terisi pada data aktif." };
        if (school != null && school !== Number(target)) return { id: item.id, name: item.subject_name, level: item.class_level, officialJp: official, schoolTargetJp: school, targetJp: Number(target), status: "berbeda", reason: `Target sekolah ${school} JP berbeda dengan Target JP aktif ${target} JP.` };
        return { id: item.id, name: item.subject_name, level: item.class_level, officialJp: official, schoolTargetJp: school, targetJp: Number(target), status: "siap", reason: "Integrasi dan Target JP tersedia." };
      });

    const latestVersion = versions[0] ?? null;
    const latestSource = latestVersion ? sourceById.get(latestVersion.source_id) ?? null : null;
    const source = latestVersion && latestSource ? {
      id: latestVersion.id,
      name: latestSource.name,
      institution: latestSource.institution,
      curriculumName: latestVersion.curriculum_name,
      regulationYear: latestVersion.regulation_year,
      verificationStatus: latestVersion.verification_status,
      officialUrl: latestVersion.document_url || latestSource.official_url,
      retrievedAt: latestVersion.retrieved_at,
    } : null;

    return { ok: true, data: { academicContextId: active.id, academicYear: active.tahun_pelajaran, semester: active.semester, classes: classInsights, subjects, source, sourceCount: versions.length, dataScope: ["Konteks Akademik", "Sumber Kurikulum", "Item Kurikulum", "Integrasi Kurikulum", "Target JP"] } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "SAKALA AI belum dapat membaca data kurikulum." };
  }
}
