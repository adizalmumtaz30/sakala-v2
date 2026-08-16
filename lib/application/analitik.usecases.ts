// Application layer — Analitik (Bagian belum bernomor, step 17 Build Pipeline).
// Prinsip hemat resource: TIDAK ada query baru selain yang sudah dipakai
// Dashboard (Bagian 31) dan Target JP View (Bagian 29) — modul ini murni
// menyusun ulang (reshape) data yang sudah di-fetch, plus satu tambahan
// query assignment untuk breakdown per-guru. Snapshot kondisi SAAT INI,
// TIDAK ada histori/tren antar waktu (sengaja, demi hemat limit).

import type { SupabaseClient } from "@supabase/supabase-js";
import { listGuru } from "@/lib/application/guru.usecases";
import { getTargetJpView, type TargetJpRow } from "@/lib/application/targetJp.usecases";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import type { JpSummaryStatus } from "@/lib/domain/pembagianMengajar";

const ASSIGNMENT_ACTIVE_STATUSES = new Set(["draft", "candidate", "committed"]);

export interface AnalitikBebanGuru {
  guruId: string;
  guruNama: string;
  /** Total JP committed saat ini (jam mengajar riil terjadwal, bukan target). */
  totalJamCommitted: number;
  jumlahKombinasi: number;
}

export interface AnalitikJpBreakdown {
  status: JpSummaryStatus;
  label: string;
  count: number;
}

export interface AnalitikKonflikRow {
  id: string;
  guruNama: string;
  mataPelajaranNama: string;
  kelasLabel: string;
  targetJp: number;
  scheduledJp: number;
  /** Positif = kekurangan JP (belum lengkap), negatif = kelebihan JP (JP_MISMATCH "lebih"). */
  difference: number;
  status: Extract<JpSummaryStatus, "sebagian" | "lebih">;
}

export interface AnalitikView {
  /** Distribusi beban mengajar guru saat ini, diurutkan dari beban tertinggi. Bukan cuma top-5 (lihat Dashboard) — daftar penuh untuk analitik. */
  bebanGuru: AnalitikBebanGuru[];
  /** Breakdown status JP per kombinasi Guru+Mapel+Kelas, untuk chart ringkasan. */
  jpBreakdown: AnalitikJpBreakdown[];
  /** Kombinasi yang berstatus "sebagian" (belum lengkap) atau "lebih" (melebihi target) — dua-duanya bentuk JP_MISMATCH aktif. */
  konflikAktif: AnalitikKonflikRow[];
  totalKombinasiAktif: number;
}

const JP_STATUS_LABEL: Record<JpSummaryStatus, string> = {
  kosong: "Belum Mulai",
  sebagian: "Belum Lengkap",
  penuh: "Lengkap",
  lebih: "Melebihi Target",
};
const JP_STATUS_ORDER: JpSummaryStatus[] = ["kosong", "sebagian", "penuh", "lebih"];

export async function getAnalitikView(supabase: SupabaseClient, academicContextId: string): Promise<AnalitikView> {
  // Reuse Target JP View — sudah menghitung scheduledJp per kombinasi, jadi
  // tidak perlu query/agregasi JP ulang di sini.
  const [targetJpView, guruList, assignments] = await Promise.all([
    getTargetJpView(supabase, academicContextId),
    listGuru(supabase),
    scheduleAssignmentRepository.findByContext(supabase, academicContextId),
  ]);

  // --- Distribusi Beban Mengajar (committed saja — jam riil, bukan draft/candidate) ---
  const committed = assignments.filter((a) => a.status === "committed");
  const guruById = new Map(guruList.map((g) => [g.id, g.namaGuru]));
  const bebanMap = new Map<string, { jam: number; kombinasi: Set<string> }>();
  for (const a of committed) {
    const entry = bebanMap.get(a.teacherId) ?? { jam: 0, kombinasi: new Set<string>() };
    entry.jam += a.periodEnd - a.periodStart + 1;
    entry.kombinasi.add(`${a.subjectId}:${a.classId}`);
    bebanMap.set(a.teacherId, entry);
  }
  const bebanGuru: AnalitikBebanGuru[] = Array.from(bebanMap.entries())
    .map(([guruId, v]) => ({
      guruId,
      guruNama: guruById.get(guruId) ?? "(guru tidak ditemukan)",
      totalJamCommitted: v.jam,
      jumlahKombinasi: v.kombinasi.size,
    }))
    .sort((a, b) => b.totalJamCommitted - a.totalJamCommitted);

  // --- Breakdown status JP (reshape dari targetJpView.rows, tidak query baru) ---
  const countByStatus = new Map<JpSummaryStatus, number>();
  for (const row of targetJpView.rows) {
    countByStatus.set(row.status, (countByStatus.get(row.status) ?? 0) + 1);
  }
  const jpBreakdown: AnalitikJpBreakdown[] = JP_STATUS_ORDER.map((status) => ({
    status,
    label: JP_STATUS_LABEL[status],
    count: countByStatus.get(status) ?? 0,
  }));

  // --- Konflik aktif (JP_MISMATCH saat ini: "sebagian" = belum lengkap, "lebih" = melebihi target) ---
  const konflikAktif: AnalitikKonflikRow[] = targetJpView.rows
    .filter((r): r is TargetJpRow & { status: "sebagian" | "lebih" } => r.status === "sebagian" || r.status === "lebih")
    .map((r) => ({
      id: r.id,
      guruNama: r.guruNama,
      mataPelajaranNama: r.mataPelajaranNama,
      kelasLabel: r.kelasLabel,
      targetJp: r.targetJp,
      scheduledJp: r.scheduledJp,
      difference: r.difference,
      status: r.status,
    }))
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  return {
    bebanGuru,
    jpBreakdown,
    konflikAktif,
    totalKombinasiAktif: targetJpView.rows.length,
  };
}
