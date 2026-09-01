import type { SupabaseClient } from "@supabase/supabase-js";
import { listPembagianMengajar } from "@/lib/application/pembagianMengajar.usecases";
import { generateCandidatePreview } from "@/lib/application/candidateGenerator";
import { archiveOrDeleteAssignment } from "@/lib/application/scheduleAssignment.usecases";
import { publishAiScheduleAtomic } from "@/lib/application/aiSchedulePublish.usecases";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import type { GenerationRequirement } from "@/lib/domain/candidateGeneration";

// SAKALA AI Jadwal — operator-facing contract:
// 1 klik -> plan -> validate -> atomic publish -> read-back.
// Candidate/Commit tetap mekanisme internal; operator tidak perlu mengurusnya.
//
// SEGMENTASI PER KELAS (atas permintaan eksplisit operator, setelah insiden
// duplikasi & solver "batas 250.000 node tercapai"): SAKALA AI SELALU bekerja
// pada SATU kelas yang sedang aktif dilihat operator -- tidak pernah lintas
// kelas sekaligus. Ini menghilangkan risiko solver menyerah karena mencoba
// menyusun banyak kelas dalam satu pencarian raksasa (search space untuk 1
// kelas jauh lebih kecil daripada 3+ kelas sekaligus), dan operator selalu
// tahu persis kelas mana yang baru saja diubah AI.

export type AiFillScope = "class" | "class-replace";

export interface AiFillResult {
  placedCount: number;
  skippedCount: number;
  versionId: string | null;
  solverIncomplete: boolean;
  message: string;
  committedAssignmentIds: string[];
}

export async function undoAiScheduleFill(supabase: SupabaseClient, assignmentIds: string[]): Promise<{ undone: number }> {
  let undone = 0;
  for (const id of assignmentIds) {
    const result = await archiveOrDeleteAssignment(supabase, id, "ai", "Dibatalkan oleh operator lewat Undo SAKALA AI");
    if (result.archived) undone += 1;
  }
  return { undone };
}

