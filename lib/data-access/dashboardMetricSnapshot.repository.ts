// Data Access layer — repository untuk dashboard_metric_snapshot (histori KPI harian).
// Business date SAKALA mengikuti Asia/Jakarta; timestamp penyimpanan tetap UTC.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface DashboardMetricSnapshotInput { guruAktif: number; kelas: number; mapelAktif: number; ruangan: number; totalJtm: number; jadwalCommitted: number; }
export interface DashboardMetricSnapshotRow extends DashboardMetricSnapshotInput { snapshotDate: string; }

type Row = { snapshot_date: string; guru_aktif: number; kelas: number; mapel_aktif: number; ruangan: number; total_jtm: number; jadwal_committed: number; };
function toDomain(row: Row): DashboardMetricSnapshotRow {
  return { snapshotDate: row.snapshot_date, guruAktif: row.guru_aktif, kelas: row.kelas, mapelAktif: row.mapel_aktif, ruangan: row.ruangan, totalJtm: row.total_jtm, jadwalCommitted: row.jadwal_committed };
}

function businessDateJakarta(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export const dashboardMetricSnapshotRepository = {
  /** Upsert KPI snapshot berdasarkan tanggal bisnis Asia/Jakarta, bukan UTC. */
  async upsertToday(supabase: SupabaseClient, academicContextId: string, metrics: DashboardMetricSnapshotInput): Promise<void> {
    const snapshotDate = businessDateJakarta();
    const { error } = await supabase.from("dashboard_metric_snapshot").upsert(
      { academic_context_id: academicContextId, snapshot_date: snapshotDate, guru_aktif: metrics.guruAktif, kelas: metrics.kelas, mapel_aktif: metrics.mapelAktif, ruangan: metrics.ruangan, total_jtm: metrics.totalJtm, jadwal_committed: metrics.jadwalCommitted, updated_at: new Date().toISOString() },
      { onConflict: "academic_context_id,snapshot_date" },
    );
    if (error) throw error;
  },

  /** N snapshot terbaru (menaik berdasarkan tanggal) untuk konteks akademik — dasar sparkline+trend. */
  async listRecent(supabase: SupabaseClient, academicContextId: string, limit = 8): Promise<DashboardMetricSnapshotRow[]> {
    const { data, error } = await supabase.from("dashboard_metric_snapshot").select("snapshot_date, guru_aktif, kelas, mapel_aktif, ruangan, total_jtm, jadwal_committed").eq("academic_context_id", academicContextId).order("snapshot_date", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).map(toDomain).reverse();
  },
};
