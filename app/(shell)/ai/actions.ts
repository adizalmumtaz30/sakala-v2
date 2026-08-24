"use server";

import { createClient } from "@/lib/supabase/server";
import { planScheduleFromCommand, type AiSchedulePlan } from "@/lib/application/aiSchedulePlanner";
import { saveCandidatesAction, commitAssignmentsAction } from "@/app/(shell)/jadwal-cerdas/actions";
import * as scheduleAssignmentUseCases from "@/lib/application/scheduleAssignment.usecases";
import { listAcademicContexts } from "@/lib/application/academicContext.usecases";
import { listKelas } from "@/lib/application/kelas.usecases";
import { listMataPelajaran } from "@/lib/application/mata-pelajaran.usecases";
import { listPembagianMengajar, createPembagianMengajar } from "@/lib/application/pembagianMengajar.usecases";
import { getTargetJpView } from "@/lib/application/targetJp.usecases";
import { listGuru } from "@/lib/application/guru.usecases";
import { getSchoolProfile } from "@/lib/application/schoolProfile.usecases";
import { formatContextLabel } from "@/lib/domain/academicContext";
import { buildAiAction, summarizeAiAction } from "@/lib/domain/aiAction";

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
  /** JP yang SUDAH punya guru (Pembagian Mengajar aktif) tapi belum masuk Jadwal.
   * Dipisah dari belumSiapJp karena rute perbaikannya beda: ini ke Jadwal
   * (planner bisa langsung cari slot), belumSiapJp harus ke Pembagian Mengajar
   * dulu (planner TIDAK BISA menjadwalkan mapel tanpa guru). */
  belumTerjadwalJp: number;
  subjectDeficits: Array<{ subjectId: string; subjectName: string; targetJp: number; scheduledJp: number; remainingJp: number; belumSiapJp: number; belumTerjadwalJp: number; suggestedTeachers: Array<{ id: string; name: string }> }>;
  /** JP yang terjadwal MELEBIHI target resmi — sebelumnya tidak pernah terlihat
   * (source data lama membungkam kelebihan lewat Math.min). AI wajib melaporkan
   * ini, bukan diam-diam menganggap kelas 'sudah sesuai' padahal kelebihan. */
  excessJp: number;
  subjectExcess: Array<{ subjectId: string; subjectName: string; targetJp: number; scheduledJp: number; excessJp: number; schedules: Array<{ id: string; day: string; periodStart: number; periodEnd: number }> }>;
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
    const [kelas, mapel, schoolProfile, guru, targetJpView, pembagianSemua] = await Promise.all([
      listKelas(supabase),
      listMataPelajaran(supabase),
      getSchoolProfile(supabase),
      listGuru(supabase),
      getTargetJpView(supabase, active.id),
      listPembagianMengajar(supabase, active.id),
    ]);

    // §14/Fase 2 — untuk mapel yang belum punya guru (belumSiapJp), usulkan guru
    // yang SUDAH mengajar mapel yang sama di kelas lain (bukan tebakan buta).
    // Kalau tidak ada satu pun, biarkan kosong — jujur, bukan mengarang usulan.
    const teachersBySubject = new Map<string, Map<string, string>>();
    for (const p of pembagianSemua) {
      if (p.status !== "aktif") continue;
      const m = teachersBySubject.get(p.mataPelajaranId) ?? new Map<string, string>();
      const g = guru.find((x) => x.id === p.guruId);
      if (g) m.set(g.id, g.namaGuru);
      teachersBySubject.set(p.mataPelajaranId, m);
    }

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
          belumTerjadwalJp: r.belumTerjadwalJp,
          suggestedTeachers: r.belumSiapJp > 0 ? [...(teachersBySubject.get(r.mataPelajaranId) ?? new Map())].map(([id, name]) => ({ id, name })) : [],
        }))
        .filter((x) => x.remainingJp > 0)
        .sort((a, b) => b.remainingJp - a.remainingJp);

      // §14/§19 — kelebihan JP (terjadwal > target resmi) sebelumnya tidak
      // pernah dilaporkan karena data sumbernya membungkam lewat Math.min.
      // AI wajib melaporkan ini secara jujur, bukan diam-diam anggap "sesuai".
      const subjectExcess = rows
        .filter((r) => r.scheduledExcessJp > 0)
        .map((r) => ({
          subjectId: r.mataPelajaranId,
          subjectName: r.mataPelajaranNama,
          targetJp: r.targetJp,
          scheduledJp: r.terjadwalJp + r.scheduledExcessJp,
          excessJp: r.scheduledExcessJp,
          schedules: r.schedules.map((s) => ({ id: s.id, day: s.day, periodStart: s.periodStart, periodEnd: s.periodEnd })),
        }))
        .sort((a, b) => b.excessJp - a.excessJp);

      const targetJp = rows.reduce((sum, r) => sum + r.targetJp, 0);
      const scheduledJp = rows.reduce((sum, r) => sum + r.terjadwalJp, 0);
      const belumSiapJp = rows.reduce((sum, r) => sum + r.belumSiapJp, 0);
      const belumTerjadwalJp = rows.reduce((sum, r) => sum + r.belumTerjadwalJp, 0);
      const excessJp = rows.reduce((sum, r) => sum + r.scheduledExcessJp, 0);

      return {
        id: k.id,
        label: `${k.tingkat} ${k.namaRombel}`.trim(),
        targetJp,
        scheduledJp,
        remainingJp: Math.max(0, targetJp - scheduledJp),
        belumSiapJp,
        belumTerjadwalJp,
        subjectDeficits,
        excessJp,
        subjectExcess,
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
  // §46/§47 AI Action Contract — bungkus jadi AiAction eksplisit sebelum
  // eksekusi, supaya audit trail mencatat ini benar dari SAKALA AI (source
  // "ai"), bukan "manual" seperti penyimpanan candidate biasa dari Jadwal
  // Cerdas, dan kolom `reason` terisi alasan yang bisa dibaca manusia.
  const first = drafts[0];
  const reason = first
    ? summarizeAiAction(buildAiAction({
        actionType: "tambah_jp",
        destination: "jadwal",
        targetEntity: { classId: first.classId, subjectId: first.subjectId, teacherId: first.teacherId },
        currentValue: null,
        proposedValue: { jumlahSlot: drafts.length },
        reason: `Menyimpan ${drafts.length} slot jadwal candidate hasil rekomendasi SAKALA AI.`,
        evidence: ["Target JP", "Pembagian Mengajar", "Jadwal committed"],
        risk: "rendah",
      }))
    : null;
  return saveCandidatesAction(drafts, "ai", reason);
}

