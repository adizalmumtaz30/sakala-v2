// Application layer — Dashboard (Bagian 31, step 16 Build Pipeline).
// "Dashboard is a summary, not the place where all editing occurs" — jadi
// murni agregasi read-only dari data yang sudah ada, TIDAK ada mutation di sini.
//
// Hierarchy Bagian 31.1 yang diimplementasikan di V1 ini:
//   Academic Context → Greeting/Workspace → Key Metrics → Primary Schedule
//   Insight → Workload/Distribution
// SENGAJA BELUM (butuh Analytics/Riwayat/Notifikasi — step 17-19 di Build
// Pipeline yang belum dibangun, jadi tidak ada sumber data untuk ini):
//   Heatmap, Upcoming Agenda, Recent Activity
// Ini deferral eksplisit sesuai Bagian 70 ("tidak boleh diam-diam
// dihilangkan") — bukan lupa, dicatat di sini dan di changelog.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSchoolProfile } from "@/lib/application/schoolProfile.usecases";
import { listAcademicContexts } from "@/lib/application/academicContext.usecases";
import { listGuru } from "@/lib/application/guru.usecases";
import { listMataPelajaran } from "@/lib/application/mata-pelajaran.usecases";
import { listKelas } from "@/lib/application/kelas.usecases";
import { listRuangan } from "@/lib/application/ruangan.usecases";
import { listPembagianMengajar } from "@/lib/application/pembagianMengajar.usecases";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import { summarizeJp, type JpSummaryStatus } from "@/lib/domain/pembagianMengajar";
import type { SchoolProfile } from "@/lib/domain/schoolProfile";
import type { AcademicContext } from "@/lib/domain/academicContext";

export interface DashboardKeyMetrics {
  totalGuruAktif: number;
  totalMataPelajaranAktif: number;
  totalKelas: number;
  totalRuangan: number;
  totalPembagianMengajarAktif: number;
  totalJadwalCommitted: number;
  /** Total Jam Tatap Muka: jumlah JP (periodEnd-periodStart+1) seluruh jadwal committed dalam konteks aktif. */
  totalJtm: number;
}

export interface DashboardJpInsight {
  totalKombinasi: number;
  countByStatus: Record<JpSummaryStatus, number>;
  /** 0-100, dibulatkan. Kombinasi "lebih" dihitung sebagai lengkap (bukan bonus di atas 100%). */
  completionPercent: number;
}

export interface DashboardWorkloadEntry {
  guruId: string;
  namaGuru: string;
  totalJamMengajar: number;
}

export interface DashboardSummary {
  schoolProfile: SchoolProfile | null;
  activeContext: AcademicContext | null;
  metrics: DashboardKeyMetrics;
  jpInsight: DashboardJpInsight;
  /** Top 5 guru berdasarkan total jam mengajar committed — kosong kalau belum ada jadwal committed. */
  workloadTop: DashboardWorkloadEntry[];
}

const EMPTY_JP_COUNT: Record<JpSummaryStatus, number> = { kosong: 0, sebagian: 0, penuh: 0, lebih: 0 };

/**
 * Ringkasan lengkap satu konteks akademik aktif untuk Dashboard. Kalau tidak
 * ada konteks aktif, hanya schoolProfile+activeContext(null) yang diisi —
 * Presentation layer yang memutuskan render EmptyState "Belum ada konteks
 * akademik aktif" (Bagian 31.3, state "incomplete setup").
 */
export async function getDashboardSummary(supabase: SupabaseClient): Promise<DashboardSummary> {
  const [schoolProfile, contexts, guruList, mapelList, kelasList, ruanganList] = await Promise.all([
    getSchoolProfile(supabase),
    listAcademicContexts(supabase),
    listGuru(supabase),
    listMataPelajaran(supabase),
    listKelas(supabase),
    listRuangan(supabase),
  ]);

  const activeContext = contexts.find((c) => c.isActive) ?? null;

  const baseMetrics: DashboardKeyMetrics = {
    totalGuruAktif: guruList.filter((g) => g.status === "aktif").length,
    totalMataPelajaranAktif: mapelList.filter((m) => m.status === "aktif").length,
    totalKelas: kelasList.length,
    totalRuangan: ruanganList.length,
    totalPembagianMengajarAktif: 0,
    totalJadwalCommitted: 0,
    totalJtm: 0,
  };

  if (!activeContext) {
    return {
      schoolProfile,
      activeContext: null,
      metrics: baseMetrics,
      jpInsight: { totalKombinasi: 0, countByStatus: EMPTY_JP_COUNT, completionPercent: 0 },
      workloadTop: [],
    };
  }

  const [pembagianList, assignments] = await Promise.all([
    listPembagianMengajar(supabase, activeContext.id),
    scheduleAssignmentRepository.findByContext(supabase, activeContext.id),
  ]);

  const pembagianAktif = pembagianList.filter((p) => p.status === "aktif");
  const committed = assignments.filter((a) => a.status === "committed");

  const countByStatus: Record<JpSummaryStatus, number> = { ...EMPTY_JP_COUNT };
  for (const item of pembagianAktif) {
    const { status } = summarizeJp(item.jpPerMinggu, item.jpTerjadwal ?? 0);
    countByStatus[status] += 1;
  }
  const selesai = countByStatus.penuh + countByStatus.lebih;
  const completionPercent = pembagianAktif.length === 0 ? 0 : Math.round((selesai / pembagianAktif.length) * 100);

  const guruById = new Map(guruList.map((g) => [g.id, g.namaGuru]));
  const jamByGuru = new Map<string, number>();
  let totalJtm = 0;
  for (const a of committed) {
    const jp = a.periodEnd - a.periodStart + 1;
    jamByGuru.set(a.teacherId, (jamByGuru.get(a.teacherId) ?? 0) + jp);
    totalJtm += jp;
  }
  const workloadTop: DashboardWorkloadEntry[] = Array.from(jamByGuru.entries())
    .map(([guruId, totalJamMengajar]) => ({ guruId, namaGuru: guruById.get(guruId) ?? "(guru tidak ditemukan)", totalJamMengajar }))
    .sort((a, b) => b.totalJamMengajar - a.totalJamMengajar)
    .slice(0, 5);

  return {
    schoolProfile,
    activeContext,
    metrics: {
      ...baseMetrics,
      totalPembagianMengajarAktif: pembagianAktif.length,
      totalJadwalCommitted: committed.length,
      totalJtm,
    },
    jpInsight: { totalKombinasi: pembagianAktif.length, countByStatus, completionPercent },
    workloadTop,
  };
}
