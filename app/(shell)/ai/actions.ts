"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listAcademicContexts } from "@/lib/application/academicContext.usecases";

export type AiActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type CurriculumItem = { id: string; curriculum_version_id: string; subject_name: string; subject_code: string | null; class_level: string; weekly_target: number | null; official_allocation: number | null; derivation_status: string; extraction_status: string };
type Adoption = { academic_context_id: string; kelas_id: string; mata_pelajaran_id: string; curriculum_item_id: string; official_target_jp: number | null; school_target_jp: number | null; status: string };
type TargetRow = { academic_context_id: string; kelas_id: string; mata_pelajaran_id: string; target_jp: number };
type ClassRow = { id: string; tingkat: string; nama_rombel: string; tahun_ajaran: string; semester: string };
type SubjectRow = { id: string; nama: string; kode: string | null };
type VersionRow = { id: string; source_id: string; curriculum_name: string; verification_status: string; effective_status: string; retrieved_at: string | null };
type SourceRow = { id: string; institution: string; name: string; source_tier: number; status: string };

export interface AiClassSummary {
  id: string; label: string; totalSubjects: number; targetJp: number; officialJp: number; targetFilledJp: number;
  missingTargetCount: number; newSubjectCount: number; reviewCount: number; completenessPercent: number;
  status: "ready" | "attention" | "blocked";
}
export interface AiIssue { id: string; severity: "high" | "medium" | "low"; title: string; description: string; action: string; subjectId?: string; subjectName?: string; suggestedJp?: number | null; }
export interface AiRecommendation { id: string; title: string; reason: string; impact: string; actionLabel: string; type: "target" | "adoption" | "review" | "info"; subjectId?: string; subjectName?: string; suggestedJp?: number | null; }
export interface AiCurriculumContext {
  academicContext: { id: string; tahunPelajaran: string; semester: string };
  source: { name: string; institution: string } | null;
  curriculum: { id: string; name: string; verificationStatus: string } | null;
  classes: AiClassSummary[];
  selectedClass: AiClassSummary | null;
  issues: AiIssue[];
  recommendations: AiRecommendation[];
  connectedData: string[];
}

async function getContext() {
  const supabase = await createClient();
  const contexts = await listAcademicContexts(supabase);
  const active = contexts.find((c) => c.isActive);
  if (!active) throw new Error("Konteks akademik aktif belum tersedia.");
  return { supabase, active };
}

function classLabel(row: ClassRow) { return `${row.tingkat} ${row.nama_rombel}`.trim(); }

