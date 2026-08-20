"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CurriculumInstitution } from "@/lib/domain/curriculumIntelligence";

export type CurriculumActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function getActiveAcademicContextAction() {
  const supabase = await createClient();
  const { data: contexts, error: contextError } = await supabase
    .from("academic_context")
    .select("id,tahun_pelajaran,semester,is_active")
    .order("is_active", { ascending: false })
    .order("tahun_pelajaran", { ascending: false });
  if (contextError) return { ok: false as const, error: contextError.message };
  const active = (contexts ?? []).find((context) => context.is_active) ?? null;
  if (!active) return { ok: true as const, data: { contexts: contexts ?? [], classes: [] } };
  const { data: classes, error: classError } = await supabase
    .from("kelas")
    .select("id,tingkat,nama_rombel,tahun_ajaran,semester")
    .eq("tahun_ajaran", active.tahun_pelajaran)
    .eq("semester", active.semester)
    .order("tingkat")
    .order("nama_rombel");
  if (classError) return { ok: false as const, error: classError.message };
  return { ok: true as const, data: { contexts: contexts ?? [], classes: classes ?? [] } };
}

export async function listCurriculumIntelligenceAction(institution: CurriculumInstitution | "all" = "all") {
  const supabase = await createClient();
  let sourceQuery = supabase.from("curriculum_source").select("*").order("source_tier").order("name");
  if (institution !== "all") sourceQuery = sourceQuery.eq("institution", institution);
  const { data: sources, error: sourceError } = await sourceQuery;
  if (sourceError) return { ok: false as const, error: sourceError.message };
  const { data: versions, error: versionError } = await supabase.from("curriculum_version").select("*").order("retrieved_at", { ascending: false });
  if (versionError) return { ok: false as const, error: versionError.message };
  const { data: items, error: itemError } = await supabase.from("curriculum_item").select("*").order("class_level").order("subject_name");
  if (itemError) return { ok: false as const, error: itemError.message };
  return { ok: true as const, data: { sources: sources ?? [], versions: versions ?? [], items: items ?? [] } };
}

