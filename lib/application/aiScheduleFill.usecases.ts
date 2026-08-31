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
// Full-week membangun ulang seluruh target resmi hanya bila seluruh kebutuhan
// punya guru aktif. Jika data dasar belum lengkap, tidak ada mutation sama sekali.
// Fill/class hanya menambah kekurangan pada active committed version.

export type AiFillScope = "class" | "empty" | "full-week";

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

async function buildRequirements(
  supabase: SupabaseClient,
  academicContextId: string,
  scheduleModelId: string,
  scope: AiFillScope,
  classId?: string,
): Promise<{ requirements: GenerationRequirement[]; totalTargetJp: number; currentCommittedJp: number; missingTeacher: string[] }> {
  const [pembagianList, targetResult, activeVersionId] = await Promise.all([
    listPembagianMengajar(supabase, academicContextId),
    supabase
      .from("target_jp")
      .select("kelas_id,mata_pelajaran_id,target_jp")
      .eq("academic_context_id", academicContextId),
    getActiveVersionId(supabase, academicContextId),
  ]);

  if (targetResult.error) throw new Error(`Gagal membaca Target JP resmi: ${targetResult.error.message}`);
  const targets = (targetResult.data ?? []).map((r) => ({
    classId: r.kelas_id as string,
    subjectId: r.mata_pelajaran_id as string,
    targetJp: Number(r.target_jp),
  })).filter((r) => r.targetJp > 0);

  if (targets.length === 0) throw new Error("Belum ada Target JP resmi pada konteks akademik aktif.");

  const scopedTargets = scope === "class" && classId
    ? targets.filter((t) => t.classId === classId)
    : targets;
  if (scopedTargets.length === 0) throw new Error("Tidak ada Target JP untuk kelas yang dipilih.");

  const allAssignments = await scheduleAssignmentRepository.findByContext(supabase, academicContextId);
  const activeCommitted = allAssignments.filter((a) =>
    a.status === "committed" &&
    a.scheduleModelId === scheduleModelId &&
    (scope === "full-week" ? true : (activeVersionId ? a.versionId === activeVersionId : false))
  );

  const currentCommittedJp = activeCommitted.reduce((sum, a) => sum + Math.max(1, a.periodEnd - a.periodStart + 1), 0);
  const requirements: GenerationRequirement[] = [];
  const missingTeacher: string[] = [];
  let totalTargetJp = 0;
  let reqIndex = 0;

  for (const target of scopedTargets) {
    totalTargetJp += target.targetJp;
    const teacherAssignments = pembagianList
      .filter((p) => p.status === "aktif" && p.kelasId === target.classId && p.mataPelajaranId === target.subjectId)
      .sort((a, b) => (b.jpPerMinggu ?? 0) - (a.jpPerMinggu ?? 0));

    if (teacherAssignments.length === 0) {
      missingTeacher.push(`${target.classId}:${target.subjectId}`);
      continue;
    }

    const alreadyScheduled = activeCommitted
      .filter((a) => a.classId === target.classId && a.subjectId === target.subjectId)
      .reduce((sum, a) => sum + Math.max(1, a.periodEnd - a.periodStart + 1), 0);

    let remaining = scope === "full-week" ? target.targetJp : Math.max(0, target.targetJp - alreadyScheduled);
    if (remaining <= 0) continue;

    for (const assignment of teacherAssignments) {
      if (remaining <= 0) break;
      const teacherCapacity = Math.max(0, assignment.jpPerMinggu ?? 0);
      if (teacherCapacity <= 0) continue;
      const allocated = Math.min(remaining, teacherCapacity);
      requirements.push({
        id: `ai_req_${++reqIndex}`,
        classId: target.classId,
        subjectId: target.subjectId,
        teacherId: assignment.guruId,
        roomId: null,
        activityType: "belajar_mengajar",
        jpTarget: allocated,
      });
      remaining -= allocated;
    }
  }

  // Full-week is all-or-nothing at the preflight stage. Never archive or
  // replace the current schedule when a required teacher mapping is missing.
  if (missingTeacher.length > 0 && scope === "full-week") {
    return {
      requirements: [],
      totalTargetJp,
      currentCommittedJp,
      missingTeacher,
    };
  }

  return { requirements, totalTargetJp, currentCommittedJp, missingTeacher };
}

