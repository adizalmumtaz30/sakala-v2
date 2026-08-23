// Application layer — Regulation / Target JP View (Bagian 29).
//
// SAKALA MASTER RULE (PRODUCTION FLOW, AUTHORITY & AI ACTION CONTRACT):
// Target JP resmi (tabel target_jp, diisi lewat Generate Kurikulum → Commit)
// adalah SATU-SATUNYA authority untuk "berapa yang dibutuhkan". Jumlah baris
// Pembagian Mengajar TIDAK PERNAH boleh dipakai sebagai pengganti angka ini —
// mapel yang belum punya guru tetap harus terhitung sebagai "Belum Siap",
// bukan hilang dari total.
//
// Kasus yang dicegah: kelas dengan Target JP resmi 40, tapi baru 6 mapel
// (19 JP) yang punya guru — sebelumnya overallTargetJp menampilkan 19 (dari
// pembagian mengajar) alih-alih 40 (dari tabel target_jp), dan 21 JP yang
// belum punya guru sama sekali tidak muncul di halaman ini.

import type { SupabaseClient } from "@supabase/supabase-js";
import { listPembagianMengajar } from "@/lib/application/pembagianMengajar.usecases";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import type { HariSekolah } from "@/lib/domain/jamPelajaran";

const ASSIGNMENT_ACTIVE_STATUSES = new Set(["draft", "candidate", "committed"]);

export interface TargetJpScheduleRef {
  day: HariSekolah;
  periodStart: number;
  periodEnd: number;
  status: string;
}

// Rumus 1 (kontrak §8): Target = Siap + Belum Siap.
// Rumus 2: Siap = Terjadwal + Belum Terjadwal.
export type TargetJpStatus = "belum_siap" | "siap_belum_terjadwal" | "sebagian_terjadwal" | "lengkap";

export interface TargetJpGuruAssignment {
  guruId: string;
  guruNama: string;
  jpPerMinggu: number;
  jpTerjadwal: number;
}

export interface TargetJpRow {
  id: string; // "<kelasId>:<mataPelajaranId>"
  kelasId: string;
  kelasLabel: string;
  mataPelajaranId: string;
  mataPelajaranNama: string;
  mataPelajaranWarna?: string;
  /** Resmi dari tabel target_jp — authority. Tidak pernah dihitung ulang dari Pembagian Mengajar. */
  targetJp: number;
  /** JP yang sudah punya guru (Pembagian Mengajar aktif), dibatasi maksimum targetJp. */
  siapJp: number;
  /** targetJp - siapJp. "Guru belum ditentukan" untuk sejumlah ini. */
  belumSiapJp: number;
  /** Dari siapJp, berapa yang sudah masuk Jadwal (draft/candidate/committed). */
  terjadwalJp: number;
  /** siapJp - terjadwalJp. */
  belumTerjadwalJp: number;
  status: TargetJpStatus;
  guruAssignments: TargetJpGuruAssignment[];
  schedules: TargetJpScheduleRef[];
}

export interface TargetJpSubjectRollup {
  mataPelajaranId: string;
  mataPelajaranNama: string;
  mataPelajaranWarna?: string;
  targetJp: number;
  siapJp: number;
  belumSiapJp: number;
  terjadwalJp: number;
  belumTerjadwalJp: number;
  status: TargetJpStatus;
}

export interface TargetJpView {
  rows: TargetJpRow[];
  subjectRollups: TargetJpSubjectRollup[];
  overallTargetJp: number;
  overallSiapJp: number;
  overallBelumSiapJp: number;
  overallTerjadwalJp: number;
  overallBelumTerjadwalJp: number;
}

function classify(targetJp: number, siapJp: number, terjadwalJp: number): TargetJpStatus {
  if (siapJp < targetJp) return "belum_siap";
  if (terjadwalJp <= 0) return "siap_belum_terjadwal";
  if (terjadwalJp < siapJp) return "sebagian_terjadwal";
  return "lengkap";
}

