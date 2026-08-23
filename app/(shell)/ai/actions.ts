"use server";

import { createClient } from "@/lib/supabase/server";
import { planScheduleFromCommand, type AiSchedulePlan } from "@/lib/application/aiSchedulePlanner";
import { saveCandidatesAction, commitAssignmentsAction } from "@/app/(shell)/jadwal-cerdas/actions";
import * as scheduleAssignmentUseCases from "@/lib/application/scheduleAssignment.usecases";
import { listAcademicContexts } from "@/lib/application/academicContext.usecases";
import { listKelas } from "@/lib/application/kelas.usecases";
import { listMataPelajaran } from "@/lib/application/mata-pelajaran.usecases";
import { listPembagianMengajar } from "@/lib/application/pembagianMengajar.usecases";
import { getTargetJpView } from "@/lib/application/targetJp.usecases";
import { listGuru } from "@/lib/application/guru.usecases";
import { getSchoolProfile } from "@/lib/application/schoolProfile.usecases";
import { formatContextLabel } from "@/lib/domain/academicContext";

export type AiActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type AiCopilotIntent =
  | "complete_remaining_jp"
  | "schedule_full_week"
  | "fill_empty_slots"
  | "schedule_one_subject";

export interface AiCopilotClassStatus {
  id: string;
  label: string;
  targetJp: number;
  scheduledJp: number;
  remainingJp: number;
  /** JP yang belum punya guru sama sekali (authority: target_jp resmi). AI wajib membedakan ini dari "sudah punya guru tapi belum terjadwal". */
  belumSiapJp: number;
  subjectDeficits: Array<{ subjectId: string; subjectName: string; targetJp: number; scheduledJp: number; remainingJp: number; belumSiapJp: number }>;
}

export interface AiCopilotContext {
  academicContextId: string;
  schoolName: string;
  contextLabel: string;
  classes: AiCopilotClassStatus[];
  activeClassId: string | null;
  /** Peta id→nama supaya UI tidak perlu menampilkan raw id (dipakai Solution Drawer & Preview). */
  subjectNames: Record<string, string>;
  teacherNames: Record<string, string>;
}

async function getActiveContext() {
  const supabase = await createClient();
  const contexts = await listAcademicContexts(supabase);
  const active = contexts.find((c) => c.isActive);
  if (!active) throw new Error("Belum ada konteks akademik aktif.");
  return { supabase, active };
}

/** Read-only context snapshot for the AI Copilot. No schedule mutation occurs here.
 *
 * SAKALA MASTER RULE (AI Action Contract): target/remaining di sini WAJIB
 * berasal dari tabel target_jp resmi (lewat getTargetJpView, authority yang
 * sama dipakai halaman Target JP) — bukan dihitung ulang dari Pembagian
 * Mengajar. Sebelumnya fungsi ini menjumlah jpPerMinggu Pembagian Mengajar
 * langsung, jadi AI Copilot bisa menyarankan "kelas ini sudah selesai"
 * padahal masih ada mapel yang belum punya guru sama sekali — persis kasus
 * 19/40 yang jadi dasar kontrak ini.
 */
