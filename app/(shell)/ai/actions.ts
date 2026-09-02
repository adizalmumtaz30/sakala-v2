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
import { getCurriculumJpMismatches, type CurriculumJpMismatch } from "@/lib/application/curriculumJpDiagnosis.usecases";
import { listGuru } from "@/lib/application/guru.usecases";
import { listRuangan } from "@/lib/application/ruangan.usecases";
import { getSchoolProfile } from "@/lib/application/schoolProfile.usecases";
import { formatContextLabel } from "@/lib/domain/academicContext";
import { buildAiAction, summarizeAiAction } from "@/lib/domain/aiAction";
import { toPlainErrorMessage } from "@/lib/utils/databaseError";

export type AiActionResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type AiCopilotIntent = "complete_remaining_jp" | "schedule_full_week" | "fill_empty_slots" | "schedule_one_subject";

export interface AiCopilotClassStatus {
  id: string;
  label: string;
  targetJp: number;
  scheduledJp: number;
  remainingJp: number;
  belumSiapJp: number;
  belumTerjadwalJp: number;
  subjectDeficits: Array<{ subjectId: string; subjectName: string; targetJp: number; scheduledJp: number; remainingJp: number; belumSiapJp: number; belumTerjadwalJp: number; suggestedTeachers: Array<{ id: string; name: string; relevant: boolean }> }>;
  excessJp: number;
  subjectExcess: Array<{ subjectId: string; subjectName: string; targetJp: number; scheduledJp: number; excessJp: number; schedules: Array<{ id: string; day: string; periodStart: number; periodEnd: number }> }>;
}

export interface AiCopilotContext {
  academicContextId: string;
  schoolName: string;
  contextLabel: string;
  classes: AiCopilotClassStatus[];
  activeClassId: string | null;
  subjectNames: Record<string, string>;
  teacherNames: Record<string, string>;
  roomNames: Record<string, string>;
  // §10 PRACTICAL UI & OPERATOR EXPERIENCE: "Kenapa Target JP saya tidak
  // sesuai kurikulum?" — diagnosa read-only, reuse capability yang sama
  // dipakai Konteks Akademik/Mata Pelajaran/Dashboard. AI belum mengubah
  // apa pun; penyesuaian tetap lewat Target JP.
  curriculumMismatches: CurriculumJpMismatch[];
}

async function getActiveContext() {
  const supabase = await createClient();
  const contexts = await listAcademicContexts(supabase);
  const active = contexts.find((c) => c.isActive);
  if (!active) throw new Error("Belum ada konteks akademik aktif.");
  return { supabase, active };
}

