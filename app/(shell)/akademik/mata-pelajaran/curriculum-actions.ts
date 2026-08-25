"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CurriculumInstitution } from "@/lib/domain/curriculumIntelligence";
import { recordAuditEvent } from "@/lib/application/auditLog.usecases";
import { toPlainDatabaseError } from "@/lib/utils/databaseError";

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
  if (error) return { ok: false, error: toPlainDatabaseError(error) };
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
  if (error) return { ok: false, error: toPlainDatabaseError(error) };
  return { ok: true, data: null };
}

export async function clearCurriculumDraftAction(academicContextId: string): Promise<CurriculumActionResult<null>> {
  if (!academicContextId) return { ok: true, data: null };
  const supabase = await createClient();
  const { error } = await supabase.from("curriculum_generate_draft").delete().eq("academic_context_id", academicContextId);
  if (error) return { ok: false, error: toPlainDatabaseError(error) };
  return { ok: true, data: null };
}

// V4 poin: tombol hapus untuk sumber lama & baru. Hapus di level source: hapus
// versi (cascade ke item) dulu, baru source-nya sendiri, supaya tidak
// melanggar FK restrict curriculum_version.source_id. Kalau source pernah
// dipakai lewat curriculum_adoption (FK restrict curriculum_item_id), Postgres
// menolak — ditangkap dan diberi pesan yang bisa dipahami operator, bukan
// error teknis Postgres.
export async function deleteCurriculumSourceAction(sourceId: string): Promise<CurriculumActionResult<null>> {
  const supabase = await createClient();
  const { data: versions, error: vErr } = await supabase.from("curriculum_version").select("id").eq("source_id", sourceId);
  if (vErr) return { ok: false, error: toPlainDatabaseError(vErr) };
  const versionIds = (versions ?? []).map((v: { id: string }) => v.id);
  if (versionIds.length) {
    const { error: delVErr } = await supabase.from("curriculum_version").delete().in("id", versionIds);
    if (delVErr) {
      if (delVErr.code === "23503") return { ok: false, error: "Sumber ini sudah dipakai di kurikulum resmi (pernah di-Commit), tidak bisa dihapus." };
      return { ok: false, error: delVErr.message };
    }
  }
  const { error: delSErr } = await supabase.from("curriculum_source").delete().eq("id", sourceId);
  if (delSErr) {
    if (delSErr.code === "23503") return { ok: false, error: "Sumber ini sudah dipakai di kurikulum resmi (pernah di-Commit), tidak bisa dihapus." };
    return { ok: false, error: delSErr.message };
  }
  revalidatePath("/akademik/generate-kurikulum");
  return { ok: true, data: null };
}
// ============================================================================
// Import Sumber Baru dari PDF — ekstraksi teks gratis (pdf-parse), tanpa API
// berbayar. Heuristik regex mencari baris "<nama mapel> ... <angka> JP", jadi
// akurasinya TIDAK sekuat model AI — karena itu hasilnya selalu masuk sebagai
// source_tier 2 (bukan 1) dan status 'unverified', supaya tetap diblokir dari
// Commit (lihat guard di adoptCurriculumItemsAction) sampai admin meninjau
// dan mempromosikannya lewat promoteCurriculumSourceToOfficialAction.
// ============================================================================

export interface ExtractedCurriculumRow {
  subjectName: string;
  weeklyTarget: number;
}

export async function extractCurriculumPdfAction(formData: FormData): Promise<CurriculumActionResult<{ fileName: string; rows: ExtractedCurriculumRow[]; rawTextPreview: string }>> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "File PDF tidak ditemukan." };
  if (file.type !== "application/pdf") return { ok: false, error: "Hanya file PDF yang didukung." };

  let text: string;
  try {
    const { PDFParse } = await import("pdf-parse");
    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    text = result.text ?? "";
  } catch {
    return { ok: false, error: "Sumber belum dapat dibaca. Periksa file lalu coba lagi." };
  }

  if (!text.trim()) return { ok: false, error: "Tidak ada teks yang bisa diekstrak dari PDF ini (kemungkinan hasil scan/gambar)." };

  // Heuristik baris: "<teks mapel> ... <angka 1-2 digit>" opsional diikuti
  // "JP"/"jam". Baris yang cocok pola tabel resmi kurikulum yang lazim.
  const lines = text.split(/\r?\n/);
  const rowPattern = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'()/-]{2,60}?)\s*[:\-.]?\s*(\d{1,2})\s*(?:jp|jam)?\s*$/i;
  const rows: ExtractedCurriculumRow[] = [];
  const seen = new Set<string>();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(rowPattern);
    if (!match) continue;
    const subjectName = match[1].trim().replace(/\s{2,}/g, " ");
    const weeklyTarget = Number(match[2]);
    if (subjectName.length < 3 || weeklyTarget < 1 || weeklyTarget > 60) continue;
    const key = subjectName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ subjectName, weeklyTarget });
  }

  return { ok: true, data: { fileName: file.name, rows, rawTextPreview: text.slice(0, 400) } };
}

