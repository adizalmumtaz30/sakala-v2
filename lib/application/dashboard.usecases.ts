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
import { scanCommittedConflicts } from "@/lib/application/conflictEngine";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import { dashboardMetricSnapshotRepository } from "@/lib/data-access/dashboardMetricSnapshot.repository";
import { summarizeJp, type JpSummaryStatus } from "@/lib/domain/pembagianMengajar";
import type { SchoolProfile } from "@/lib/domain/schoolProfile";
import type { AcademicContext } from "@/lib/domain/academicContext";

export interface DashboardMetricSpark {
  /** Nilai historis menaik berdasarkan tanggal (termasuk hari ini), maks 8 titik. Kosong kalau belum ada histori tersimpan. */
  values: number[];
  /** Selisih vs titik sebelumnya. null kalau belum ada pembanding (baru 1 hari/histori kosong) — JANGAN ditampilkan sebagai 0 atau dikarang. */
  trend: number | null;
}

export type DashboardMetricTrends = Record<"totalGuruAktif" | "totalKelas" | "totalMataPelajaranAktif" | "totalRuangan" | "totalJtm" | "totalJadwalCommitted", DashboardMetricSpark>;

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

export interface DashboardScheduleConflictSummary {
  total: number;
  /** Maks 5 contoh pesan konflik teratas — cukup utk operator lihat sekilas, bukan daftar lengkap (buka /jadwal utk itu). */
  samples: string[];
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
  /** Bentrok guru/kelas/ruangan NYATA yang aktif sekarang di jadwal committed — bukan histori, bukan validasi 1 kandidat. */
  scheduleConflicts: DashboardScheduleConflictSummary;
  /** Sparkline+trend per KPI card, dari histori snapshot harian nyata (bukan fabrikasi) — null kalau belum ada konteks aktif. */
  metricTrends: DashboardMetricTrends | null;
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
      scheduleConflicts: { total: 0, samples: [] },
      metricTrends: null,
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

  const finalMetrics: DashboardKeyMetrics = {
    ...baseMetrics,
    totalPembagianMengajarAktif: pembagianAktif.length,
    totalJadwalCommitted: committed.length,
    totalJtm,
  };

  // Sparkline+trend KPI card: upsert snapshot hari ini (idempotent, nilai selalu paling baru
  // sepanjang hari), lalu ambil histori nyata. Kalau gagal (mis. migration belum sampai di
  // lingkungan tertentu), dashboard tetap tampil — cuma tanpa sparkline/trend, bukan error.
  let metricTrends: DashboardMetricTrends | null = null;
  try {
    await dashboardMetricSnapshotRepository.upsertToday(supabase, activeContext.id, {
      guruAktif: finalMetrics.totalGuruAktif,
      kelas: finalMetrics.totalKelas,
      mapelAktif: finalMetrics.totalMataPelajaranAktif,
      ruangan: finalMetrics.totalRuangan,
      totalJtm: finalMetrics.totalJtm,
      jadwalCommitted: finalMetrics.totalJadwalCommitted,
    });
    const history = await dashboardMetricSnapshotRepository.listRecent(supabase, activeContext.id, 8);
    const spark = (pick: (r: (typeof history)[number]) => number): DashboardMetricSpark => {
      const values = history.map(pick);
      const trend = values.length >= 2 ? values[values.length - 1] - values[values.length - 2] : null;
      return { values, trend };
    };
    metricTrends = {
      totalGuruAktif: spark((r) => r.guruAktif),
      totalKelas: spark((r) => r.kelas),
      totalMataPelajaranAktif: spark((r) => r.mapelAktif),
      totalRuangan: spark((r) => r.ruangan),
      totalJtm: spark((r) => r.totalJtm),
      totalJadwalCommitted: spark((r) => r.jadwalCommitted),
    };
  } catch {
    metricTrends = null;
  }

  // Konflik jadwal NYATA (bentrok guru/kelas/ruangan) yang aktif sekarang di committed assignments —
  // beda dari JP_MISMATCH (jpInsight di atas, itu soal target JP belum/lebih terpenuhi).
  const kelasById = new Map(kelasList.map((k) => [k.id, k.namaRombel]));
  const ruanganById = new Map(ruanganList.map((r) => [r.id, r.nama]));
  const rawConflicts = scanCommittedConflicts(committed, { guru: guruById, kelas: kelasById, ruangan: ruanganById });
  const scheduleConflicts: DashboardScheduleConflictSummary = {
    total: rawConflicts.length,
    samples: rawConflicts.slice(0, 5).map((c) => c.message),
  };

  return {
    schoolProfile,
    activeContext,
    metrics: finalMetrics,
    jpInsight: { totalKombinasi: pembagianAktif.length, countByStatus, completionPercent },
    workloadTop,
    scheduleConflicts,
    metricTrends,
  };
}