export async function getAiCopilotContextAction(): Promise<AiActionResult<AiCopilotContext>> {
  try {
    const { supabase, active } = await getActiveContext();
    const [kelas, mapel, schoolProfile, guru, targetJpView, pembagianSemua, ruangan] = await Promise.all([
      listKelas(supabase, active.id),
      listMataPelajaran(supabase),
      getSchoolProfile(supabase),
      listGuru(supabase),
      getTargetJpView(supabase, active.id),
      listPembagianMengajar(supabase, active.id),
      listRuangan(supabase),
    ]);

    const teachersBySubject = new Map<string, Map<string, string>>();
    const teacherLoad = new Map<string, number>();
    for (const p of pembagianSemua) {
      if (p.status !== "aktif") continue;
      teacherLoad.set(p.guruId, (teacherLoad.get(p.guruId) ?? 0) + p.jpPerMinggu);
      const m = teachersBySubject.get(p.mataPelajaranId) ?? new Map<string, string>();
      const g = guru.find((x) => x.id === p.guruId);
      if (g) m.set(g.id, g.namaGuru);
      teachersBySubject.set(p.mataPelajaranId, m);
    }
    const activeTeachersByLoad = guru.filter((g) => g.status === "aktif").map((g) => ({ id: g.id, name: g.namaGuru, load: teacherLoad.get(g.id) ?? 0 })).sort((a, b) => a.load - b.load);

    const rowsByKelas = new Map<string, typeof targetJpView.rows>();
    for (const row of targetJpView.rows) {
      const list = rowsByKelas.get(row.kelasId) ?? [];
      list.push(row);
      rowsByKelas.set(row.kelasId, list);
    }

    const classes = kelas.map((k) => {
      const rows = rowsByKelas.get(k.id) ?? [];
      const subjectDeficits = rows.map((r) => ({
        subjectId: r.mataPelajaranId,
        subjectName: r.mataPelajaranNama,
        targetJp: r.targetJp,
        scheduledJp: r.terjadwalJp,
        remainingJp: r.belumSiapJp + r.belumTerjadwalJp,
        belumSiapJp: r.belumSiapJp,
        belumTerjadwalJp: r.belumTerjadwalJp,
        suggestedTeachers: r.belumSiapJp > 0 ? (() => {
          const relevant = [...(teachersBySubject.get(r.mataPelajaranId) ?? new Map())].map(([id, name]) => ({ id, name, relevant: true }));
          if (relevant.length > 0) return relevant;
          return activeTeachersByLoad.slice(0, 5).map((t) => ({ id: t.id, name: t.name, relevant: false }));
        })() : [],
      })).filter((x) => x.remainingJp > 0).sort((a, b) => b.remainingJp - a.remainingJp);

      const subjectExcess = rows.filter((r) => r.scheduledExcessJp > 0).map((r) => ({
        subjectId: r.mataPelajaranId,
        subjectName: r.mataPelajaranNama,
        targetJp: r.targetJp,
        scheduledJp: r.terjadwalJp + r.scheduledExcessJp,
        excessJp: r.scheduledExcessJp,
        schedules: r.schedules.map((s) => ({ id: s.id, day: s.day, periodStart: s.periodStart, periodEnd: s.periodEnd })),
      })).sort((a, b) => b.excessJp - a.excessJp);

      const targetJp = rows.reduce((sum, r) => sum + r.targetJp, 0);
      const scheduledJp = rows.reduce((sum, r) => sum + r.terjadwalJp, 0);
      const belumSiapJp = rows.reduce((sum, r) => sum + r.belumSiapJp, 0);
      const belumTerjadwalJp = rows.reduce((sum, r) => sum + r.belumTerjadwalJp, 0);
      const excessJp = rows.reduce((sum, r) => sum + r.scheduledExcessJp, 0);
      return { id: k.id, label: `${k.tingkat} ${k.namaRombel}`.trim(), targetJp, scheduledJp, remainingJp: Math.max(0, targetJp - scheduledJp), belumSiapJp, belumTerjadwalJp, subjectDeficits, excessJp, subjectExcess };
    }).filter((x) => x.targetJp > 0);

    classes.sort((a, b) => (b.remainingJp + b.excessJp) - (a.remainingJp + a.excessJp));
    const subjectNames = Object.fromEntries(mapel.map((m) => [m.id, m.nama]));
    const teacherNames = Object.fromEntries(guru.map((g) => [g.id, g.namaGuru]));
    const roomNames = Object.fromEntries(ruangan.map((r) => [r.id, r.nama]));
    const curriculumMismatches = await getCurriculumJpMismatches(kelas, targetJpView.rows).catch(() => []);
    return { ok: true, data: { academicContextId: active.id, schoolName: schoolProfile?.namaSekolah ?? "Sekolah", contextLabel: formatContextLabel(active), classes, activeClassId: classes[0]?.id ?? null, subjectNames, teacherNames, roomNames, curriculumMismatches } };
  } catch (err) {
    return { ok: false, error: toPlainErrorMessage(err, "Gagal membaca kondisi jadwal AI.") };
  }
}

export async function planScheduleAction(command: string): Promise<AiActionResult<AiSchedulePlan>> {
  try { const { supabase, active } = await getActiveContext(); return { ok: true, data: await planScheduleFromCommand(supabase, active.id, command) }; }
  catch (err) { return { ok: false, error: toPlainErrorMessage(err, "Gagal menyusun rancangan jadwal AI.") }; }
}

export async function runAiCopilotIntentAction(intent: AiCopilotIntent, classId: string): Promise<AiActionResult<AiSchedulePlan>> {
  try {
    const { supabase, active } = await getActiveContext();
    const [kelas, mapel, pembagian] = await Promise.all([listKelas(supabase, active.id), listMataPelajaran(supabase), listPembagianMengajar(supabase, active.id)]);
    const targetClass = kelas.find((k) => k.id === classId);
    if (!targetClass) return { ok: false, error: "Kelas target tidak ditemukan pada konteks akademik aktif." };
    const assignments = pembagian.filter((p) => p.status === "aktif" && p.kelasId === classId);
    if (!assignments.length) return { ok: false, error: `Belum ada Pembagian Mengajar aktif untuk ${targetClass.tingkat} ${targetClass.namaRombel}.` };
    if (intent === "schedule_one_subject") return { ok: false, error: "Pilih mata pelajaran melalui kolom perintah untuk aksi satu mapel. Quick Action ini tidak akan menebak mapel." };
    const subjectTargets = new Map<string, number>();
    for (const item of assignments) subjectTargets.set(item.mataPelajaranId, (subjectTargets.get(item.mataPelajaranId) ?? 0) + item.jpPerMinggu);
    const rows = [...subjectTargets.entries()].map(([subjectId, target]) => ({ name: mapel.find((m) => m.id === subjectId)?.nama ?? "", target })).filter((x) => x.name && x.target > 0).map((x) => `${x.name} ${x.target} JP`);
    if (!rows.length) return { ok: false, error: "Tidak ada target JP aktif yang dapat direncanakan." };
    const command = `${intent === "fill_empty_slots" ? "Isi slot kosong" : "Susun semua mata pelajaran"} kelas ${targetClass.tingkat} ${targetClass.namaRombel}.\n${rows.join("\n")}`;
    return { ok: true, data: await planScheduleFromCommand(supabase, active.id, command) };
  } catch (err) { return { ok: false, error: toPlainErrorMessage(err, "Gagal menjalankan Quick Action AI.") }; }
}

