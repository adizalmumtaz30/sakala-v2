import type { SupabaseClient } from "@supabase/supabase-js";
import { listPembagianMengajar } from "@/lib/application/pembagianMengajar.usecases";
import { generateCandidatePreview } from "@/lib/application/candidateGenerator";
import { archiveOrDeleteAssignment } from "@/lib/application/scheduleAssignment.usecases";
import { publishAiScheduleAtomic } from "@/lib/application/aiSchedulePublish.usecases";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import type { GenerationRequirement } from "@/lib/domain/candidateGeneration";

// SAKALA MASTER RULE:
// Candidate/Commit adalah mekanisme internal, bukan pekerjaan operator.
// AI harus menyusun -> memvalidasi -> mempublikasikan jadwal dalam satu aksi.
// Untuk fill/empty, jadwal committed yang sudah ada dibawa ke versi baru.
// Untuk full-week, jadwal baru menggantikan versi aktif hanya setelah seluruh
// rancangan berhasil dibuat dan dipublikasikan secara atomic.
// Jika publication gagal, versi aktif lama tidak berubah.

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

export async function runAiScheduleFill(
  supabase: SupabaseClient,
  params: { academicContextId: string; scheduleModelId: string; scope: AiFillScope; classId?: string }
): Promise<AiFillResult> {
  const { academicContextId, scheduleModelId, scope, classId } = params;

  const pembagianList = await listPembagianMengajar(supabase, academicContextId);
  const scoped = scope === "class" && classId ? pembagianList.filter((p) => p.kelasId === classId) : pembagianList;
  const needing = scoped.filter((p) => p.status === "aktif" && (p.jpTersisa ?? p.jpPerMinggu) > 0);

  if (needing.length === 0) {
    return {
      placedCount: 0,
      skippedCount: 0,
      versionId: null,
      solverIncomplete: false,
      message: "Tidak ada kekurangan JP yang perlu diisi di sini — semua sudah lengkap.",
      committedAssignmentIds: [],
    };
  }

  const requirements: GenerationRequirement[] = needing.map((p) => ({
    id: p.id,
    classId: p.kelasId,
    subjectId: p.mataPelajaranId,
    teacherId: p.guruId,
    roomId: null,
    activityType: "belajar_mengajar",
    jpTarget: p.jpTersisa ?? p.jpPerMinggu,
  }));

  // Partial fill uses only the authoritative committed schedule as occupancy.
  // Full-week intentionally ignores current occupancy because it is building
  // a complete replacement schedule; the old version remains untouched until
  // the replacement passes solver + publication.
  const preview = await generateCandidatePreview(
    supabase,
    academicContextId,
    scheduleModelId,
    requirements,
    scope === "full-week"
      ? { includeActiveExisting: false }
      : { includeActiveExisting: true, committedOnly: true }
  );

  if (!preview.solver.complete || preview.candidates.length === 0) {
    return {
      placedCount: 0,
      skippedCount: requirements.length,
      versionId: null,
      solverIncomplete: true,
      message:
        "SAKALA belum menemukan susunan yang valid untuk seluruh kebutuhan. Jadwal yang sekarang tetap aman dan tidak diubah.",
      committedAssignmentIds: [],
    };
  }

  // The solver guarantees exact-JP completeness and internal schedule validity.
  // Publication below is atomic; there is no user-facing candidate/commit step.
  const drafts = preview.candidates.map((c) => ({ ...c.draft, status: "candidate" as const, versionId: null }));
  const label = scope === "full-week" ? "SAKALA AI — susun ulang seminggu" : scope === "class" ? "SAKALA AI — lengkapi kelas" : "SAKALA AI — lengkapi semua";
  const changeSummary = scope === "full-week"
    ? "Jadwal mingguan baru dipublikasikan oleh SAKALA AI setelah validasi penuh."
    : "Kekurangan jadwal dilengkapi oleh SAKALA AI tanpa menghilangkan jadwal committed yang sudah ada.";

  const published = await publishAiScheduleAtomic(supabase, {
    academicContextId,
    scheduleModelId,
    drafts,
    label,
    changeSummary,
    mode: scope === "full-week" ? "replace" : "fill",
  });

  // Read-back: the UI success message is only emitted after the database RPC
  // returns a version and assignment ids. This prevents "success" without a
  // committed schedule.
  const readBack = await Promise.all(
    published.assignmentIds.map((id) => scheduleAssignmentRepository.findById(supabase, id))
  );
  const verified = readBack.every(
    (a) => a?.status === "committed" && a.versionId === published.versionId && a.scheduleModelId === scheduleModelId
  );
  if (!verified) {
    throw new Error("SAKALA AI selesai menulis tetapi verifikasi jadwal gagal. Jadwal aktif tidak boleh dianggap berhasil.");
  }

  return {
    placedCount: preview.candidates.length,
    skippedCount: 0,
    versionId: published.versionId,
    solverIncomplete: false,
    message: `AI berhasil menyusun ${preview.candidates.length} slot dan memverifikasi jadwal resmi.`,
    committedAssignmentIds: published.assignmentIds,
  };
}
