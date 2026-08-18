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

/**
 * Generates a module-specific SAKALA import workbook.
 * Only required structure/format is system-controlled; DATA input remains editable.
 */
export function buildControlledTemplateWorkbook(
  columns: ControlledTemplateColumn[],
  referensiRows: string[][] = [],
  options: ControlledTemplateOptions,
): Buffer {
  const workbook = XLSX.utils.book_new();
  const version = options.schemaVersion ?? "2.3";
  const data = XLSX.utils.aoa_to_sheet([columns.map(c => c.key), columns.map(c => c.example)]);
  data["!cols"] = columns.map(() => ({ wch: 24 }));
  data["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(Math.max(0, columns.length - 1))}1` };
  XLSX.utils.book_append_sheet(workbook, data, "DATA");

  const instructions = XLSX.utils.aoa_to_sheet([
    ["Kolom", "Wajib / Opsional", "Format SAKALA", "Contoh"],
    ...columns.map(c => [c.key, c.required ? "Wajib" : "Opsional", c.format, c.example]),
  ]);
  instructions["!cols"] = [{ wch: 24 }, { wch: 18 }, { wch: 44 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(workbook, instructions, "PETUNJUK");

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(
    referensiRows.length ? referensiRows : [["Tidak ada referensi tambahan untuk template ini."]]
  ), "REFERENSI");

  const metadata = XLSX.utils.aoa_to_sheet([
    ["SAKALA TEMPLATE METADATA", ""],
    ["Target Module", options.label],
    ["Module Key", options.module],
    ["Schema Version", version],
    ["Purpose", `Import khusus modul ${options.label}. Template ini tidak boleh digunakan pada modul lain.`],
    ["Lock Policy", "Hanya struktur/format wajib dikunci; area DATA yang memang harus diisi user tetap editable."],
  ]);
  metadata["!cols"] = [{ wch: 24 }, { wch: 78 }];
  XLSX.utils.book_append_sheet(workbook, metadata, "SAKALA_TEMPLATE");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
