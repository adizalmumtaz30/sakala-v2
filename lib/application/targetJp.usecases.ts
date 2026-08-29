// Application layer — Regulation / Target JP View (Bagian 29).
//
// SOURCE-OF-TRUTH CONTRACT:
// target_jp = official requirement.
// committed assignments = official scheduled JP.
// candidate assignments = pending proposal and MUST NOT inflate scheduled KPI.
// Pembagian Mengajar = teacher allocation, not a substitute for target authority.

import type { SupabaseClient } from "@supabase/supabase-js";
import { listPembagianMengajar } from "@/lib/application/pembagianMengajar.usecases";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import { isCandidateStatus, isCommittedStatus } from "@/lib/domain/academicMetrics";
import type { HariSekolah } from "@/lib/domain/jamPelajaran";

export interface TargetJpScheduleRef { id: string; day: HariSekolah; periodStart: number; periodEnd: number; status: string; }
export type TargetJpStatus = "belum_siap" | "siap_belum_terjadwal" | "sebagian_terjadwal" | "lengkap";
export interface TargetJpGuruAssignment { guruId: string; guruNama: string; jpPerMinggu: number; jpTerjadwal: number; }

export interface TargetJpRow {
  id: string; kelasId: string; kelasLabel: string; mataPelajaranId: string; mataPelajaranNama: string; mataPelajaranWarna?: string;
  targetJp: number; siapJp: number; belumSiapJp: number;
  /** Official scheduled JP: committed only. */
  terjadwalJp: number; belumTerjadwalJp: number;
  /** Pending proposal: candidate only. */
  pendingCandidateJp: number;
  assignedExcessJp: number; scheduledExcessJp: number; status: TargetJpStatus;
  guruAssignments: TargetJpGuruAssignment[]; schedules: TargetJpScheduleRef[];
}

export interface TargetJpSubjectRollup {
  mataPelajaranId: string; mataPelajaranNama: string; mataPelajaranWarna?: string;
  targetJp: number; siapJp: number; belumSiapJp: number; terjadwalJp: number; belumTerjadwalJp: number;
  pendingCandidateJp: number; status: TargetJpStatus;
}

export interface TargetJpView {
  rows: TargetJpRow[]; subjectRollups: TargetJpSubjectRollup[];
  overallTargetJp: number; overallSiapJp: number; overallBelumSiapJp: number;
  overallTerjadwalJp: number; overallBelumTerjadwalJp: number; overallPendingCandidateJp: number;
}

function assignmentJp(a: { periodStart: number; periodEnd: number }): number { return Math.max(0, a.periodEnd - a.periodStart + 1); }
function classify(targetJp: number, siapJp: number, terjadwalJp: number): TargetJpStatus {
  if (siapJp < targetJp) return "belum_siap";
  if (terjadwalJp <= 0) return "siap_belum_terjadwal";
  if (terjadwalJp < siapJp) return "sebagian_terjadwal";
  return "lengkap";
}

