// Domain layer — entity, value object, invariant. TIDAK BOLEH import Supabase atau React.
// Bagian 25/88 — Jadwal Operational Workspace: fungsi murni untuk menyusun
// "read model" grid (hari x periode) dari data yang SUDAH diambil pemanggil
// (Jam Pelajaran, Slot Template, Schedule Assignment). Tidak melakukan query
// apa pun — Application/Presentation layer yang bertanggung jawab mengambil
// data mentahnya dan menentukan scope (Per Kelas/Per Guru/Per Ruangan,
// Harian/Mingguan) sebelum memanggil buildJadwalGrid().

import type { HariSekolah, JamPelajaran } from "@/lib/domain/jamPelajaran";
import type { SlotTemplate } from "@/lib/domain/slotTemplate";
import { isFixedSlot } from "@/lib/domain/slotTemplate";
import type { ScheduleAssignment } from "@/lib/domain/scheduleAssignment";
import { periodsOverlap } from "@/lib/domain/scheduleAssignment";

/** Bagian 25.3 — minimum cell state, tidak boleh dikurangi. "Loading"/"Error"
 * murni state UI client-side (bukan hasil komputasi grid) — disediakan di
 * sini hanya supaya satu union type dipakai konsisten oleh Presentation. */
export type CellState =
  | "empty"
  | "occupied"
  | "fixed_activity"
  | "conflict"
  | "incomplete"
  | "complete"
  | "loading"
  | "error";

export type JadwalViewBy = "kelas" | "guru" | "ruangan";
export type JadwalRangeMode = "mingguan" | "harian";

export interface GridRow {
  nomorUrut: number;
  /** "mixed" — kasus langka: hari berbeda mendaftarkan jenis berbeda untuk nomor urut yang sama. */
  jenis: "pembelajaran" | "istirahat" | "mixed";
}

export interface GridCell {
  day: HariSekolah;
  nomorUrut: number;
  state: CellState;
  /** Info jam untuk hari INI spesifik — null kalau hari ini tidak mendaftarkan nomor urut ini sama sekali. */
  jamPelajaran: JamPelajaran | null;
  slotTemplate: SlotTemplate | null;
  assignment: ScheduleAssignment | null;
  /** Terisi kalau state === "conflict" — lebih dari satu assignment aktif menempati sel yang sama. */
  conflictingAssignmentIds: string[];
}

export interface GridData {
  days: HariSekolah[];
  rows: GridRow[];
  cells: GridCell[];
}

export function cellKey(day: HariSekolah, nomorUrut: number): string {
  return `${day}__${nomorUrut}`;
}

/**
 * Menyusun grid dari data yang sudah difilter pemanggil sesuai scope
 * (Per Kelas/Guru/Ruangan — filter assignments; Harian/Mingguan — filter days).
 * `assignments` HARUS sudah difilter ke status yang relevan untuk ditampilkan
 * (Bagian 25 — "Jadwal is the committed/operational timetable", jadi normalnya
 * hanya status "committed") sebelum dipanggil di sini.
 */
export function buildJadwalGrid(params: {
  days: HariSekolah[];
  jamPelajaranList: JamPelajaran[];
  slotTemplates: SlotTemplate[];
  assignments: ScheduleAssignment[];
}): GridData {
  const { days, jamPelajaranList, slotTemplates, assignments } = params;
  const dayOrder = new Set(days);
  const relevantJam = jamPelajaranList.filter((j) => dayOrder.has(j.hari));

  const nomorUrutSet = new Set<number>();
  relevantJam.forEach((j) => nomorUrutSet.add(j.nomorUrut));
  const sortedNomor = Array.from(nomorUrutSet).sort((a, b) => a - b);

  const rows: GridRow[] = sortedNomor.map((nomorUrut) => {
    const kinds = new Set(relevantJam.filter((j) => j.nomorUrut === nomorUrut).map((j) => j.jenis));
    const jenis = kinds.size === 1 ? (Array.from(kinds)[0] as "pembelajaran" | "istirahat") : "mixed";
    return { nomorUrut, jenis };
  });

  const cells: GridCell[] = [];

  for (const day of days) {
    for (const nomorUrut of sortedNomor) {
      const jam = relevantJam.find((j) => j.hari === day && j.nomorUrut === nomorUrut) ?? null;
      const slot = slotTemplates.find((s) => s.hari === day && s.nomorUrut === nomorUrut) ?? null;
      const dayAssignments = assignments.filter(
        (a) => a.day === day && periodsOverlap(a.periodStart, a.periodEnd, nomorUrut, nomorUrut)
      );

      let state: CellState;
      let conflictingIds: string[] = [];

      if (!jam) {
        state = "empty";
      } else if (dayAssignments.length > 1) {
        // Idealnya tidak pernah terjadi untuk status committed (commit sudah
        // menegakkan blocking conflict) — tapi grid tetap mendeteksi supaya
        // anomali data (mis. race condition) tetap terlihat, bukan tersembunyi.
        state = "conflict";
        conflictingIds = dayAssignments.map((a) => a.id);
      } else if (dayAssignments.length === 1) {
        state = "occupied";
      } else if (jam.jenis === "istirahat") {
        state = "fixed_activity";
      } else if (slot && isFixedSlot(slot.jenisSlot)) {
        state = "fixed_activity";
      } else {
        state = "empty";
      }

      cells.push({
        day,
        nomorUrut,
        state,
        jamPelajaran: jam,
        slotTemplate: slot,
        assignment: dayAssignments[0] ?? null,
        conflictingAssignmentIds: conflictingIds,
      });
    }
  }

  return { days, rows, cells };
}

/** Bagian 25.4 / 26.1 — heuristik UI cepat untuk menampilkan "+ Tambah Jadwal".
 * Ini BUKAN validasi final — hanya menyaring sel yang sudah pasti mustahil dari
 * data grid (occupied/fixed/istirahat/nonaktif). Validasi penuh (termasuk
 * status draft/candidate yang tidak tampil di grid committed) tetap dilakukan
 * server-side lewat validateAssignment sebelum benar-benar disimpan. */
export function isEligibleForAdd(cell: GridCell): boolean {
  return cell.state === "empty" && cell.jamPelajaran !== null && cell.jamPelajaran.jenis === "pembelajaran" && cell.jamPelajaran.status === "aktif";
}