export async function runAiScheduleFill(
  supabase: SupabaseClient,
  params: { academicContextId: string; scheduleModelId: string; scope: AiFillScope; classId?: string }
): Promise<AiFillResult> {
  const { academicContextId, scheduleModelId, scope, classId } = params;

  const built = await buildRequirements(supabase, academicContextId, scheduleModelId, scope, classId);
  if (scope === "full-week" && built.missingTeacher.length > 0) {
    return {
      placedCount: 0,
      skippedCount: built.missingTeacher.length,
      versionId: null,
      solverIncomplete: true,
      message: `Belum bisa menyusun penuh. ${built.missingTeacher.length} kebutuhan belum memiliki guru aktif. Jadwal lama tetap aman.`,
      committedAssignmentIds: [],
    };
  }

  if (built.requirements.length === 0) {
    const label = scope === "class" ? "kelas ini" : "jadwal saat ini";
    return { placedCount: 0, skippedCount: 0, versionId: null, solverIncomplete: false, message: `Tidak ada kekurangan JP yang perlu diisi di ${label} — semuanya sudah lengkap.`, committedAssignmentIds: [] };
  }

  const preview = await generateCandidatePreview(
    supabase,
    academicContextId,
    scheduleModelId,
    built.requirements,
    scope === "full-week"
      ? { includeActiveExisting: false }
      : { includeActiveExisting: true, committedOnly: true }
  );

  if (!preview.solver.complete || preview.candidates.length === 0) {
    const detail = preview.solver.failures.length > 0
      ? [...new Set(preview.solver.failures.map((f) => f.message))].slice(0, 3).join(" ")
      : "Tidak ditemukan susunan lengkap tanpa bentrok.";
    return {
      placedCount: 0,
      skippedCount: built.requirements.length,
      versionId: null,
      solverIncomplete: true,
      message: `SAKALA belum menemukan jadwal valid. Tidak ada perubahan. ${detail}`,
      committedAssignmentIds: [],
    };
  }

  const drafts = preview.candidates.map((c) => ({ ...c.draft, status: "candidate" as const, versionId: null }));
  const label = scope === "full-week" ? "SAKALA AI — susun ulang seminggu" : scope === "class" ? "SAKALA AI — lengkapi kelas" : "SAKALA AI — lengkapi semua";
  const changeSummary = scope === "full-week"
    ? "Jadwal mingguan baru dipublikasikan oleh SAKALA AI setelah validasi penuh."
    : "Kekurangan jadwal dilengkapi oleh SAKALA AI setelah validasi penuh.";

  const published = await publishAiScheduleAtomic(supabase, {
    academicContextId,
    scheduleModelId,
    drafts,
    label,
    changeSummary,
    mode: scope === "full-week" ? "replace" : "fill",
  });

  const readBack = await Promise.all(
    published.assignmentIds.map((id) => scheduleAssignmentRepository.findById(supabase, id))
  );
  const verified = published.assignmentIds.length > 0 && readBack.every(
    (a) => a?.status === "committed" && a.versionId === published.versionId && a.scheduleModelId === scheduleModelId
  );
  if (!verified) throw new Error("SAKALA AI menulis jadwal tetapi verifikasi hasil gagal. Tidak ada status berhasil yang boleh ditampilkan.");

  return {
    placedCount: published.assignmentIds.length,
    skippedCount: 0,
    versionId: published.versionId,
    solverIncomplete: false,
    message: `AI berhasil menyusun ${published.assignmentIds.length} slot dan memverifikasi jadwal resmi.`,
    committedAssignmentIds: published.assignmentIds,
  };
}
