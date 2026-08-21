"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CurriculumInstitution } from "@/lib/domain/curriculumIntelligence";
import { recordAuditEvent } from "@/lib/application/auditLog.usecases";

export type CurriculumActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type CurriculumDraftCandidate = { itemId: string; manualTarget: number | null };

export interface CurriculumDraft {
  curriculumVersionId: string | null;
  level: string;
  classIds: string[];
  candidate: CurriculumDraftCandidate[];
  baseline: Record<string, number | null>;
  updatedAt: string;
}

// GENERATE-KURIKULUM-MASTER-UX-FLOW poin 11 (Persistence). Satu draft per
// Active Academic Context — dibaca saat workspace dibuka, ditulis (debounced
// dari client) tiap kali sumber/parameter/candidate berubah, dihapus setelah
// Commit berhasil supaya sesi berikutnya mulai bersih.
export async function getCurriculumDraftAction(academicContextId: string): Promise<CurriculumActionResult<CurriculumDraft | null>> {
  if (!academicContextId) return { ok: true, data: null };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("curriculum_generate_draft")
    .select("curriculum_version_id,level,class_ids,candidate,baseline,updated_at")
    .eq("academic_context_id", academicContextId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, data: null };
  return {
    ok: true,
    data: {
      curriculumVersionId: data.curriculum_version_id,
      level: data.level ?? "",
      classIds: data.class_ids ?? [],
      candidate: Array.isArray(data.candidate) ? data.candidate : [],
      baseline: (data.baseline as Record<string, number | null>) ?? {},
      updatedAt: data.updated_at,
    },
  };
}

