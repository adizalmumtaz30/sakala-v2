import * as XLSX from "xlsx";
import type { ImportModule } from "./module-contracts";

export interface ControlledTemplateColumn {
  key: string;
  required: boolean;
  format: string;
  example: string;
  dropdownValues?: string[];
}

export interface ControlledTemplateOptions {
  module: ImportModule;
  label: string;
  schemaVersion?: string;
}

function applyFormat(cell: XLSX.CellObject | undefined, format: string) {
  if (!cell) return;
  if (/angka|integer|jumlah|jp/i.test(format)) cell.z = "0";
  if (/tanggal/i.test(format)) cell.z = "dd/mm/yyyy";
  if (/waktu|jam/i.test(format)) cell.z = "hh:mm";
}

function builtInDropdown(key: string): string[] | undefined {
  const values: Record<string, string[]> = {
    Tingkat: ["VII", "VIII", "IX"],
    Semester: ["Ganjil", "Genap"],
    Hari: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
    JamKe: Array.from({ length: 12 }, (_, i) => String(i + 1)),
    JenisKelamin: ["L", "P"],
    StatusAktif: ["aktif", "nonaktif"],
    TargetJP: Array.from({ length: 11 }, (_, i) => String(i)),
  };
  return values[key];
}

function referenceRange(rows: string[][], key: string): { start: number; end: number } | undefined {
  const markerIndex = rows.findIndex((row) => row?.[0]?.trim() === `Referensi ${key}`);
  if (markerIndex < 0) return undefined;
  const start = markerIndex + 2;
  let end = start - 1;
  for (let i = markerIndex + 1; i < rows.length; i += 1) {
    const value = rows[i]?.[0]?.trim();
    if (!value || rows[i]?.length !== 1) break;
    end = i + 1;
  }
  return end >= start ? { start, end } : undefined;
}

function safeName(key: string) {
  return `SAKALA_DV_${key.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

/**
 * Module-specific SAKALA import workbook.
 * No AutoFilter and NO sheet protection. User data rows stay editable.
 * Excel Data Validation dropdowns are applied only to input rows (row 2 onward).
 */
export function buildControlledTemplateWorkbook(
  columns: ControlledTemplateColumn[],
  referensiRows: string[][] = [],
  options: ControlledTemplateOptions,
): Buffer {
  const workbook = XLSX.utils.book_new();
  const version = options.schemaVersion ?? "2.3";

  const data = XLSX.utils.aoa_to_sheet([
    columns.map((c) => c.key),
    columns.map((c) => c.example),
  ]);
  data["!cols"] = columns.map(() => ({ wch: 24 }));

  columns.forEach((column, i) => {
    const cell = data[XLSX.utils.encode_cell({ r: 1, c: i })];
    if (cell) applyFormat(cell, column.format);
  });

  type ValidationRule = {
    sqref: string;
    formula1: string;
    errorTitle?: string;
    errorMessage?: string;
    promptTitle?: string;
    promptMessage?: string;
  };
  data["!dataValidation"] = [] as ValidationRule[];

  if (!workbook.Workbook) workbook.Workbook = {};
  if (!workbook.Workbook.Names) workbook.Workbook.Names = [];

  columns.forEach((column, i) => {
    const col = XLSX.utils.encode_col(i);
    const ref = referenceRange(referensiRows, column.key);
    const explicit = column.dropdownValues ?? builtInDropdown(column.key);
    let formula1: string | undefined;

    if (ref) {
      const name = safeName(column.key);
      workbook.Workbook!.Names!.push({
        Name: name,
        Ref: `REFERENSI!$A$${ref.start}:$A$${ref.end}`,
      });
      formula1 = `=${name}`;
    } else if (explicit?.length && explicit.join(",").length <= 250) {
      formula1 = `"${explicit.join(",")}"`;
    }

    if (formula1) {
      data["!dataValidation"]!.push({
        sqref: `${col}2:${col}1048576`,
        formula1,
        errorTitle: "Pilihan tidak valid",
        errorMessage: `Pilih ${column.key} dari daftar SAKALA yang tersedia.`,
        promptTitle: "Pilih dari daftar SAKALA",
        promptMessage: "Klik panah pada sel ini untuk memilih. Tidak perlu mengetik manual.",
      });
    }
  });

  XLSX.utils.book_append_sheet(workbook, data, "DATA");

  const instructions = XLSX.utils.aoa_to_sheet([
    ["Kolom", "Wajib / Opsional", "Format SAKALA", "Cara mengisi", "Contoh"],
    ...columns.map((c) => [
      c.key,
      c.required ? "Wajib" : "Opsional",
      c.format,
      c.dropdownValues || builtInDropdown(c.key)
        ? "Klik sel → pilih dari dropdown"
        : "Isi manual sesuai format SAKALA",
      c.example,
    ]),
  ]);
  instructions["!cols"] = [
    { wch: 24 }, { wch: 18 }, { wch: 44 }, { wch: 36 }, { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(workbook, instructions, "PETUNJUK");

  const references = referensiRows.length
    ? referensiRows
    : [["Referensi tambahan tidak diperlukan untuk template ini."]];
  const referenceSheet = XLSX.utils.aoa_to_sheet(references);
  referenceSheet["!cols"] = [{ wch: 34 }];
  XLSX.utils.book_append_sheet(workbook, referenceSheet, "REFERENSI");

  const metadata = XLSX.utils.aoa_to_sheet([
    ["SAKALA TEMPLATE METADATA", ""],
    ["Target Module", options.label],
    ["Module Key", options.module],
    ["Schema Version", version],
    ["Purpose", `Import khusus modul ${options.label}. Template ini tidak boleh digunakan pada modul lain.`],
    ["Input Policy", "Tidak dikunci. Baris data tetap editable. Field yang memiliki pilihan menggunakan Excel Data Validation dropdown mulai baris 2."],
    ["Filter Policy", "Tidak menggunakan AutoFilter pada header utama."],
  ]);
  metadata["!cols"] = [{ wch: 24 }, { wch: 78 }];
  XLSX.utils.book_append_sheet(workbook, metadata, "SAKALA_TEMPLATE");

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    cellStyles: true,
  }) as Buffer;
}
