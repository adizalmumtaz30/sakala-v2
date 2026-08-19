import * as XLSX from "xlsx";
import type { ImportModule } from "./module-contracts";

export interface ControlledTemplateColumn {
  key: string;
  required: boolean;
  format: string;
  example: string;
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

/**
 * Generates a module-specific SAKALA import workbook.
 * Only the required template structure/format is protected.
 * The DATA input row remains editable so users can enter the values required by the module.
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
  data["!autofilter"] = {
    ref: `A1:${XLSX.utils.encode_col(Math.max(0, columns.length - 1))}2`,
  };

  // Header/format structure is protected; the actual input row is intentionally unlocked.
  const headerCells = columns.map((_, i) => XLSX.utils.encode_cell({ r: 0, c: i }));
  const inputCells = columns.map((_, i) => XLSX.utils.encode_cell({ r: 1, c: i }));
  for (const address of headerCells) {
    const cell = data[address];
    if (cell) cell.s = { protection: { locked: true } };
  }
  columns.forEach((column, i) => {
    const cell = data[inputCells[i]];
    if (cell) {
      cell.s = { protection: { locked: false } };
      applyFormat(cell, column.format);
    }
  });
  data["!protect"] = {
    selectLockedCells: false,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: true,
    deleteColumns: false,
    deleteRows: true,
    sort: true,
    autoFilter: true,
  };
  XLSX.utils.book_append_sheet(workbook, data, "DATA");

  const instructions = XLSX.utils.aoa_to_sheet([
    ["Kolom", "Wajib / Opsional", "Format SAKALA", "Contoh"],
    ...columns.map((c) => [c.key, c.required ? "Wajib" : "Opsional", c.format, c.example]),
  ]);
  instructions["!cols"] = [{ wch: 24 }, { wch: 18 }, { wch: 44 }, { wch: 28 }];
  instructions["!protect"] = {
    selectLockedCells: false,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    deleteColumns: false,
    deleteRows: false,
  };
  XLSX.utils.book_append_sheet(workbook, instructions, "PETUNJUK");

  const references = referensiRows.length
    ? referensiRows
    : [["Referensi tambahan tidak diperlukan untuk template ini."]];
  const referenceSheet = XLSX.utils.aoa_to_sheet(references);
  referenceSheet["!protect"] = { selectLockedCells: false, selectUnlockedCells: true };
  XLSX.utils.book_append_sheet(workbook, referenceSheet, "REFERENSI");

  const metadata = XLSX.utils.aoa_to_sheet([
    ["SAKALA TEMPLATE METADATA", ""],
    ["Target Module", options.label],
    ["Module Key", options.module],
    ["Schema Version", version],
    ["Purpose", `Import khusus modul ${options.label}. Template ini tidak boleh digunakan pada modul lain.`],
    ["Lock Policy", "Hanya struktur/format wajib dikunci; area DATA yang memang harus diisi user tetap editable."],
  ]);
  metadata["!cols"] = [{ wch: 24 }, { wch: 78 }];
  metadata["!protect"] = { selectLockedCells: false, selectUnlockedCells: true };
  XLSX.utils.book_append_sheet(workbook, metadata, "SAKALA_TEMPLATE");

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    cellStyles: true,
  }) as Buffer;
}
