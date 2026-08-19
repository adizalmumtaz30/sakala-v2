"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CurriculumInstitution } from "@/lib/domain/curriculumIntelligence";

export type CurriculumActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function listCurriculumIntelligenceAction(institution: CurriculumInstitution | "all" = "all") {
  const supabase = await createClient();
  let sourceQuery = supabase.from("curriculum_source").select("*").order("source_tier").order("name");
  if (institution !== "all") sourceQuery = sourceQuery.eq("institution", institution);
  const { data: sources, error: sourceError } = await sourceQuery;
  if (sourceError) return { ok: false as const, error: sourceError.message };

  const { data: versions, error: versionError } = await supabase
    .from("curriculum_version")
    .select("*")
    .order("retrieved_at", { ascending: false });
  if (versionError) return { ok: false as const, error: versionError.message };

  const { data: items, error: itemError } = await supabase
    .from("curriculum_item")
    .select("*")
    .order("class_level")
    .order("subject_name");
  if (itemError) return { ok: false as const, error: itemError.message };

  return { ok: true as const, data: { sources: sources ?? [], versions: versions ?? [], items: items ?? [] } };
}

export async function adoptCurriculumItemsAction(input: {
  academicContextId: string;
  classIds: string[];
  items: Array<{ id: string; weeklyTarget: number | null }>;
}): Promise<CurriculumActionResult<{ adopted: number }>> {
  if (!input.academicContextId || input.classIds.length === 0 || input.items.length === 0) {
    return { ok: false, error: "Academic Context, kelas, dan item kurikulum wajib dipilih." };
  }

  const supabase = await createClient();
  const { data: context } = await supabase.from("academic_context").select("id").eq("id", input.academicContextId).eq("is_active", true).maybeSingle();
  if (!context) return { ok: false, error: "Hasil generate hanya boleh masuk ke Active Academic Context." };

  const { data: sourceItems, error: itemError } = await supabase
    .from("curriculum_item")
    .select("id,subject_name,subject_code,class_level,weekly_target,derivation_status,curriculum_version_id")
    .in("id", input.items.map((item) => item.id));
  if (itemError) return { ok: false, error: itemError.message };
  if (!sourceItems?.length) return { ok: false, error: "Item kurikulum tidak ditemukan." };

  const { data: classes, error: classError } = await supabase.from("kelas").select("id,tingkat,nama_rombel").in("id", input.classIds);
  if (classError) return { ok: false, error: classError.message };

  const classMap = new Map((classes ?? []).map((item) => [item.id, item]));
  const itemMap = new Map(sourceItems.map((item) => [item.id, item]));
  const rows: Array<Record<string, unknown>> = [];

  for (const classId of input.classIds) {
    const kelas = classMap.get(classId);
    if (!kelas) return { ok: false, error: "Kelas yang dipilih tidak ditemukan." };
    for (const selection of input.items) {
      const item = itemMap.get(selection.id);
      if (!item) continue;
      if (item.class_level !== kelas.tingkat) continue;
      if (item.derivation_status === "blocked" || item.weekly_target == null) continue;

      const { data: existingSubject } = await supabase
        .from("mata_pelajaran")
        .select("id,nama,kode")
        .eq("nama", item.subject_name)
        .maybeSingle();

      let subjectId = existingSubject?.id;
      if (!subjectId) {
        const { data: createdSubject, error: subjectError } = await supabase
          .from("mata_pelajaran")
          .insert({ nama: item.subject_name, kode: item.subject_code, status: "aktif" })
          .select("id")
          .single();
        if (subjectError) return { ok: false, error: subjectError.message };
        subjectId = createdSubject.id;
      }

      rows.push({
        academic_context_id: input.academicContextId,
        kelas_id: classId,
        mata_pelajaran_id: subjectId,
        curriculum_item_id: item.id,
        status: "selected",
        official_target_jp: item.weekly_target,
        school_target_jp: selection.weeklyTarget ?? item.weekly_target,
      });
    }
  }

  if (!rows.length) return { ok: false, error: "Tidak ada item valid untuk kelas yang dipilih. Pastikan item memiliki target mingguan yang tervalidasi." };

  const { error: adoptionError } = await supabase.from("curriculum_adoption").upsert(rows, {
    onConflict: "academic_context_id,kelas_id,mata_pelajaran_id,curriculum_item_id",
  });
  if (adoptionError) return { ok: false, error: adoptionError.message };

  const targetRows = rows
    .filter((row) => typeof row.school_target_jp === "number")
    .map((row) => ({
      academic_context_id: row.academic_context_id,
      kelas_id: row.kelas_id,
      mata_pelajaran_id: row.mata_pelajaran_id,
      target_jp: Math.round(Number(row.school_target_jp)),
    }));

  if (targetRows.length) {
    const { error: targetError } = await supabase.from("target_jp").upsert(targetRows, {
      onConflict: "academic_context_id,kelas_id,mata_pelajaran_id",
    });
    if (targetError) return { ok: false, error: targetError.message };
  }

  revalidatePath("/akademik/mata-pelajaran");
  revalidatePath("/akademik/target-jp");
  return { ok: true, data: { adopted: rows.length } };
}