// §14 Action Type "Kurangi" — hapus satu slot jadwal committed yang berkontribusi
// pada kelebihan JP. Ini BEDA dari rollback (yang menghapus candidate AI sendiri):
// ini menyentuh jadwal committed asli, jadi risikonya §19 "sedang", bukan
// "rendah" -- UI wajib menampilkan dampak (slot mana yang akan kosong) sebelum
// tindakan, bukan tombol sekali klik tanpa konteks.
// §14 Action Type "Kurangi" — hapus satu slot jadwal committed yang kelebihan.
// SAKALA MASTER RULE (Read-Back): baca ulang data resmi setelah menulis,
// jangan klaim berhasil hanya karena tidak ada exception. Assignment
// committed WAJIB di-archive (bukan hard-delete) — immutabilitas committed
// schedule sudah jadi aturan di commitAssignments(); aksi ini sebelumnya
// memanggil deleteAssignment() polos yang melanggar aturan itu.
export async function kurangiJpAction(assignmentId: string): Promise<AiActionResult<{ archived: boolean }>> {
  try {
    const { supabase } = await getActiveContext();
    const existing = await scheduleAssignmentUseCases.getScheduleAssignment(supabase, assignmentId);
    const reason = existing
      ? summarizeAiAction(buildAiAction({
          actionType: "kurangi_jp",
          destination: "jadwal",
          targetEntity: { classId: existing.classId, subjectId: existing.subjectId, teacherId: existing.teacherId },
          currentValue: { day: existing.day, periodStart: existing.periodStart, periodEnd: existing.periodEnd },
          proposedValue: null,
          reason: "Menghapus satu slot jadwal karena JP mapel ini melebihi target resmi.",
          evidence: ["Target JP", "Jadwal committed"],
          risk: "sedang",
        }))
      : "[SAKALA AI] Mengurangi JP kelebihan.";
    const result = await scheduleAssignmentUseCases.archiveOrDeleteAssignment(supabase, assignmentId, "ai", reason);
    // Read-back: pastikan status resmi memang sudah berubah sebelum bilang berhasil.
    const verify = await scheduleAssignmentUseCases.getScheduleAssignment(supabase, assignmentId);
    const confirmed = result.archived ? verify?.status === "archived" : verify === null;
    if (!confirmed) return { ok: false, error: "Perubahan belum bisa dipastikan tersimpan — data resmi belum mencerminkan penghapusan ini. Coba lagi." };
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal mengurangi JP." };
  }
}