function buildAnalysis(active: { id: string; tahunPelajaran: string; semester: string }, classes: ClassRow[], subjects: SubjectRow[], items: CurriculumItem[], adoptions: Adoption[], targets: TargetRow[], versions: VersionRow[], sources: SourceRow[], selectedClassId: string | null): AiCurriculumContext {
  const verifiedVersions = versions.filter((v) => v.verification_status === "verified" && v.effective_status !== "blocked");
  const version = verifiedVersions[0] ?? versions[0] ?? null;
  const source = version ? sources.find((s) => s.id === version.source_id) ?? null : null;
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const targetMap = new Map(targets.map((t) => [`${t.kelas_id}:${t.mata_pelajaran_id}`, t.target_jp]));
  const adoptionMap = new Map(adoptions.map((a) => [`${a.kelas_id}:${a.curriculum_item_id}`, a]));
  const eligibleItems = items.filter((i) => i.extraction_status === "verified" && i.derivation_status !== "blocked" && i.weekly_target != null);

  const summaries: AiClassSummary[] = classes.map((kelas) => {
    const classItems = eligibleItems.filter((i) => i.class_level === kelas.tingkat);
    const classAdoptions = adoptions.filter((a) => a.kelas_id === kelas.id);
    const classTargets = targets.filter((t) => t.kelas_id === kelas.id);
    const missingTargetCount = classAdoptions.filter((a) => a.school_target_jp == null && !targetMap.has(`${kelas.id}:${a.mata_pelajaran_id}`)).length;
    const targetJp = classTargets.reduce((n, t) => n + t.target_jp, 0);
    const officialJp = classItems.reduce((n, i) => n + (i.weekly_target ?? 0), 0);
    const targetFilledJp = classAdoptions.reduce((n, a) => n + (a.school_target_jp ?? targetMap.get(`${kelas.id}:${a.mata_pelajaran_id}`) ?? 0), 0);
    const newSubjectCount = classItems.filter((i) => !adoptionMap.has(`${kelas.id}:${i.id}`)).length;
    const reviewCount = classAdoptions.filter((a) => { const item = itemMap.get(a.curriculum_item_id); const target = targetMap.get(`${kelas.id}:${a.mata_pelajaran_id}`) ?? a.school_target_jp; return Boolean(item && target != null && item.weekly_target != null && target !== item.weekly_target); }).length;
    const denominator = officialJp || targetJp || 1;
    const completenessPercent = Math.min(100, Math.round((targetFilledJp / denominator) * 100));
    const status = missingTargetCount || newSubjectCount || reviewCount ? "attention" : targetJp > 0 ? "ready" : "blocked";
    return { id: kelas.id, label: classLabel(kelas), totalSubjects: classAdoptions.length, targetJp, officialJp, targetFilledJp, missingTargetCount, newSubjectCount, reviewCount, completenessPercent, status };
  });

  const selected = summaries.find((c) => c.id === selectedClassId) ?? summaries[0] ?? null;
  const issues: AiIssue[] = [];
  const recommendations: AiRecommendation[] = [];
  if (selected) {
    const classLevel = classes.find((c) => c.id === selected.id)?.tingkat;
    const classItems = eligibleItems.filter((i) => i.class_level === classLevel);
    const classAdoptions = adoptions.filter((a) => a.kelas_id === selected.id);
    const adoptedItemIds = new Set(classAdoptions.map((a) => a.curriculum_item_id));
    for (const item of classItems) {
      if (!adoptedItemIds.has(item.id)) {
        issues.push({ id: `new-${item.id}`, severity: "medium", title: `${item.subject_name} belum terhubung`, description: `Mapel ini tersedia pada kurikulum terverifikasi tetapi belum diadopsi ke ${selected.label}.`, action: "Hubungkan mapel", subjectId: item.id, subjectName: item.subject_name, suggestedJp: item.weekly_target });
        recommendations.push({ id: `adopt-${item.id}`, title: `Hubungkan ${item.subject_name}`, reason: "Item tersedia di sumber kurikulum terverifikasi dan belum masuk ke kelas ini.", impact: `Target resmi ${item.weekly_target ?? 0} JP akan tersedia untuk ditinjau.`, actionLabel: "Tinjau mapel", type: "adoption", subjectId: item.id, subjectName: item.subject_name, suggestedJp: item.weekly_target });
      }
    }
    for (const adoption of classAdoptions) {
      const item = itemMap.get(adoption.curriculum_item_id); if (!item) continue;
      const target = targetMap.get(`${selected.id}:${adoption.mata_pelajaran_id}`) ?? adoption.school_target_jp;
      if (target == null) {
        issues.push({ id: `target-${adoption.mata_pelajaran_id}`, severity: "high", title: `${item.subject_name} belum memiliki Target JP`, description: "Mapel sudah terhubung ke hasil kurikulum tetapi Target JP sekolah belum tersedia.", action: "Siapkan Target JP", subjectId: adoption.mata_pelajaran_id, subjectName: item.subject_name, suggestedJp: item.weekly_target });
        recommendations.push({ id: `target-${adoption.mata_pelajaran_id}`, title: `Atur Target JP ${item.subject_name}`, reason: `Kurikulum menyediakan ${item.weekly_target ?? 0} JP dan data kelas belum memiliki target sekolah.`, impact: `Target dapat disiapkan pada ${item.weekly_target ?? 0} JP tanpa membuat kurikulum baru.`, actionLabel: "Siapkan Target JP", type: "target", subjectId: adoption.mata_pelajaran_id, subjectName: item.subject_name, suggestedJp: item.weekly_target });
      } else if (item.weekly_target != null && target !== item.weekly_target) {
        issues.push({ id: `review-${adoption.mata_pelajaran_id}`, severity: "medium", title: `${item.subject_name} berbeda dari alokasi resmi`, description: `Target sekolah ${target} JP, sedangkan sumber kurikulum ${item.weekly_target} JP.`, action: "Tinjau perbedaan", subjectId: adoption.mata_pelajaran_id, subjectName: item.subject_name, suggestedJp: item.weekly_target });
        recommendations.push({ id: `review-${adoption.mata_pelajaran_id}`, title: `Tinjau ${item.subject_name}`, reason: `Ada selisih ${Math.abs(target - item.weekly_target)} JP dari alokasi resmi.`, impact: "Mencegah ketidaksesuaian antara integrasi kurikulum dan Target JP sekolah.", actionLabel: "Tinjau", type: "review", subjectId: adoption.mata_pelajaran_id, subjectName: item.subject_name, suggestedJp: item.weekly_target });
      }
    }
    if (!issues.length) recommendations.push({ id: "healthy", title: `${selected.label} sudah rapi`, reason: "Tidak ada kekurangan integrasi kurikulum yang terdeteksi pada data yang tersedia.", impact: "Tidak ada tindakan penting yang perlu dilakukan sekarang.", actionLabel: "Lihat ringkasan", type: "info" });
  }
  const severityOrder = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return { academicContext: { id: active.id, tahunPelajaran: active.tahunPelajaran, semester: active.semester }, source: source ? { name: source.name, institution: source.institution } : null, curriculum: version ? { id: version.id, name: version.curriculum_name, verificationStatus: version.verification_status } : null, classes: summaries, selectedClass: selected, issues: issues.slice(0, 8), recommendations: recommendations.slice(0, 6), connectedData: ["Konteks Akademik", "Kurikulum", "Sumber & Referensi", "Mata Pelajaran", "Integrasi Kurikulum", "Target JP"] };
}