export async function saveCurriculumDraftAction(input: {
  academicContextId: string;
  curriculumVersionId: string | null;
  level: string;
  classIds: string[];
  candidate: CurriculumDraftCandidate[];
  baseline: Record<string, number | null>;
}): Promise<CurriculumActionResult<null>> {
  if (!input.academicContextId) return { ok: false, error: "Academic Context wajib ada untuk menyimpan draft." };
  const supabase = await createClient();
  const { error } = await supabase.from("curriculum_generate_draft").upsert(
    {
      academic_context_id: input.academicContextId,
      curriculum_version_id: input.curriculumVersionId,
      level: input.level || null,
      class_ids: input.classIds,
      candidate: input.candidate,
      baseline: input.baseline,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "academic_context_id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function clearCurriculumDraftAction(academicContextId: string): Promise<CurriculumActionResult<null>> {
  if (!academicContextId) return { ok: true, data: null };
  const supabase = await createClient();
  const { error } = await supabase.from("curriculum_generate_draft").delete().eq("academic_context_id", academicContextId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

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
  const { data: context } = await supabase
    .from("academic_context")
    .select("id")
    .eq("id", input.academicContextId)
    .eq("is_active", true)
    .maybeSingle();
  if (!context) return { ok: false, error: "Hasil generate hanya boleh masuk ke Active Academic Context." };

  const selectedIds = Array.from(new Set(input.items.map((item) => item.id)));
  const { data: sourceItems, error: itemError } = await supabase
    .from("curriculum_item")
    .select("id,subject_name,subject_code,class_level,weekly_target,derivation_status,curriculum_version_id")
    .in("id", selectedIds);
  if (itemError) return { ok: false, error: itemError.message };
  if (!sourceItems?.length || sourceItems.length !== selectedIds.length) {
    return { ok: false, error: "Satu atau lebih item kurikulum tidak ditemukan. Silakan generate ulang dari sumber resmi." };
  }

  const versionIds = Array.from(new Set(sourceItems.map((item) => item.curriculum_version_id)));
  const { data: versions, error: versionError } = await supabase
    .from("curriculum_version")
    .select("id,source_id,verification_status,effective_status")
    .in("id", versionIds);
  if (versionError) return { ok: false, error: versionError.message };
  if (!versions?.length || versions.length !== versionIds.length) {
    return { ok: false, error: "Versi kurikulum sumber tidak ditemukan. Operasi diblokir." };
  }

  const versionMap = new Map(versions.map((version) => [version.id, version]));
  if (versions.some((version) => version.verification_status !== "verified")) {
    return { ok: false, error: "Regulasi sumber belum terverifikasi. SAKALA tidak akan memasukkan data yang belum verified." };
  }

  const sourceIds = Array.from(new Set(versions.map((version) => version.source_id)));
  const { data: sources, error: sourceError } = await supabase
    .from("curriculum_source")
    .select("id,source_tier,status")
    .in("id", sourceIds);
  if (sourceError) return { ok: false, error: sourceError.message };
  if (!sources?.length || sources.length !== sourceIds.length) {
    return { ok: false, error: "Source provenance tidak ditemukan. Operasi diblokir." };
  }
  if (sources.some((source) => source.source_tier > 1 || source.status !== "active")) {
    return { ok: false, error: "Item harus berasal dari sumber authority resmi yang aktif. Cross-check tidak dapat menjadi authority." };
  }

  const { data: classes, error: classError } = await supabase
    .from("kelas")
    .select("id,tingkat,nama_rombel")
    .in("id", input.classIds);
  if (classError) return { ok: false, error: classError.message };
  if (!classes?.length || classes.length !== input.classIds.length) {
    return { ok: false, error: "Satu atau lebih kelas yang dipilih tidak ditemukan." };
  }

  const classMap = new Map(classes.map((item) => [item.id, item]));
  const itemMap = new Map(sourceItems.map((item) => [item.id, item]));
  const selectionMap = new Map(input.items.map((item) => [item.id, item]));
  const rows: Array<Record<string, unknown>> = [];

  for (const classId of input.classIds) {
    const kelas = classMap.get(classId);
    if (!kelas) return { ok: false, error: "Kelas yang dipilih tidak ditemukan." };

    for (const itemId of selectedIds) {
      const item = itemMap.get(itemId);
      if (!item) return { ok: false, error: "Item kurikulum tidak ditemukan." };
      if (item.class_level !== kelas.tingkat) continue;
      if (item.derivation_status === "blocked" || item.weekly_target == null) continue;

      const version = versionMap.get(item.curriculum_version_id);
      if (!version || version.verification_status !== "verified") {
        return { ok: false, error: `Regulasi untuk ${item.subject_name} belum verified.` };
      }

      const { data: existingSubject, error: subjectLookupError } = await supabase
        .from("mata_pelajaran")
        .select("id,nama,kode")
        .eq("nama", item.subject_name)
        .maybeSingle();
      if (subjectLookupError) return { ok: false, error: subjectLookupError.message };

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

      const selectedTarget = selectionMap.get(item.id)?.weeklyTarget;
      const schoolTarget = selectedTarget ?? item.weekly_target;

      rows.push({
        academic_context_id: input.academicContextId,
        kelas_id: classId,
        mata_pelajaran_id: subjectId,
        curriculum_item_id: item.id,
        status: "selected",
        official_target_jp: item.weekly_target,
        school_target_jp: schoolTarget,
      });
    }
  }

  if (!rows.length) {
    return { ok: false, error: "Tidak ada item valid untuk kelas yang dipilih. Pastikan jenjang kelas sesuai dengan curriculum item dan target mingguan tervalidasi." };
  }

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

  // GENERATE-KURIKULUM-MASTER-UX-FLOW poin 17 (Audit Trail) — commit adalah
  // satu-satunya titik yang benar-benar mengubah data resmi, jadi ini yang
  // wajib tercatat: sumber apa, berapa item, ke kelas mana, kapan.
  await recordAuditEvent({
    supabase,
    academicContextId: input.academicContextId,
    action: "commit",
    entityType: "kurikulum",
    entityId: null,
    entityLabel: classes.map((c) => `${c.tingkat} ${c.nama_rombel}`).join(", "),
    before: null,
    after: { adoptedCount: rows.length, itemIds: selectedIds, classIds: input.classIds },
    source: "manual",
    reason: null,
  });

  revalidatePath("/akademik/mata-pelajaran");
  revalidatePath("/akademik/target-jp");
  return { ok: true, data: { adopted: rows.length } };
}

// GENERATE-KURIKULUM-MASTER-UX-FLOW poin 17 (Audit Trail) — Generate tidak
// mengubah data resmi (Generate ≠ Commit), tapi tetap dicatat sebagai jejak:
// kapan Candidate dibuat, dari sumber apa, berapa item.
export async function recordCurriculumGenerateEventAction(input: {
  academicContextId: string;
  curriculumVersionName: string;
  itemCount: number;
  classCount: number;
}): Promise<CurriculumActionResult<null>> {
  if (!input.academicContextId) return { ok: true, data: null };
  const supabase = await createClient();
  await recordAuditEvent({
    supabase,
    academicContextId: input.academicContextId,
    action: "generate",
    entityType: "kurikulum",
    entityId: null,
    entityLabel: input.curriculumVersionName,
    before: null,
    after: { itemCount: input.itemCount, classCount: input.classCount },
    source: "manual",
    reason: null,
  });
  return { ok: true, data: null };
}