export async function getTargetJpView(supabase: SupabaseClient, academicContextId: string): Promise<TargetJpView> {
  const [targetRowsResult, pembagianList, assignments] = await Promise.all([
    supabase
      .from("target_jp")
      .select("kelas_id, mata_pelajaran_id, target_jp, kelas:kelas_id(tingkat,nama_rombel), mata_pelajaran:mata_pelajaran_id(nama,warna_jadwal)")
      .eq("academic_context_id", academicContextId),
    listPembagianMengajar(supabase, academicContextId),
    scheduleAssignmentRepository.findByContext(supabase, academicContextId),
  ]);

  if (targetRowsResult.error) throw new Error(`Gagal membaca Target JP resmi: ${targetRowsResult.error.message}`);

  type TargetRow = { kelas_id: string; mata_pelajaran_id: string; target_jp: number; kelas: { tingkat: string; nama_rombel: string } | null; mata_pelajaran: { nama: string; warna_jadwal: string | null } | null };
  const officialTargets = (targetRowsResult.data ?? []) as unknown as TargetRow[];

  const activeAssignments = assignments.filter((a) => ASSIGNMENT_ACTIVE_STATUSES.has(a.status));
  const pembagianAktif = pembagianList.filter((p) => p.status === "aktif");

  const rows: TargetJpRow[] = officialTargets.map((target) => {
    const key = `${target.kelas_id}:${target.mata_pelajaran_id}`;
    const guruEntries = pembagianAktif.filter((p) => p.kelasId === target.kelas_id && p.mataPelajaranId === target.mata_pelajaran_id);

    const guruAssignments: TargetJpGuruAssignment[] = guruEntries.map((g) => ({
      guruId: g.guruId,
      guruNama: g.guruNama ?? "(tidak diketahui)",
      jpPerMinggu: g.jpPerMinggu,
      jpTerjadwal: g.jpTerjadwal ?? 0,
    }));

    const assignedJp = guruAssignments.reduce((sum, g) => sum + g.jpPerMinggu, 0);
    const siapJp = Math.min(target.target_jp, assignedJp);
    const belumSiapJp = target.target_jp - siapJp;

    const scheduledRaw = guruAssignments.reduce((sum, g) => sum + g.jpTerjadwal, 0);
    const terjadwalJp = Math.min(siapJp, scheduledRaw);
    const belumTerjadwalJp = siapJp - terjadwalJp;

    const schedules = activeAssignments
      .filter((a) => a.subjectId === target.mata_pelajaran_id && a.classId === target.kelas_id)
      .map((a) => ({ day: a.day, periodStart: a.periodStart, periodEnd: a.periodEnd, status: a.status }))
      .sort((a, b) => a.periodStart - b.periodStart);

    return {
      id: key,
      kelasId: target.kelas_id,
      kelasLabel: target.kelas ? `${target.kelas.tingkat} ${target.kelas.nama_rombel}` : "(tidak diketahui)",
      mataPelajaranId: target.mata_pelajaran_id,
      mataPelajaranNama: target.mata_pelajaran?.nama ?? "(tidak diketahui)",
      mataPelajaranWarna: target.mata_pelajaran?.warna_jadwal ?? undefined,
      targetJp: target.target_jp,
      siapJp,
      belumSiapJp,
      terjadwalJp,
      belumTerjadwalJp,
      status: classify(target.target_jp, siapJp, terjadwalJp),
      guruAssignments,
      schedules,
    };
  });

  const rollupMap = new Map<string, { nama: string; warna?: string; target: number; siap: number; terjadwal: number }>();
  for (const row of rows) {
    const existing = rollupMap.get(row.mataPelajaranId);
    if (existing) {
      existing.target += row.targetJp;
      existing.siap += row.siapJp;
      existing.terjadwal += row.terjadwalJp;
    } else {
      rollupMap.set(row.mataPelajaranId, { nama: row.mataPelajaranNama, warna: row.mataPelajaranWarna, target: row.targetJp, siap: row.siapJp, terjadwal: row.terjadwalJp });
    }
  }
  const subjectRollups: TargetJpSubjectRollup[] = Array.from(rollupMap.entries())
    .map(([mataPelajaranId, v]) => ({
      mataPelajaranId,
      mataPelajaranNama: v.nama,
      mataPelajaranWarna: v.warna,
      targetJp: v.target,
      siapJp: v.siap,
      belumSiapJp: v.target - v.siap,
      terjadwalJp: v.terjadwal,
      belumTerjadwalJp: v.siap - v.terjadwal,
      status: classify(v.target, v.siap, v.terjadwal),
    }))
    .sort((a, b) => a.mataPelajaranNama.localeCompare(b.mataPelajaranNama));

  return {
    rows: rows.sort((a, b) => a.kelasLabel.localeCompare(b.kelasLabel) || a.mataPelajaranNama.localeCompare(b.mataPelajaranNama)),
    subjectRollups,
    overallTargetJp: rows.reduce((sum, r) => sum + r.targetJp, 0),
    overallSiapJp: rows.reduce((sum, r) => sum + r.siapJp, 0),
    overallBelumSiapJp: rows.reduce((sum, r) => sum + r.belumSiapJp, 0),
    overallTerjadwalJp: rows.reduce((sum, r) => sum + r.terjadwalJp, 0),
    overallBelumTerjadwalJp: rows.reduce((sum, r) => sum + r.belumTerjadwalJp, 0),
  };
}
