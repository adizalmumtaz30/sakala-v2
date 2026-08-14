// Domain layer — validasi baris import Mata Pelajaran. Fungsi murni, sama pola
// dengan guru-import.ts (Bagian 33-34: import Mapel mengikuti pola Guru).

import type { StatusAktif, MataPelajaranDraft } from "./mata-pelajaran";

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
    const targetJpRaw = (raw["TargetJPPerRombel"] ?? "").trim();

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
      draft: { nama, kode, status, targetJpPerRombel },
    };
  });
}
