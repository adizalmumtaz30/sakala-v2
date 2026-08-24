// Application layer — impor Jadwal dari spreadsheet. Baris valid disimpan
// sebagai status "candidate" (BUKAN "committed" langsung) — operator wajib
// meninjau & commit eksplisit lewat alur candidate review yang sudah ada
// (Jadwal Cerdas), konsisten dengan prinsip "No Silent Mutation".

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseJadwalImportRow } from "@/lib/domain/jadwal-import";
import { guruRepository } from "@/lib/data-access/guru.repository";
import { kelasRepository } from "@/lib/data-access/kelas.repository";
import { mataPelajaranRepository } from "@/lib/data-access/mata-pelajaran.repository";
import { ruanganRepository } from "@/lib/data-access/ruangan.repository";
import { saveAssignmentDraft } from "@/lib/application/scheduleAssignment.usecases";
import type { ScheduleAssignmentDraft } from "@/lib/domain/scheduleAssignment";

export interface JadwalImportRowResult {
  rowNumber: number;
  primaryLabel: string;
  secondaryLabel?: string;
  status: "valid" | "perlu_diperbaiki";
  issues: { column: string; message: string }[];
}

async function loadLookups(supabase: SupabaseClient) {
  const [guru, kelas, mapel, ruangan] = await Promise.all([
    guruRepository.findAll(supabase),
    kelasRepository.findAll(supabase),
    mataPelajaranRepository.findAll(supabase),
    ruanganRepository.findAll(supabase),
  ]);
  return {
    guruByName: new Map(guru.map((g) => [g.namaGuru.trim().toLowerCase(), g.id])),
    kelasByName: new Map(kelas.map((k) => [k.namaRombel.trim().toLowerCase(), k.id])),
    mapelByName: new Map(mapel.map((m) => [m.nama.trim().toLowerCase(), m.id])),
    ruanganByName: new Map(ruangan.map((r) => [r.nama.trim().toLowerCase(), r.id])),
  };
}

/** Preview-only: parsing struktural + cek nama entitas dikenal SAKALA. Tidak menulis DB, tidak cek bentrok (itu terjadi saat commit). */
export async function validateJadwalImportRows(supabase: SupabaseClient, rows: Record<string, string>[]): Promise<JadwalImportRowResult[]> {
  const lookups = await loadLookups(supabase);
  return rows.map((raw, i) => {
    const parsed = parseJadwalImportRow(raw, i + 1);
    const issues = [...parsed.issues];
    if (parsed.kelasNama && !lookups.kelasByName.has(parsed.kelasNama.toLowerCase())) {
      issues.push({ column: "Kelas", message: `Kelas "${parsed.kelasNama}" tidak ditemukan di data Kelas.` });
    }
    if (parsed.mapelNama && !lookups.mapelByName.has(parsed.mapelNama.toLowerCase())) {
      issues.push({ column: "MataPelajaran", message: `Mata pelajaran "${parsed.mapelNama}" tidak ditemukan di data Mata Pelajaran.` });
    }
    if (parsed.guruNama && !lookups.guruByName.has(parsed.guruNama.toLowerCase())) {
      issues.push({ column: "Guru", message: `Guru "${parsed.guruNama}" tidak ditemukan di data Guru.` });
    }
    if (parsed.ruanganNama && !lookups.ruanganByName.has(parsed.ruanganNama.toLowerCase())) {
      issues.push({ column: "Ruangan", message: `Ruangan "${parsed.ruanganNama}" tidak ditemukan di data Ruangan.` });
    }
    return {
      rowNumber: parsed.rowNumber,
      primaryLabel: `${parsed.mapelNama || "(mapel?)"} · ${parsed.kelasNama || "(kelas?)"}`,
      secondaryLabel: parsed.guruNama || undefined,
      status: issues.length > 0 ? "perlu_diperbaiki" : "valid",
      issues,
    };
  });
}

/**
 * Simpan baris yang lolos validasi struktural sebagai candidate. Bentrok
 * (guru/kelas/ruangan dobel jadwal) dicek per-baris oleh saveAssignmentDraft
 * sendiri (lewat Conflict Engine) — baris yang bentrok TIDAK disimpan
 * (masuk hitungan skipped), bukan menggagalkan seluruh batch impor.
 */
export async function commitJadwalImportRows(
  supabase: SupabaseClient,
  academicContextId: string,
  scheduleModelId: string,
  rows: Record<string, string>[]
): Promise<{ imported: number; skipped: number }> {
  const lookups = await loadLookups(supabase);
  let imported = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const parsed = parseJadwalImportRow(rows[i], i + 1);
    const classId = lookups.kelasByName.get(parsed.kelasNama.toLowerCase());
    const subjectId = lookups.mapelByName.get(parsed.mapelNama.toLowerCase());
    const teacherId = lookups.guruByName.get(parsed.guruNama.toLowerCase());
    const roomId = parsed.ruanganNama ? lookups.ruanganByName.get(parsed.ruanganNama.toLowerCase()) ?? null : null;
    if (!parsed.day || parsed.periodStart === null || parsed.periodEnd === null || !classId || !subjectId || !teacherId) {
      skipped += 1;
      continue;
    }
    const draft: ScheduleAssignmentDraft = {
      academicContextId,
      scheduleModelId,
      classId,
      subjectId,
      teacherId,
      roomId,
      day: parsed.day,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      activityType: "belajar_mengajar",
      status: "candidate",
      source: "imported",
      versionId: null,
    };
    try {
      await saveAssignmentDraft(supabase, draft);
      imported += 1;
    } catch {
      skipped += 1;
    }
  }
  return { imported, skipped };
}
