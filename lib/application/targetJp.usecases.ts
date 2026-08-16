// Application layer — Regulation / Target JP View (Bagian 29).
// "Keep this focused on scheduling completeness, without qualification
// classification" — jadi murni agregasi read-only kelengkapan JP, TIDAK ada
// mutation, TIDAK ada field kualifikasi guru (itu domain Guru, bukan di sini).

import type { SupabaseClient } from "@supabase/supabase-js";
import { listPembagianMengajar } from "@/lib/application/pembagianMengajar.usecases";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import { summarizeJp, type JpSummaryStatus } from "@/lib/domain/pembagianMengajar";
import type { HariSekolah } from "@/lib/domain/jamPelajaran";

const ASSIGNMENT_ACTIVE_STATUSES = new Set(["draft", "candidate", "committed"]);

export interface TargetJpScheduleRef {
  day: HariSekolah;
  periodStart: number;
  periodEnd: number;
  status: string;
}

export interface TargetJpRow {
  id: string;
  guruId: string;
  guruNama: string;
  mataPelajaranId: string;
  mataPelajaranNama: string;
  mataPelajaranWarna?: string;
  kelasId: string;
  kelasLabel: string;
  targetJp: number;
  scheduledJp: number;
  /** targetJp - scheduledJp. Negatif berarti "lebih" (over target). */
  difference: number;
  /** Persentase mentah, TIDAK di-cap 100 — supaya "Melebihi Target" (>100%) tetap kelihatan apa adanya. */
  completionPercent: number;
  status: JpSummaryStatus;
  /** Bagian 29: "Clicking the state must expose the exact affected subject/schedule". */
  schedules: TargetJpScheduleRef[];
}

export interface TargetJpSubjectRollup {
  mataPelajaranId: string;
  mataPelajaranNama: string;
  mataPelajaranWarna?: string;
  targetJp: number;
  scheduledJp: number;
  difference: number;
  completionPercent: number;
  status: JpSummaryStatus;
}

export interface TargetJpView {
  rows: TargetJpRow[];
  subjectRollups: TargetJpSubjectRollup[];
  overallTargetJp: number;
  overallScheduledJp: number;
  overallCompletionPercent: number;
}

function percent(scheduled: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((scheduled / target) * 100);
}

export async function getTargetJpView(supabase: SupabaseClient, academicContextId: string): Promise<TargetJpView> {
  const [pembagianList, assignments] = await Promise.all([
    listPembagianMengajar(supabase, academicContextId),
    scheduleAssignmentRepository.findByContext(supabase, academicContextId),
  ]);

  const activeAssignments = assignments.filter((a) => ASSIGNMENT_ACTIVE_STATUSES.has(a.status));
  const pembagianAktif = pembagianList.filter((p) => p.status === "aktif");

  const rows: TargetJpRow[] = pembagianAktif.map((item) => {
    const schedules = activeAssignments
      .filter((a) => a.teacherId === item.guruId && a.subjectId === item.mataPelajaranId && a.classId === item.kelasId)
      .map((a) => ({ day: a.day, periodStart: a.periodStart, periodEnd: a.periodEnd, status: a.status }))
      .sort((a, b) => a.periodStart - b.periodStart);

    const scheduledJp = item.jpTerjadwal ?? 0;
    const { status } = summarizeJp(item.jpPerMinggu, scheduledJp);

    return {
      id: item.id,
      guruId: item.guruId,
      guruNama: item.guruNama ?? "(tidak diketahui)",
      mataPelajaranId: item.mataPelajaranId,
      mataPelajaranNama: item.mataPelajaranNama ?? "(tidak diketahui)",
      mataPelajaranWarna: item.mataPelajaranWarna,
      kelasId: item.kelasId,
      kelasLabel: item.kelasLabel ?? "(tidak diketahui)",
      targetJp: item.jpPerMinggu,
      scheduledJp,
      difference: item.jpPerMinggu - scheduledJp,
      completionPercent: percent(scheduledJp, item.jpPerMinggu),
      status,
      schedules,
    };
  });

  const rollupMap = new Map<string, { nama: string; warna?: string; target: number; scheduled: number }>();
  for (const row of rows) {
    const existing = rollupMap.get(row.mataPelajaranId);
    if (existing) {
      existing.target += row.targetJp;
      existing.scheduled += row.scheduledJp;
    } else {
      rollupMap.set(row.mataPelajaranId, {
        nama: row.mataPelajaranNama,
        warna: row.mataPelajaranWarna,
        target: row.targetJp,
        scheduled: row.scheduledJp,
      });
    }
  }
  const subjectRollups: TargetJpSubjectRollup[] = Array.from(rollupMap.entries())
    .map(([mataPelajaranId, v]) => {
      const { status } = summarizeJp(v.target, v.scheduled);
      return {
        mataPelajaranId,
        mataPelajaranNama: v.nama,
        mataPelajaranWarna: v.warna,
        targetJp: v.target,
        scheduledJp: v.scheduled,
        difference: v.target - v.scheduled,
        completionPercent: percent(v.scheduled, v.target),
        status,
      };
    })
    .sort((a, b) => a.mataPelajaranNama.localeCompare(b.mataPelajaranNama));

  const overallTargetJp = rows.reduce((sum, r) => sum + r.targetJp, 0);
  const overallScheduledJp = rows.reduce((sum, r) => sum + r.scheduledJp, 0);

  return {
    rows: rows.sort((a, b) => a.guruNama.localeCompare(b.guruNama) || a.mataPelajaranNama.localeCompare(b.mataPelajaranNama)),
    subjectRollups,
    overallTargetJp,
    overallScheduledJp,
    overallCompletionPercent: percent(overallScheduledJp, overallTargetJp),
  };
}