export async function getTargetJpView(supabase: SupabaseClient, academicContextId: string): Promise<TargetJpView> {
  const [targetRowsResult, pembagianList, assignments] = await Promise.all([
    supabase.from("target_jp").select("kelas_id, mata_pelajaran_id, target_jp, kelas:kelas_id(tingkat,nama_rombel), mata_pelajaran:mata_pelajaran_id(nama,warna_jadwal)").eq("academic_context_id", academicContextId),
    listPembagianMengajar(supabase, academicContextId),
    scheduleAssignmentRepository.findByContext(supabase, academicContextId),
  ]);
  if (targetRowsResult.error) throw new Error(`Gagal membaca Target JP resmi: ${targetRowsResult.error.message}`);

  type TargetRow = { kelas_id: string; mata_pelajaran_id: string; target_jp: number; kelas: { tingkat: string; nama_rombel: string } | null; mata_pelajaran: { nama: string; warna_jadwal: string | null } | null };
  const officialTargets = (targetRowsResult.data ?? []) as unknown as TargetRow[];
  const pembagianAktif = pembagianList.filter((p) => p.status === "aktif");
  const committedAssignments = assignments.filter((a) => isCommittedStatus(a.status));
  const candidateAssignments = assignments.filter((a) => isCandidateStatus(a.status));

  const rows: TargetJpRow[] = officialTargets.map((target) => {
    const key = `${target.kelas_id}:${target.mata_pelajaran_id}`;
    const guruEntries = pembagianAktif.filter((p) => p.kelasId === target.kelas_id && p.mataPelajaranId === target.mata_pelajaran_id);
    const guruAssignments = guruEntries.map((g) => ({ guruId: g.guruId, guruNama: g.guruNama ?? "(tidak diketahui)", jpPerMinggu: g.jpPerMinggu, jpTerjadwal: g.jpTerjadwal ?? 0 }));
    const assignedJp = guruAssignments.reduce((sum, g) => sum + g.jpPerMinggu, 0);
    const siapJp = Math.min(target.target_jp, assignedJp);
    const belumSiapJp = target.target_jp - siapJp;
    const assignedExcessJp = Math.max(0, assignedJp - target.target_jp);
    const committedForTarget = committedAssignments.filter((a) => a.subjectId === target.mata_pelajaran_id && a.classId === target.kelas_id);
    const candidateForTarget = candidateAssignments.filter((a) => a.subjectId === target.mata_pelajaran_id && a.classId === target.kelas_id);
    const committedRaw = committedForTarget.reduce((sum, a) => sum + assignmentJp(a), 0);
    const candidateJp = candidateForTarget.reduce((sum, a) => sum + assignmentJp(a), 0);
    const terjadwalJp = Math.min(siapJp, committedRaw);
    const belumTerjadwalJp = Math.max(0, siapJp - terjadwalJp);
    const scheduledExcessJp = Math.max(0, committedRaw - siapJp);
    const schedules = committedForTarget.map((a) => ({ id: a.id, day: a.day, periodStart: a.periodStart, periodEnd: a.periodEnd, status: a.status })).sort((a, b) => a.periodStart - b.periodStart);
    return { id: key, kelasId: target.kelas_id, kelasLabel: target.kelas ? `${target.kelas.tingkat} ${target.kelas.nama_rombel}` : "(tidak diketahui)", mataPelajaranId: target.mata_pelajaran_id, mataPelajaranNama: target.mata_pelajaran?.nama ?? "(tidak diketahui)", mataPelajaranWarna: target.mata_pelajaran?.warna_jadwal ?? undefined, targetJp: target.target_jp, siapJp, belumSiapJp, terjadwalJp, belumTerjadwalJp, pendingCandidateJp: candidateJp, assignedExcessJp, scheduledExcessJp, status: classify(target.target_jp, siapJp, terjadwalJp), guruAssignments, schedules };
  });

  const rollupMap = new Map<string, { nama: string; warna?: string; target: number; siap: number; terjadwal: number; candidate: number }>();
  for (const row of rows) {
    const existing = rollupMap.get(row.mataPelajaranId);
    if (existing) { existing.target += row.targetJp; existing.siap += row.siapJp; existing.terjadwal += row.terjadwalJp; existing.candidate += row.pendingCandidateJp; }
    else rollupMap.set(row.mataPelajaranId, { nama: row.mataPelajaranNama, warna: row.mataPelajaranWarna, target: row.targetJp, siap: row.siapJp, terjadwal: row.terjadwalJp, candidate: row.pendingCandidateJp });
  }
  const subjectRollups = Array.from(rollupMap.entries()).map(([mataPelajaranId, v]) => ({ mataPelajaranId, mataPelajaranNama: v.nama, mataPelajaranWarna: v.warna, targetJp: v.target, siapJp: v.siap, belumSiapJp: v.target - v.siap, terjadwalJp: v.terjadwal, belumTerjadwalJp: Math.max(0, v.siap - v.terjadwal), pendingCandidateJp: v.candidate, status: classify(v.target, v.siap, v.terjadwal) })).sort((a, b) => a.mataPelajaranNama.localeCompare(b.mataPelajaranNama));
  return { rows: rows.sort((a, b) => a.kelasLabel.localeCompare(b.kelasLabel) || a.mataPelajaranNama.localeCompare(b.mataPelajaranNama)), subjectRollups, overallTargetJp: rows.reduce((sum, r) => sum + r.targetJp, 0), overallSiapJp: rows.reduce((sum, r) => sum + r.siapJp, 0), overallBelumSiapJp: rows.reduce((sum, r) => sum + r.belumSiapJp, 0), overallTerjadwalJp: rows.reduce((sum, r) => sum + r.terjadwalJp, 0), overallBelumTerjadwalJp: rows.reduce((sum, r) => sum + r.belumTerjadwalJp, 0), overallPendingCandidateJp: rows.reduce((sum, r) => sum + r.pendingCandidateJp, 0) };
}