export async function saveAiCandidatesAction(drafts: Parameters<typeof saveCandidatesAction>[0]): Promise<AiActionResult<{ savedCount: number; skippedCount: number; savedIds: string[] }>> {
  const first = drafts[0];
  const reason = first ? summarizeAiAction(buildAiAction({ actionType: "tambah_jp", destination: "jadwal", targetEntity: { classId: first.classId, subjectId: first.subjectId, teacherId: first.teacherId }, currentValue: null, proposedValue: { jumlahSlot: drafts.length }, reason: `Menyimpan ${drafts.length} slot jadwal candidate hasil rekomendasi SAKALA AI.`, evidence: ["Target JP", "Pembagian Mengajar", "Jadwal committed"], risk: "rendah" })) : null;
  return saveCandidatesAction(drafts, "ai", reason);
}

export async function kurangiJpAction(assignmentId: string): Promise<AiActionResult<{ archived: boolean }>> {
  try {
    const { supabase } = await getActiveContext();
    const existing = await scheduleAssignmentUseCases.getScheduleAssignment(supabase, assignmentId);
    const reason = existing ? summarizeAiAction(buildAiAction({ actionType: "kurangi_jp", destination: "jadwal", targetEntity: { classId: existing.classId, subjectId: existing.subjectId, teacherId: existing.teacherId }, currentValue: { day: existing.day, periodStart: existing.periodStart, periodEnd: existing.periodEnd }, proposedValue: null, reason: "Menghapus satu slot jadwal karena JP mapel ini melebihi target resmi.", evidence: ["Target JP", "Jadwal committed"], risk: "sedang" })) : "[SAKALA AI] Mengurangi JP kelebihan.";
    const result = await scheduleAssignmentUseCases.archiveOrDeleteAssignment(supabase, assignmentId, "ai", reason);
    const verify = await scheduleAssignmentUseCases.getScheduleAssignment(supabase, assignmentId);
    const confirmed = result.archived ? verify?.status === "archived" : verify === null;
    if (!confirmed) return { ok: false, error: "Perubahan belum bisa dipastikan tersimpan — data resmi belum mencerminkan penghapusan ini. Coba lagi." };
    return { ok: true, data: result };
  } catch (err) { return { ok: false, error: toPlainErrorMessage(err, "Gagal mengurangi JP.") }; }
}

export async function tetapkanGuruAction(kelasId: string, mataPelajaranId: string, guruId: string, jpPerMinggu: number): Promise<AiActionResult<null>> {
  try {
    const { supabase, active } = await getActiveContext();
    const reason = summarizeAiAction(buildAiAction({ actionType: "tetapkan_guru", destination: "pembagian_mengajar", targetEntity: { classId: kelasId, subjectId: mataPelajaranId, teacherId: guruId }, currentValue: null, proposedValue: { jpPerMinggu }, reason: `Mengusulkan guru untuk mapel yang belum punya guru sama sekali (${jpPerMinggu} JP).`, evidence: ["Target JP", "Pembagian Mengajar (guru yang sudah mengajar mapel sama di kelas lain)"], risk: "rendah" }));
    await createPembagianMengajar(supabase, { academicContextId: active.id, guruId, mataPelajaranId, kelasId, jpPerMinggu, status: "aktif" }, "ai", reason);
    return { ok: true, data: null };
  } catch (err) { return { ok: false, error: toPlainErrorMessage(err, "Gagal menetapkan guru.") }; }
}

export async function rollbackAiCandidatesAction(ids: string[]): Promise<AiActionResult<{ removedCount: number; unconfirmedIds: string[] }>> {
  try {
    const { supabase } = await getActiveContext();
    let removed = 0; const unconfirmedIds: string[] = [];
    for (const id of ids) {
      await scheduleAssignmentUseCases.archiveOrDeleteAssignment(supabase, id, "ai", "[SAKALA AI] Rollback — membatalkan candidate yang baru disimpan sendiri oleh AI.");
      const verify = await scheduleAssignmentUseCases.getScheduleAssignment(supabase, id);
      if (verify === null) removed += 1; else unconfirmedIds.push(id);
    }
    return { ok: true, data: { removedCount: removed, unconfirmedIds } };
  } catch (err) { return { ok: false, error: toPlainErrorMessage(err, "Gagal mengembalikan candidate.") }; }
}

export async function commitAiCandidatesAction(academicContextId: string, assignmentIds: string[], label: string, changeSummary: string | null): Promise<AiActionResult<{ versionId: string; conflictsByAssignment: Record<string, import("@/lib/domain/conflict").ScheduleConflict[]> }>> {
  return commitAssignmentsAction(academicContextId, assignmentIds, label, changeSummary);
}
