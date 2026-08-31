import type { SupabaseClient } from "@supabase/supabase-js";
import { listPembagianMengajar } from "@/lib/application/pembagianMengajar.usecases";
import { generateCandidatePreview, saveGeneratedCandidates } from "@/lib/application/candidateGenerator";
import { commitAssignments, archiveOrDeleteAssignment } from "@/lib/application/scheduleAssignment.usecases";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import type { GenerationRequirement } from "@/lib/domain/candidateGeneration";

// SAKALA MASTER RULE (Jadwal Satu Layar, tahap 2+3): sebelumnya AI generate
// jadwal lewat Jadwal Cerdas menyimpan hasil sebagai status "candidate" yang
// menggantung sampai operator buka halaman Review & Commit terpisah.
// Operator tidak mau ada langkah tengah ini -- klik satu tombol, AI isi
// slot, LANGSUNG jadi jadwal resmi (atau ditolak dengan alasan jelas kalau
// gagal semua). Fungsi ini memakai mesin solver yang sama persis
// (generateCandidatePreview, tidak ditulis ulang -- itu sudah teruji), cuma
// tahap "save sebagai candidate lalu tunggu direview" dipendekkan jadi
// "save lalu langsung commit" dalam satu pemanggilan, lewat commitAssignments
// yang sudah atomic (PR #91) -- kalau ada langkah gagal di tengah, tidak
// ada slot yang nyangkut setengah jadi.

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

  if (scope === "full-week") {
    // "Susun ulang penuh seminggu" -- operator sudah dikonfirmasi lewat
    // dialog peringatan di UI SEBELUM memanggil fungsi ini (bukan di sini)
    // bahwa ini akan menimpa jadwal yang ada. Arsipkan/hapus assignment
    // aktif di scope model ini dulu lewat fungsi yang SUDAH ADA
    // (archiveOrDeleteAssignment -- committed diarsipkan/tetap ada di
    // riwayat, bukan dihapus permanen), supaya solver punya slot penuh
    // untuk disusun ulang dari nol.
    const existing = await scheduleAssignmentRepository.findByContext(supabase, academicContextId);
    const inScope = existing.filter(
      (a) => a.scheduleModelId === scheduleModelId && a.status !== "archived" && a.status !== "cancelled"
    );
    for (const a of inScope) {
      await archiveOrDeleteAssignment(supabase, a.id, "ai", "Diarsipkan otomatis sebelum SAKALA AI menyusun ulang jadwal seminggu penuh");
    }
  }

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

  const preview = await generateCandidatePreview(supabase, academicContextId, scheduleModelId, requirements);

  // Invariant mesin solver (candidateGenerator.ts): solve yang tidak lengkap
  // TIDAK PERNAH menghasilkan batch sebagian -- either semua kebutuhan
  // tertempatkan, atau tidak ada satupun. Ini prinsip yang sudah benar
  // (mencegah "campur aduk" persis seperti fix atomic commit), jadi TIDAK
  // diubah di sini.
  if (!preview.solver.complete || preview.candidates.length === 0) {
    return {
      placedCount: 0,
      skippedCount: requirements.length,
      versionId: null,
      solverIncomplete: true,
      message:
        "AI belum menemukan susunan yang pas untuk semua kebutuhan sekaligus. Coba isi sebagian secara manual dulu, atau persempit ke satu kelas dulu.",
      committedAssignmentIds: [],
    };
  }

  const drafts = preview.candidates.map((c) => c.draft);
  const { saved, skipped } = await saveGeneratedCandidates(supabase, drafts, "ai", "SAKALA AI — isi otomatis");

  if (saved.length === 0) {
    return {
      placedCount: 0,
      skippedCount: skipped.length,
      versionId: null,
      solverIncomplete: false,
      message: "AI tidak berhasil menyimpan penempatan — ada perubahan data lain yang bikin bentrok. Coba lagi.",
      committedAssignmentIds: [],
    };
  }

  const commitResult = await commitAssignments(
    supabase,
    academicContextId,
    saved.map((s) => s.id),
    scope === "full-week" ? "SAKALA AI — susun ulang seminggu" : scope === "class" ? "SAKALA AI — lengkapi kelas" : "SAKALA AI — lengkapi semua",
    "Ditempatkan otomatis oleh SAKALA AI"
  );

  return {
    placedCount: saved.length,
    skippedCount: skipped.length,
    versionId: commitResult.versionId,
    solverIncomplete: false,
    message: `AI berhasil mengisi ${saved.length} slot jadwal${skipped.length > 0 ? ` (${skipped.length} dilewati karena bentrok)` : ""}.`,
    committedAssignmentIds: saved.map((s) => s.id),
  };
}
