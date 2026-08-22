// Data Access layer — repository untuk dashboard_metric_snapshot (histori KPI
// harian, sumber sparkline+trend KPI card). Satu-satunya tempat yang boleh
// menulis query Supabase untuk tabel ini.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface DashboardMetricSnapshotInput {
  guruAktif: number;
  kelas: number;
  mapelAktif: number;
  ruangan: number;
  totalJtm: number;
  jadwalCommitted: number;
}

export interface DashboardMetricSnapshotRow extends DashboardMetricSnapshotInput {
  snapshotDate: string; // YYYY-MM-DD
}

type Row = {
  snapshot_date: string;
  guru_aktif: number;
  kelas: number;
  mapel_aktif: number;
  ruangan: number;
  total_jtm: number;
  jadwal_committed: number;
};

function toDomain(row: Row): DashboardMetricSnapshotRow {
  return {
    snapshotDate: row.snapshot_date,
    guruAktif: row.guru_aktif,
    kelas: row.kelas,
    mapelAktif: row.mapel_aktif,
    ruangan: row.ruangan,
    totalJtm: row.total_jtm,
    jadwalCommitted: row.jadwal_committed,
  };
}

export const dashboardMetricSnapshotRepository = {
  /**
   * Upsert baris hari ini (snapshotDate = tanggal server saat ini, UTC) untuk
   * konteks akademik aktif. Idempotent — dipanggil di setiap load dashboard,
   * jadi nilai hari ini selalu yang paling baru, tapi baris hari-hari
   * sebelumnya tidak pernah ditimpa (unique constraint per tanggal).
   */
  async upsertToday(supabase: SupabaseClient, academicContextId: string, metrics: DashboardMetricSnapshotInput): Promise<void> {
    const snapshotDate = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("dashboard_metric_snapshot").upsert(
      {
        academic_context_id: academicContextId,
        snapshot_date: snapshotDate,
        guru_aktif: metrics.guruAktif,
        kelas: metrics.kelas,
        mapel_aktif: metrics.mapelAktif,
        ruangan: metrics.ruangan,
        total_jtm: metrics.totalJtm,
        jadwal_committed: metrics.jadwalCommitted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "academic_context_id,snapshot_date" },
    );
    if (error) throw error;
  },

  /** N snapshot terbaru (menaik berdasarkan tanggal) untuk konteks akademik — dasar sparkline+trend. */
  async listRecent(supabase: SupabaseClient, academicContextId: string, limit = 8): Promise<DashboardMetricSnapshotRow[]> {
    const { data, error } = await supabase
      .from("dashboard_metric_snapshot")
      .select("snapshot_date, guru_aktif, kelas, mapel_aktif, ruangan, total_jtm, jadwal_committed")
      .eq("academic_context_id", academicContextId)
      .order("snapshot_date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toDomain).reverse(); // balik jadi ascending (lama -> baru)
  },
};