// §14 Action Type baru "Tetapkan Guru" — rute Fase 2. Ini BEDA dari Tambah/Kurangi
// JP: tujuannya Pembagian Mengajar, bukan Jadwal, karena planner TIDAK BISA
// menjadwalkan mapel yang belum punya guru sama sekali. AI mengusulkan (dari
// suggestedTeachers), operator yang menyetujui secara eksplisit — bukan
// auto-assign. source "ai" supaya audit trail mencatat asal tindakan ini.
export async function tetapkanGuruAction(kelasId: string, mataPelajaranId: string, guruId: string, jpPerMinggu: number): Promise<AiActionResult<null>> {
  try {
    const { supabase, active } = await getActiveContext();
    const reason = summarizeAiAction(buildAiAction({
      actionType: "tetapkan_guru",
      destination: "pembagian_mengajar",
      targetEntity: { classId: kelasId, subjectId: mataPelajaranId, teacherId: guruId },
      currentValue: null,
      proposedValue: { jpPerMinggu },
      reason: `Mengusulkan guru untuk mapel yang belum punya guru sama sekali (${jpPerMinggu} JP).`,
      evidence: ["Target JP", "Pembagian Mengajar (guru yang sudah mengajar mapel sama di kelas lain)"],
      risk: "rendah",
    }));
    await createPembagianMengajar(supabase, { academicContextId: active.id, guruId, mataPelajaranId, kelasId, jpPerMinggu, status: "aktif" }, "ai", reason);
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menetapkan guru." };
  }
}

// §25 Rollback — hapus candidate yang barusan disimpan (bukan jadwal committed,
// jadi ini aman & langsung tanpa konfirmasi tambahan, sesuai §19 risiko rendah).
// Read-Back: setiap id diverifikasi benar-benar hilang sebelum masuk hitungan removedCount.
export async function rollbackAiCandidatesAction(ids: string[]): Promise<AiActionResult<{ removedCount: number; unconfirmedIds: string[] }>> {
  try {
    const { supabase } = await getActiveContext();
    let removed = 0;
    const unconfirmedIds: string[] = [];
    for (const id of ids) {
      await scheduleAssignmentUseCases.archiveOrDeleteAssignment(supabase, id, "ai", "[SAKALA AI] Rollback — membatalkan candidate yang baru disimpan sendiri oleh AI.");
      const verify = await scheduleAssignmentUseCases.getScheduleAssignment(supabase, id);
      if (verify === null) removed += 1;
      else unconfirmedIds.push(id);
    }
    return { ok: true, data: { removedCount: removed, unconfirmedIds } };
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