export async function saveExtractedCurriculumSourceAction(input: {
  fileName: string;
  institution: "Kemenag" | "Kemendikdasmen";
  classLevel: string;
  rows: ExtractedCurriculumRow[];
}): Promise<CurriculumActionResult<{ versionId: string }>> {
  if (!input.rows.length) return { ok: false, error: "Tidak ada baris yang dikonfirmasi untuk disimpan." };
  const supabase = await createClient();
  const institutionCode = input.institution === "Kemenag" ? "kementerian_agama" : "kemendikdasmen";
  const officialUrl = `internal-upload://${input.fileName}-${Date.now()}`;

  const { data: source, error: sourceError } = await supabase
    .from("curriculum_source")
    .insert({
      institution: institutionCode,
      source_tier: 2, // Bukan tier 1 (authority resmi) — hasil ekstraksi mandiri, bukan link regulasi pemerintah.
      source_type: "pdf_upload",
      name: input.fileName,
      official_url: officialUrl,
      status: "unverified",
      notes: "Diimpor lewat ekstraksi PDF gratis (heuristik, bukan AI) — perlu ditinjau admin sebelum bisa dipakai untuk Commit.",
    })
    .select("id")
    .single();
  if (sourceError) return { ok: false, error: toPlainDatabaseError(sourceError) };

  const { data: version, error: versionError } = await supabase
    .from("curriculum_version")
    .insert({
      source_id: source.id,
      curriculum_name: input.fileName.replace(/\.pdf$/i, ""),
      issuing_institution: input.institution,
      effective_status: "unknown",
      version_key: `upload-${source.id}`,
      verification_status: "unverified",
    })
    .select("id")
    .single();
  if (versionError) return { ok: false, error: toPlainDatabaseError(versionError) };

  const itemRows = input.rows.map((row) => ({
    curriculum_version_id: version.id,
    subject_name: row.subjectName,
    class_level: input.classLevel,
    allocation_type: "weekly" as const,
    official_allocation: row.weeklyTarget,
    weekly_target: row.weeklyTarget,
    derivation_status: "not_derived" as const,
    derivation_method: "Ekstraksi PDF heuristik (pdf-parse, tanpa AI)",
    category: "wajib" as const,
    extraction_status: "unverified" as const,
  }));
  const { error: itemError } = await supabase.from("curriculum_item").insert(itemRows);
  if (itemError) return { ok: false, error: toPlainDatabaseError(itemError) };

  revalidatePath("/akademik/generate-kurikulum");
  return { ok: true, data: { versionId: version.id } };
}

// Promosi manual jadi authority resmi — satu-satunya cara sumber upload bisa
// dipakai untuk Commit (menegakkan "Cross-check tidak dapat menjadi
// authority" tanpa terkecuali; harus eksplisit ditinjau manusia).
export async function promoteCurriculumSourceToOfficialAction(sourceId: string): Promise<CurriculumActionResult<null>> {
  const supabase = await createClient();
  const { error: sourceError } = await supabase.from("curriculum_source").update({ source_tier: 1, status: "official", last_verified_at: new Date().toISOString() }).eq("id", sourceId);
  if (sourceError) return { ok: false, error: toPlainDatabaseError(sourceError) };

  const { data: versions, error: vErr } = await supabase.from("curriculum_version").select("id").eq("source_id", sourceId);
  if (vErr) return { ok: false, error: toPlainDatabaseError(vErr) };
  const versionIds = (versions ?? []).map((v: { id: string }) => v.id);
  if (versionIds.length) {
    const { error: updVErr } = await supabase.from("curriculum_version").update({ verification_status: "verified", effective_status: "berlaku", verified_at: new Date().toISOString() }).in("id", versionIds);
    if (updVErr) return { ok: false, error: toPlainDatabaseError(updVErr) };
    const { error: updIErr } = await supabase.from("curriculum_item").update({ extraction_status: "verified" }).in("curriculum_version_id", versionIds);
    if (updIErr) return { ok: false, error: toPlainDatabaseError(updIErr) };
  }
  revalidatePath("/akademik/generate-kurikulum");
  return { ok: true, data: null };
}