export async function getAiCurriculumContextAction(selectedClassId?: string | null): Promise<AiActionResult<AiCurriculumContext>> {
  try {
    const { supabase, active } = await getContext();
    const [classesResult, subjectsResult, itemsResult, adoptionResult, targetResult, versionsResult, sourcesResult] = await Promise.all([
      supabase.from("kelas").select("id,tingkat,nama_rombel,tahun_ajaran,semester").eq("tahun_ajaran", active.tahunPelajaran).eq("semester", active.semester).order("tingkat").order("nama_rombel"),
      supabase.from("mata_pelajaran").select("id,nama,kode").order("nama"),
      supabase.from("curriculum_item").select("id,curriculum_version_id,subject_name,subject_code,class_level,weekly_target,official_allocation,derivation_status,extraction_status").order("class_level").order("subject_name"),
      supabase.from("curriculum_adoption").select("academic_context_id,kelas_id,mata_pelajaran_id,curriculum_item_id,official_target_jp,school_target_jp,status").eq("academic_context_id", active.id),
      supabase.from("target_jp").select("academic_context_id,kelas_id,mata_pelajaran_id,target_jp").eq("academic_context_id", active.id),
      supabase.from("curriculum_version").select("id,source_id,curriculum_name,verification_status,effective_status,retrieved_at").order("retrieved_at", { ascending: false }),
      supabase.from("curriculum_source").select("id,institution,name,source_tier,status").order("source_tier").order("name"),
    ]);
    for (const result of [classesResult, subjectsResult, itemsResult, adoptionResult, targetResult, versionsResult, sourcesResult]) if (result.error) throw new Error(result.error.message);
    return { ok: true, data: buildAnalysis(active, classesResult.data as ClassRow[], subjectsResult.data as SubjectRow[], itemsResult.data as CurriculumItem[], adoptionResult.data as Adoption[], targetResult.data as TargetRow[], versionsResult.data as VersionRow[], sourcesResult.data as SourceRow[], selectedClassId ?? null) };
  } catch (err) { return { ok: false, error: err instanceof Error ? err.message : "SAKALA AI belum dapat membaca integrasi kurikulum." }; }
}

export async function setAiTargetJpAction(input: { classId: string; subjectId: string; targetJp: number }): Promise<AiActionResult<{ targetJp: number }>> {
  try {
    if (!Number.isFinite(input.targetJp) || input.targetJp < 0) return { ok: false, error: "Target JP harus berupa angka 0 atau lebih." };
    const { supabase, active } = await getContext();
    const { error } = await supabase.from("target_jp").upsert({ academic_context_id: active.id, kelas_id: input.classId, mata_pelajaran_id: input.subjectId, target_jp: Math.round(input.targetJp) }, { onConflict: "academic_context_id,kelas_id,mata_pelajaran_id" });
    if (error) throw new Error(error.message);
    revalidatePath("/ai"); revalidatePath("/akademik/target-jp");
    return { ok: true, data: { targetJp: Math.round(input.targetJp) } };
  } catch (err) { return { ok: false, error: err instanceof Error ? err.message : "Target JP belum dapat diperbarui." }; }
}