export async function listAdoptedSubjectsAction(academicContextId: string): Promise<CurriculumActionResult<{
  rows: Array<{ id: string; kelasId: string; kelas: string; tingkat: string; subjectId: string; subject: string; kode: string | null; status: string; officialTarget: number | null; schoolTarget: number | null }>;
}>> {
  if (!academicContextId) return { ok: false, error: "Active Academic Context belum tersedia." };
  const supabase = await createClient();
  const { data: adoption, error } = await supabase
    .from("curriculum_adoption")
    .select("id,kelas_id,mata_pelajaran_id,status,official_target_jp,school_target_jp")
    .eq("academic_context_id", academicContextId)
    .order("kelas_id");
  if (error) return { ok: false, error: error.message };
  const classIds = Array.from(new Set((adoption ?? []).map((row) => row.kelas_id)));
  const subjectIds = Array.from(new Set((adoption ?? []).map((row) => row.mata_pelajaran_id)));
  const [{ data: classes, error: classError }, { data: subjects, error: subjectError }] = await Promise.all([
    classIds.length ? supabase.from("kelas").select("id,tingkat,nama_rombel").in("id", classIds) : Promise.resolve({ data: [], error: null }),
    subjectIds.length ? supabase.from("mata_pelajaran").select("id,nama,kode").in("id", subjectIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (classError) return { ok: false, error: classError.message };
  if (subjectError) return { ok: false, error: subjectError.message };
  const classMap = new Map((classes ?? []).map((row) => [row.id, row]));
  const subjectMap = new Map((subjects ?? []).map((row) => [row.id, row]));
  return {
    ok: true,
    data: {
      rows: (adoption ?? []).map((row) => {
        const klass = classMap.get(row.kelas_id);
        const subject = subjectMap.get(row.mata_pelajaran_id);
        return { id: row.id, kelasId: row.kelas_id, kelas: klass?.nama_rombel ?? "—", tingkat: klass?.tingkat ?? "—", subjectId: row.mata_pelajaran_id, subject: subject?.nama ?? "—", kode: subject?.kode ?? null, status: row.status, officialTarget: row.official_target_jp, schoolTarget: row.school_target_jp };
      }),
    },
  };
}

export async function adoptCurriculumItemsAction(input: { academicContextId: string; classIds: string[]; items: Array<{ id: string; weeklyTarget: number | null }>; }): Promise<CurriculumActionResult<{ adopted: number }>> {
  if (!input.academicContextId || input.classIds.length === 0 || input.items.length === 0) return { ok: false, error: "Academic Context, kelas, dan item kurikulum wajib dipilih." };
  const supabase = await createClient();
  const { data: context } = await supabase.from("academic_context").select("id").eq("id", input.academicContextId).eq("is_active", true).maybeSingle();
  if (!context) return { ok: false, error: "Hasil generate hanya boleh masuk ke Active Academic Context." };
  const selectedIds = Array.from(new Set(input.items.map((item) => item.id)));
  const { data: sourceItems, error: itemError } = await supabase.from("curriculum_item").select("id,subject_name,subject_code,class_level,weekly_target,derivation_status,curriculum_version_id").in("id", selectedIds);
  if (itemError) return { ok: false, error: itemError.message };
  if (!sourceItems?.length || sourceItems.length !== selectedIds.length) return { ok: false, error: "Satu atau lebih item kurikulum tidak ditemukan. Silakan generate ulang dari sumber resmi." };
  const versionIds = Array.from(new Set(sourceItems.map((item) => item.curriculum_version_id)));
  const { data: versions, error: versionError } = await supabase.from("curriculum_version").select("id,source_id,verification_status,effective_status").in("id", versionIds);
  if (versionError) return { ok: false, error: versionError.message };
  if (!versions?.length || versions.length !== versionIds.length) return { ok: false, error: "Versi kurikulum sumber tidak ditemukan. Operasi diblokir." };
  if (versions.some((version) => version.verification_status !== "verified")) return { ok: false, error: "Regulasi sumber belum terverifikasi. SAKALA tidak akan memasukkan data yang belum verified." };
  const sourceIds = Array.from(new Set(versions.map((version) => version.source_id)));
  const { data: sources, error: sourceError } = await supabase.from("curriculum_source").select("id,source_tier,status").in("id", sourceIds);
  if (sourceError) return { ok: false, error: sourceError.message };
  if (!sources?.length || sources.length !== sourceIds.length) return { ok: false, error: "Source provenance tidak ditemukan. Operasi diblokir." };
  if (sources.some((source) => source.source_tier > 1 || source.status !== "active")) return { ok: false, error: "Item harus berasal dari authority resmi yang aktif." };
  const { data: classes, error: classError } = await supabase.from("kelas").select("id,tingkat,nama_rombel").in("id", input.classIds);
  if (classError) return { ok: false, error: classError.message };
  if (!classes?.length || classes.length !== input.classIds.length) return { ok: false, error: "Satu atau lebih kelas yang dipilih tidak ditemukan." };
  const classMap = new Map(classes.map((item) => [item.id, item]));
  const itemMap = new Map(sourceItems.map((item) => [item.id, item]));
  const selectionMap = new Map(input.items.map((item) => [item.id, item]));
  const rows: Array<Record<string, unknown>> = [];
  for (const classId of input.classIds) {
    const kelas = classMap.get(classId);
    for (const itemId of selectedIds) {
      const item = itemMap.get(itemId);
      if (!kelas || !item || item.class_level !== kelas.tingkat || item.derivation_status === "blocked" || item.weekly_target == null) continue;
      const existingSubject = await supabase.from("mata_pelajaran").select("id").eq("nama", item.subject_name).maybeSingle();
      if (existingSubject.error) return { ok: false, error: existingSubject.error.message };
      let subjectId = existingSubject.data?.id;
      if (!subjectId) {
        const created = await supabase.from("mata_pelajaran").insert({ nama: item.subject_name, kode: item.subject_code, status: "aktif" }).select("id").single();
        if (created.error) return { ok: false, error: created.error.message };
        subjectId = created.data.id;
      }
      rows.push({ academic_context_id: input.academicContextId, kelas_id: classId, mata_pelajaran_id: subjectId, curriculum_item_id: item.id, status: "selected", official_target_jp: item.weekly_target, school_target_jp: selectionMap.get(item.id)?.weeklyTarget ?? item.weekly_target });
    }
  }
  if (!rows.length) return { ok: false, error: "Tidak ada item valid untuk kelas yang dipilih." };
  const { error: adoptionError } = await supabase.from("curriculum_adoption").upsert(rows, { onConflict: "academic_context_id,kelas_id,mata_pelajaran_id,curriculum_item_id" });
  if (adoptionError) return { ok: false, error: adoptionError.message };
  const targetRows = rows.filter((row) => typeof row.school_target_jp === "number").map((row) => ({ academic_context_id: row.academic_context_id, kelas_id: row.kelas_id, mata_pelajaran_id: row.mata_pelajaran_id, target_jp: Math.round(Number(row.school_target_jp)) }));
  if (targetRows.length) {
    const { error: targetError } = await supabase.from("target_jp").upsert(targetRows, { onConflict: "academic_context_id,kelas_id,mata_pelajaran_id" });
    if (targetError) return { ok: false, error: targetError.message };
  }
  revalidatePath("/akademik/mata-pelajaran");
  revalidatePath("/akademik/target-jp");
  return { ok: true, data: { adopted: rows.length } };
}