export async function getActiveAcademicContextAction() {
  const supabase = await createClient();
  const { data: contexts, error: contextError } = await supabase
    .from("academic_context")
    .select("id,tahun_pelajaran,semester,is_active")
    .order("is_active", { ascending: false })
    .order("tahun_pelajaran", { ascending: false });
  if (contextError) return { ok: false as const, error: toPlainDatabaseError(contextError) };

  const active = (contexts ?? []).find((context) => context.is_active) ?? null;
  if (!active) return { ok: true as const, data: { contexts: contexts ?? [], classes: [] } };

  const { data: classes, error: classError } = await supabase
    .from("kelas")
    .select("id,tingkat,nama_rombel,tahun_ajaran,semester")
    .eq("tahun_ajaran", active.tahun_pelajaran)
    .eq("semester", active.semester)
    .order("tingkat")
    .order("nama_rombel");
  if (classError) return { ok: false as const, error: toPlainDatabaseError(classError) };

  return { ok: true as const, data: { contexts: contexts ?? [], classes: classes ?? [] } };
}

export async function listCurriculumIntelligenceAction(institution: CurriculumInstitution | "all" = "all") {
  const supabase = await createClient();
  let sourceQuery = supabase.from("curriculum_source").select("*").order("source_tier").order("name");
  if (institution !== "all") sourceQuery = sourceQuery.eq("institution", institution);
  const { data: sources, error: sourceError } = await sourceQuery;
  if (sourceError) return { ok: false as const, error: toPlainDatabaseError(sourceError) };

  const { data: versions, error: versionError } = await supabase
    .from("curriculum_version")
    .select("*")
    .order("retrieved_at", { ascending: false });
  if (versionError) return { ok: false as const, error: toPlainDatabaseError(versionError) };

  const { data: items, error: itemError } = await supabase
    .from("curriculum_item")
    .select("*")
    .order("class_level")
    .order("subject_name");
  if (itemError) return { ok: false as const, error: toPlainDatabaseError(itemError) };

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
  if (itemError) return { ok: false, error: toPlainDatabaseError(itemError) };
  if (!sourceItems?.length || sourceItems.length !== selectedIds.length) {
    return { ok: false, error: "Satu atau lebih item kurikulum tidak ditemukan. Silakan generate ulang dari sumber resmi." };
  }

  const versionIds = Array.from(new Set(sourceItems.map((item) => item.curriculum_version_id)));
  const { data: versions, error: versionError } = await supabase
    .from("curriculum_version")
    .select("id,source_id,verification_status,effective_status")
    .in("id", versionIds);
  if (versionError) return { ok: false, error: toPlainDatabaseError(versionError) };
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
  if (sourceError) return { ok: false, error: toPlainDatabaseError(sourceError) };
  if (!sources?.length || sources.length !== sourceIds.length) {
    return { ok: false, error: "Source provenance tidak ditemukan. Operasi diblokir." };
  }
  // BUG KRITIS (dilaporkan user): kondisi ini sebelumnya membandingkan
  // source.status dengan "active" — nilai yang TIDAK PERNAH bisa ada, karena
  // check constraint tabel curriculum_source cuma mengizinkan
  // 'official' | 'unverified' | 'stale' | 'blocked'. Akibatnya kondisi ini
  // SELALU true untuk SEMUA sumber, jadi setiap Commit selalu diblokir tanpa
  // terkecuali — persis walau UI sudah menampilkan semua ceklis hijau/valid,
  // karena validasi client sama sekali tidak mengecek source_tier/status ini.
  // Nilai yang benar untuk sumber authority tier-1 resmi adalah "official".
  if (sources.some((source) => source.source_tier > 1 || source.status !== "official")) {
    return { ok: false, error: "Item harus berasal dari sumber authority resmi yang aktif. Cross-check tidak dapat menjadi authority." };
  }

  const { data: classes, error: classError } = await supabase
    .from("kelas")
    .select("id,tingkat,nama_rombel")
    .in("id", input.classIds);
  if (classError) return { ok: false, error: toPlainDatabaseError(classError) };
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
      if (subjectLookupError) return { ok: false, error: toPlainDatabaseError(subjectLookupError) };

      let subjectId = existingSubject?.id;
      if (!subjectId) {
        const { data: createdSubject, error: subjectError } = await supabase
          .from("mata_pelajaran")
          .insert({ nama: item.subject_name, kode: item.subject_code, status: "aktif" })
          .select("id")
          .single();
        if (subjectError) return { ok: false, error: toPlainDatabaseError(subjectError) };
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
  if (adoptionError) return { ok: false, error: toPlainDatabaseError(adoptionError) };

  const targetRows = rows
    .filter((row) => typeof row.school_target_jp === "number")
    .map((row) => ({
      academic_context_id: row.academic_context_id,
      kelas_id: row.kelas_id,
      mata_pelajaran_id: row.mata_pelajaran_id,
      target_jp: Math.round(Number(row.school_target_jp)),
    }));

  // Baca nilai LAMA sebelum menulis — supaya audit trail punya before/after
  // yang nyata, bukan cuma jumlah baris (kontrak: evidence harus konkret).
  let beforeMap = new Map<string, number>();
  if (targetRows.length) {
    const { data: beforeRows } = await supabase
      .from("target_jp")
      .select("kelas_id,mata_pelajaran_id,target_jp")
      .eq("academic_context_id", input.academicContextId)
      .in("kelas_id", input.classIds);
    beforeMap = new Map((beforeRows ?? []).map((r) => [`${r.kelas_id}:${r.mata_pelajaran_id}`, r.target_jp]));
  }

  if (targetRows.length) {
    const { error: targetError } = await supabase.from("target_jp").upsert(targetRows, {
      onConflict: "academic_context_id,kelas_id,mata_pelajaran_id",
    });
    if (targetError) return { ok: false, error: toPlainDatabaseError(targetError) };

    // SAKALA MASTER RULE (Read-Back): target_jp adalah authority resmi yang
    // dipakai di seluruh app (halaman Target JP, SAKALA AI, Analitik) — tidak
    // cukup cuma cek upsert() tidak error. Baca ulang baris yang baru saja
    // ditulis dan cocokkan nilainya persis, sebelum mengklaim berhasil.
    const { data: verifyRows, error: verifyError } = await supabase
      .from("target_jp")
      .select("kelas_id,mata_pelajaran_id,target_jp")
      .eq("academic_context_id", input.academicContextId)
      .in("kelas_id", input.classIds);
    if (verifyError) return { ok: false, error: `Commit tidak dapat dipastikan tersimpan: ${verifyError.message}` };

    const verifyMap = new Map((verifyRows ?? []).map((r) => [`${r.kelas_id}:${r.mata_pelajaran_id}`, r.target_jp]));
    const mismatched = targetRows.filter((t) => verifyMap.get(`${t.kelas_id}:${t.mata_pelajaran_id}`) !== t.target_jp);
    if (mismatched.length > 0) {
      return { ok: false, error: `Commit belum bisa dipastikan tersimpan dengan benar untuk ${mismatched.length} kombinasi Kelas+Mapel. Data resmi belum mencerminkan perubahan ini — coba lagi sebelum melanjutkan.` };
    }
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
    before: { targetJp: Object.fromEntries(beforeMap) },
    after: { adoptedCount: rows.length, itemIds: selectedIds, classIds: input.classIds, targetJp: Object.fromEntries(targetRows.map((t) => [`${t.kelas_id}:${t.mata_pelajaran_id}`, t.target_jp])) },
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

// GENERATE-KURIKULUM-MASTER-UX/UI-V4 poin 31 (Data Tidak Ditemukan) — mata
// pelajaran yang sebelumnya sudah di-Commit (curriculum_adoption) untuk
// konteks ini, dipakai client untuk mendeteksi kalau ada yang hilang dari
// hasil Generate terbaru. Tidak menghapus apapun — adoptCurriculumItemsAction
// selalu upsert, jadi baris lama tetap ada; ini murni sinyal untuk ditinjau.
export async function getPreviouslyAdoptedSubjectsAction(academicContextId: string): Promise<CurriculumActionResult<{ subjectName: string; classLevel: string }[]>> {
  if (!academicContextId) return { ok: true, data: [] };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("curriculum_adoption")
    .select("curriculum_item:curriculum_item_id(subject_name,class_level)")
    .eq("academic_context_id", academicContextId);
  if (error) return { ok: false, error: toPlainDatabaseError(error) };
  const seen = new Set<string>();
  const result: { subjectName: string; classLevel: string }[] = [];
  for (const row of data ?? []) {
    const item = row.curriculum_item as unknown as { subject_name: string; class_level: string } | null;
    if (!item) continue;
    const key = `${item.subject_name}::${item.class_level}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ subjectName: item.subject_name, classLevel: item.class_level });
  }
  return { ok: true, data: result };
}
