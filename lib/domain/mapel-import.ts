// Domain layer — validasi baris import Mata Pelajaran. Fungsi murni, sama pola
// dengan guru-import.ts (Bagian 33-34: import Mapel mengikuti pola Guru).
//
// Pack 09b (lanjutan): kolom baru Kelompok/WarnaJadwal/PrioritasPenjadwalan/
// JenisMapel ikut divalidasi — semua optional, tidak memblokir baris jika kosong
// atau tidak ada di file (Bagian 22-23).

import type {
  StatusAktif,
  MataPelajaranDraft,
  PrioritasPenjadwalan,
  JenisMapel,
} from "./mata-pelajaran";
import { PRIORITAS_OPTIONS, JENIS_MAPEL_OPTIONS } from "./mata-pelajaran";

export interface MapelImportIssue {
  column: string;
  message: string;
}

export interface MapelImportRowResult {
  rowNumber: number;
  nama: string;
  kode: string;
  status: "valid" | "perlu_diperbaiki";
  issues: MapelImportIssue[];
  draft: MataPelajaranDraft;
}

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function parsePrioritas(raw: string): { value?: PrioritasPenjadwalan; invalid: boolean } {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return { invalid: false };
  const match = PRIORITAS_OPTIONS.find((p) => p === trimmed);
  return match ? { value: match, invalid: false } : { invalid: true };
}

function parseJenis(raw: string): { value?: JenisMapel; invalid: boolean } {
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (!trimmed) return { invalid: false };
  const match = JENIS_MAPEL_OPTIONS.find((j) => j === trimmed);
  return match ? { value: match, invalid: false } : { invalid: true };
}

export function validateMapelImportRows(
  rows: Record<string, string>[],
  existingKodes: Set<string>,
  existingNames: Set<string>
): MapelImportRowResult[] {
  const seenKodes = new Set<string>();
  const seenNames = new Set<string>();

  return rows.map((raw, index) => {
    const rowNumber = index + 1;
    const nama = (raw["NamaMapel"] ?? raw["Nama"] ?? "").trim();
    const kode = (raw["KodeMapel"] ?? raw["Kode"] ?? "").trim();
    const statusRaw = (raw["StatusAktif"] ?? "aktif").trim().toLowerCase();
    const status: StatusAktif = statusRaw === "nonaktif" ? "nonaktif" : "aktif";
    const targetJpRaw = (raw["TargetJPPerRombel"] ?? raw["JP"] ?? "").trim();
    const kelompok = (raw["Kelompok"] ?? "").trim();
    const warnaJadwal = (raw["WarnaJadwal"] ?? "").trim();
    const prioritasRaw = (raw["PrioritasPenjadwalan"] ?? "").trim();
    const jenisRaw = (raw["JenisMapel"] ?? "").trim();

    const issues: MapelImportIssue[] = [];

    if (nama.length < 2) {
      issues.push({ column: "NamaMapel", message: "Wajib diisi, minimal 2 karakter." });
    }

    let targetJpPerRombel: number | null = null;
    if (targetJpRaw) {
      const parsed = Number(targetJpRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        issues.push({ column: "TargetJPPerRombel", message: `"${targetJpRaw}" bukan angka yang valid.` });
      } else {
        targetJpPerRombel = parsed;
      }
    }

    if (warnaJadwal && !HEX_COLOR_PATTERN.test(warnaJadwal)) {
      issues.push({ column: "WarnaJadwal", message: `"${warnaJadwal}" harus format hex, mis. #6366F1.` });
    }

    const prioritas = parsePrioritas(prioritasRaw);
    if (prioritas.invalid) {
      issues.push({
        column: "PrioritasPenjadwalan",
        message: `"${prioritasRaw}" tidak dikenali. Gunakan: tinggi, normal, atau rendah.`,
      });
    }

    const jenis = parseJenis(jenisRaw);
    if (jenis.invalid) {
      issues.push({
        column: "JenisMapel",
        message: `"${jenisRaw}" tidak dikenali. Lihat sheet REFERENSI untuk nilai yang valid.`,
      });
    }

    if (kode) {
      const key = kode.toUpperCase();
      if (existingKodes.has(key)) {
        issues.push({ column: "KodeMapel", message: `"${kode}" sudah digunakan mapel lain di database.` });
      } else if (seenKodes.has(key)) {
        issues.push({ column: "KodeMapel", message: `"${kode}" duplikat pada baris lain di file ini.` });
      } else {
        seenKodes.add(key);
      }
    }

    if (nama) {
      const nameKey = nama.toLowerCase();
      if (seenNames.has(nameKey)) {
        issues.push({ column: "NamaMapel", message: `"${nama}" duplikat pada baris lain di file ini.` });
      } else {
        seenNames.add(nameKey);
        if (existingNames.has(nameKey)) {
          issues.push({
            column: "NamaMapel",
            message: `Mapel "${nama}" kemungkinan sudah terdaftar. Periksa dulu sebelum impor.`,
          });
        }
      }
    }

    return {
      rowNumber,
      nama: nama || "(tanpa nama)",
      kode,
      status: issues.length === 0 ? "valid" : "perlu_diperbaiki",
      issues,
      draft: {
        nama,
        kode,
        status,
        targetJpPerRombel,
        kelompok: kelompok || undefined,
        warnaJadwal: warnaJadwal || undefined,
        prioritasPenjadwalan: prioritas.value,
        jenisMapel: jenis.value,
      },
    };
  });
}
