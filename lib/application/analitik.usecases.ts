// Application layer — Analitik (Bagian belum bernomor, step 17 Build Pipeline).
// Prinsip hemat resource: TIDAK ada query baru selain yang sudah dipakai
// Dashboard (Bagian 31) dan Target JP View (Bagian 29) — modul ini murni
// menyusun ulang (reshape) data yang sudah di-fetch, plus satu tambahan
// query assignment untuk breakdown per-guru. Snapshot kondisi SAAT INI,
// TIDAK ada histori/tren antar waktu (sengaja, demi hemat limit).

import type { SupabaseClient } from "@supabase/supabase-js";
import { listGuru } from "@/lib/application/guru.usecases";
import { getTargetJpView, type TargetJpRow, type TargetJpStatus } from "@/lib/application/targetJp.usecases";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";

const ASSIGNMENT_ACTIVE_STATUSES = new Set(["draft", "candidate", "committed"]);

export interface AnalitikBebanGuru {
  guruId: string;
  guruNama: string;
  /** Total JP committed saat ini (jam mengajar riil terjadwal, bukan target). */
  totalJamCommitted: number;
  jumlahKombinasi: number;
}

export interface AnalitikJpBreakdown {
  status: TargetJpStatus;
  label: string;
  count: number;
}

export interface AnalitikKonflikRow {
  id: string;
  mataPelajaranNama: string;
  kelasLabel: string;
  targetJp: number;
  /** JP yang belum punya guru sama sekali — authority dari tabel Target JP resmi, bukan Pembagian Mengajar. */
  belumSiapJp: number;
  status: TargetJpStatus;
}

export interface AnalitikView {
  /** Distribusi beban mengajar guru saat ini, diurutkan dari beban tertinggi. Bukan cuma top-5 (lihat Dashboard) — daftar penuh untuk analitik. */
  bebanGuru: AnalitikBebanGuru[];
  /** Breakdown status Target JP per kombinasi Kelas+Mapel (authority resmi), untuk chart ringkasan. */
  jpBreakdown: AnalitikJpBreakdown[];
  /** Kombinasi yang guru-nya belum lengkap ditentukan — JP resmi yang masih "Belum Siap". */
  konflikAktif: AnalitikKonflikRow[];
  totalKombinasiAktif: number;
}

const JP_STATUS_LABEL: Record<TargetJpStatus, string> = {
  belum_siap: "Guru Belum Ditentukan",
  siap_belum_terjadwal: "Siap, Belum Terjadwal",
  sebagian_terjadwal: "Sebagian Terjadwal",
  lengkap: "Lengkap Terjadwal",
};
const JP_STATUS_ORDER: TargetJpStatus[] = ["belum_siap", "siap_belum_terjadwal", "sebagian_terjadwal", "lengkap"];

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

  // --- Breakdown status Target JP (reshape dari targetJpView.rows, tidak query baru) ---
  const countByStatus = new Map<TargetJpStatus, number>();
  for (const row of targetJpView.rows) {
    countByStatus.set(row.status, (countByStatus.get(row.status) ?? 0) + 1);
  }
  const jpBreakdown: AnalitikJpBreakdown[] = JP_STATUS_ORDER.map((status) => ({
    status,
    label: JP_STATUS_LABEL[status],
    count: countByStatus.get(status) ?? 0,
  }));

  // --- Kombinasi yang guru-nya belum lengkap ditentukan (authority: Target JP resmi) ---
  const konflikAktif: AnalitikKonflikRow[] = targetJpView.rows
    .filter((r): r is TargetJpRow & { status: "belum_siap" } => r.status === "belum_siap")
    .map((r) => ({
      id: r.id,
      mataPelajaranNama: r.mataPelajaranNama,
      kelasLabel: r.kelasLabel,
      targetJp: r.targetJp,
      belumSiapJp: r.belumSiapJp,
      status: r.status,
    }))
    .sort((a, b) => b.belumSiapJp - a.belumSiapJp);

  return {
    bebanGuru,
    jpBreakdown,
    konflikAktif,
    totalKombinasiAktif: targetJpView.rows.length,
  };
}