async function getActiveVersionId(supabase: SupabaseClient, academicContextId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("schedule_version")
    .select("id")
    .eq("academic_context_id", academicContextId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Gagal membaca versi jadwal aktif: ${error.message}`);
  return data?.id ?? null;
}

async function buildClassRequirements(
  supabase: SupabaseClient,
  academicContextId: string,
  scheduleModelId: string,
  classId: string,
  treatAsEmpty: boolean
): Promise<{ requirements: GenerationRequirement[]; missingTeacherSubjectNames: string[] }> {
  const [pembagianList, targetResult, subjectResult] = await Promise.all([
    listPembagianMengajar(supabase, academicContextId),
    supabase
      .from("target_jp")
      .select("kelas_id,mata_pelajaran_id,target_jp")
      .eq("academic_context_id", academicContextId)
      .eq("kelas_id", classId),
    supabase.from("mata_pelajaran").select("id,nama"),
  ]);

  if (targetResult.error) throw new Error(`Gagal membaca Target JP resmi: ${targetResult.error.message}`);
  const subjectNameMap = new Map((subjectResult.data ?? []).map((s) => [s.id as string, s.nama as string]));
  const targets = (targetResult.data ?? [])
    .map((r) => ({ subjectId: r.mata_pelajaran_id as string, targetJp: Number(r.target_jp) }))
    .filter((r) => r.targetJp > 0);

  if (targets.length === 0) throw new Error("Belum ada Target JP resmi untuk kelas ini.");

  const alreadyScheduledMap = new Map<string, number>();
  if (!treatAsEmpty) {
    const allAssignments = await scheduleAssignmentRepository.findByContext(supabase, academicContextId);
    const activeVersionId = await getActiveVersionId(supabase, academicContextId);
    const activeCommitted = allAssignments.filter(
      (a) => a.status === "committed" && a.scheduleModelId === scheduleModelId && a.classId === classId && (activeVersionId ? a.versionId === activeVersionId : false)
    );
    for (const a of activeCommitted) {
      const jp = Math.max(1, a.periodEnd - a.periodStart + 1);
      alreadyScheduledMap.set(a.subjectId, (alreadyScheduledMap.get(a.subjectId) ?? 0) + jp);
    }
  }

  const requirements: GenerationRequirement[] = [];
  const missingTeacherSubjectNames: string[] = [];
  let reqIndex = 0;

  for (const target of targets) {
    const teacherAssignments = pembagianList
      .filter((p) => p.status === "aktif" && p.kelasId === classId && p.mataPelajaranId === target.subjectId)
      .sort((a, b) => (b.jpPerMinggu ?? 0) - (a.jpPerMinggu ?? 0));

    if (teacherAssignments.length === 0) {
      missingTeacherSubjectNames.push(subjectNameMap.get(target.subjectId) ?? target.subjectId);
      continue;
    }

    let remaining = Math.max(0, target.targetJp - (alreadyScheduledMap.get(target.subjectId) ?? 0));
    if (remaining <= 0) continue;

    for (const assignment of teacherAssignments) {
      if (remaining <= 0) break;
      const teacherCapacity = Math.max(0, assignment.jpPerMinggu ?? 0);
      if (teacherCapacity <= 0) continue;
      const allocated = Math.min(remaining, teacherCapacity);
      requirements.push({
        id: `ai_req_${++reqIndex}`,
        classId,
        subjectId: target.subjectId,
        teacherId: assignment.guruId,
        roomId: null,
        activityType: "belajar_mengajar",
        jpTarget: allocated,
      });
      remaining -= allocated;
    }
  }

  return { requirements, missingTeacherSubjectNames };
}

export async function runAiScheduleFill(
  supabase: SupabaseClient,
  params: { academicContextId: string; scheduleModelId: string; scope: AiFillScope; classId?: string }
): Promise<AiFillResult> {
  const { academicContextId, scheduleModelId, scope, classId } = params;
  if (!classId) {
    throw new Error("SAKALA AI Jadwal wajib dijalankan dalam konteks satu kelas. Pilih kelas dulu di pemilih Kelas.");
  }

  // "class-replace": arsipkan dulu jadwal committed kelas ini SAJA (kelas
  // lain tidak tersentuh sama sekali), baru generate seolah kelas ini kosong.
  // Publish tetap pakai mode 'fill' (append ke versi aktif) -- setelah
  // diarsipkan, tidak ada lagi baris kelas ini yang bisa bentrok, dan kelas
  // lain tetap dipertahankan sebagai constraint solver (guru/ruangan lintas
  // kelas tetap dicek).
  if (scope === "class-replace") {
    const allAssignments = await scheduleAssignmentRepository.findByContext(supabase, academicContextId);
    const inScope = allAssignments.filter(
      (a) => a.classId === classId && a.scheduleModelId === scheduleModelId && a.status === "committed"
    );
    for (const a of inScope) {
      await archiveOrDeleteAssignment(supabase, a.id, "ai", "Diarsipkan otomatis sebelum SAKALA AI menyusun ulang jadwal kelas ini");
    }
  }

  const built = await buildClassRequirements(supabase, academicContextId, scheduleModelId, classId, scope === "class-replace");
  const missingNote = built.missingTeacherSubjectNames.length > 0
    ? ` Catatan: ${built.missingTeacherSubjectNames.join(", ")} belum punya guru aktif di Pembagian Mengajar — lengkapi dulu di sana supaya AI bisa mengisi mata pelajaran itu juga.`
    : "";

  if (built.requirements.length === 0) {
    return {
      placedCount: 0,
      skippedCount: 0,
      versionId: null,
      solverIncomplete: built.missingTeacherSubjectNames.length > 0,
      message: built.missingTeacherSubjectNames.length > 0
        ? `Tidak ada yang bisa diisi AI untuk kelas ini.${missingNote}`
        : "Tidak ada kekurangan JP yang perlu diisi di kelas ini — semuanya sudah lengkap.",
      committedAssignmentIds: [],
    };
  }

  const preview = await generateCandidatePreview(supabase, academicContextId, scheduleModelId, built.requirements, {
    includeActiveExisting: true,
    committedOnly: true,
  });

  if (!preview.solver.complete || preview.candidates.length === 0) {
    const detail = preview.solver.failures.length > 0
      ? [...new Set(preview.solver.failures.map((f) => f.message))].slice(0, 3).join(" ")
      : "Tidak ditemukan susunan lengkap tanpa bentrok.";
    return {
      placedCount: 0,
      skippedCount: built.requirements.length,
      versionId: null,
      solverIncomplete: true,
      message: `SAKALA belum menemukan jadwal valid untuk kelas ini. Tidak ada perubahan. ${detail}${missingNote}`,
      committedAssignmentIds: [],
    };
  }

  const drafts = preview.candidates.map((c) => ({ ...c.draft, status: "candidate" as const, versionId: null }));
  const label = scope === "class-replace" ? "SAKALA AI — susun ulang kelas" : "SAKALA AI — lengkapi kelas";
  const changeSummary = scope === "class-replace"
    ? "Jadwal kelas ini disusun ulang oleh SAKALA AI setelah validasi penuh."
    : "Kekurangan jadwal kelas ini dilengkapi oleh SAKALA AI setelah validasi penuh.";

  const published = await publishAiScheduleAtomic(supabase, {
    academicContextId,
    scheduleModelId,
    drafts,
    label,
    changeSummary,
    mode: "fill",
  });

  const readBack = await Promise.all(published.assignmentIds.map((id) => scheduleAssignmentRepository.findById(supabase, id)));
  const verified = published.assignmentIds.length > 0 && readBack.every(
    (a) => a?.status === "committed" && a.versionId === published.versionId && a.scheduleModelId === scheduleModelId
  );
  if (!verified) throw new Error("SAKALA AI menulis jadwal tetapi verifikasi hasil gagal. Tidak ada status berhasil yang boleh ditampilkan.");

  return {
    placedCount: published.assignmentIds.length,
    skippedCount: 0,
    versionId: published.versionId,
    solverIncomplete: false,
    message: `AI berhasil menyusun ${published.assignmentIds.length} slot untuk kelas ini dan memverifikasi jadwal resmi.${missingNote}`,
    committedAssignmentIds: published.assignmentIds,
  };
}