export async function getAiCopilotContextAction(): Promise<AiActionResult<AiCopilotContext>> {
  try {
    const { supabase, active } = await getActiveContext();
    const [kelas, mapel, schoolProfile, guru, targetJpView] = await Promise.all([
      listKelas(supabase),
      listMataPelajaran(supabase),
      getSchoolProfile(supabase),
      listGuru(supabase),
      getTargetJpView(supabase, active.id),
    ]);

    const rowsByKelas = new Map<string, typeof targetJpView.rows>();
    for (const row of targetJpView.rows) {
      const list = rowsByKelas.get(row.kelasId) ?? [];
      list.push(row);
      rowsByKelas.set(row.kelasId, list);
    }

    const classes = kelas.map((k) => {
      const rows = rowsByKelas.get(k.id) ?? [];
      // "Kekurangan" di sini mencakup DUA hal sekaligus, dan keduanya wajib
      // terlihat: mapel yang belum punya guru (belumSiapJp) DAN mapel yang
      // sudah punya guru tapi belum masuk jadwal (belumTerjadwalJp). AI tidak
      // boleh menganggap "guru belum ada" sebagai "sudah selesai".
      const subjectDeficits = rows
        .map((r) => ({
          subjectId: r.mataPelajaranId,
          subjectName: r.mataPelajaranNama,
          targetJp: r.targetJp,
          scheduledJp: r.terjadwalJp,
          remainingJp: r.belumSiapJp + r.belumTerjadwalJp,
          belumSiapJp: r.belumSiapJp,
        }))
        .filter((x) => x.remainingJp > 0)
        .sort((a, b) => b.remainingJp - a.remainingJp);

      const targetJp = rows.reduce((sum, r) => sum + r.targetJp, 0);
      const scheduledJp = rows.reduce((sum, r) => sum + r.terjadwalJp, 0);
      const belumSiapJp = rows.reduce((sum, r) => sum + r.belumSiapJp, 0);

      return {
        id: k.id,
        label: `${k.tingkat} ${k.namaRombel}`.trim(),
        targetJp,
        scheduledJp,
        remainingJp: Math.max(0, targetJp - scheduledJp),
        belumSiapJp,
        subjectDeficits,
      };
    }).filter((x) => x.targetJp > 0);

    const subjectNames = Object.fromEntries(mapel.map((m) => [m.id, m.nama]));
    const teacherNames = Object.fromEntries(guru.map((g) => [g.id, g.namaGuru]));
    return { ok: true, data: { academicContextId: active.id, schoolName: schoolProfile?.namaSekolah ?? "Sekolah", contextLabel: formatContextLabel(active), classes, activeClassId: classes[0]?.id ?? null, subjectNames, teacherNames } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal membaca kondisi jadwal AI." };
  }
}

/** AI planning is preview-only. It never writes or commits a schedule. */
export async function planScheduleAction(command: string): Promise<AiActionResult<AiSchedulePlan>> {
  try {
    const { supabase, active } = await getActiveContext();
    const plan = await planScheduleFromCommand(supabase, active.id, command);
    return { ok: true, data: plan };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menyusun rancangan jadwal AI." };
  }
}

/**
 * Structured quick actions. Buttons never need to manufacture a natural-language
 * prompt. The intent is resolved server-side from current academic data, then
 * handed to the same constraint-aware candidate planner.
 */
export async function runAiCopilotIntentAction(
  intent: AiCopilotIntent,
  classId: string
): Promise<AiActionResult<AiSchedulePlan>> {
  try {
    const { supabase, active } = await getActiveContext();
    const [kelas, mapel, pembagian] = await Promise.all([
      listKelas(supabase),
      listMataPelajaran(supabase),
      listPembagianMengajar(supabase, active.id),
    ]);
    const targetClass = kelas.find((k) => k.id === classId);
    if (!targetClass) return { ok: false, error: "Kelas target tidak ditemukan pada konteks akademik aktif." };

    const assignments = pembagian.filter((p) => p.status === "aktif" && p.kelasId === classId);
    if (!assignments.length) return { ok: false, error: `Belum ada Pembagian Mengajar aktif untuk ${targetClass.tingkat} ${targetClass.namaRombel}.` };

    if (intent === "schedule_one_subject") {
      return { ok: false, error: "Pilih mata pelajaran melalui kolom perintah untuk aksi satu mapel. Quick Action ini tidak akan menebak mapel." };
    }

    const subjectTargets = new Map<string, number>();
    for (const item of assignments) {
      subjectTargets.set(item.mataPelajaranId, (subjectTargets.get(item.mataPelajaranId) ?? 0) + item.jpPerMinggu);
    }
    const rows = [...subjectTargets.entries()]
      .map(([subjectId, target]) => ({ name: mapel.find((m) => m.id === subjectId)?.nama ?? "", target }))
      .filter((x) => x.name && x.target > 0)
      .map((x) => `${x.name} ${x.target} JP`);

    if (!rows.length) return { ok: false, error: "Tidak ada target JP aktif yang dapat direncanakan." };

    const command = `${intent === "fill_empty_slots" ? "Isi slot kosong" : "Susun semua mata pelajaran"} kelas ${targetClass.tingkat} ${targetClass.namaRombel}.\n${rows.join("\n")}`;
    const plan = await planScheduleFromCommand(supabase, active.id, command);
    return { ok: true, data: plan };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menjalankan Quick Action AI." };
  }
}

/** Explicit user action: save the AI preview as candidate rows. */
export async function saveAiCandidatesAction(
  drafts: Parameters<typeof saveCandidatesAction>[0]
): Promise<AiActionResult<{ savedCount: number; skippedCount: number; savedIds: string[] }>> {
  const result = await saveCandidatesAction(drafts);
  return result;
}

// §25 Rollback — hapus candidate yang barusan disimpan (bukan jadwal committed,
// jadi ini aman & langsung tanpa konfirmasi tambahan, sesuai §19 risiko rendah).
export async function rollbackAiCandidatesAction(ids: string[]): Promise<AiActionResult<{ removedCount: number }>> {
  try {
    const supabase = await getActiveContext().then((c) => c.supabase);
    let removed = 0;
    for (const id of ids) {
      await scheduleAssignmentUseCases.deleteAssignment(supabase, id);
      removed += 1;
    }
    return { ok: true, data: { removedCount: removed } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal mengembalikan candidate." };
  }
}

/** Explicit user action: commit only after candidate review/approval. */
export async function commitAiCandidatesAction(
  academicContextId: string,
  assignmentIds: string[],
  label: string,
  changeSummary: string | null
): Promise<AiActionResult<{ versionId: string; conflictsByAssignment: Record<string, import("@/lib/domain/conflict").ScheduleConflict[]> }>> {
  return commitAssignmentsAction(academicContextId, assignmentIds, label, changeSummary);
}
