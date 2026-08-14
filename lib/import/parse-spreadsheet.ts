// Parser file XLSX/CSV di browser (Bagian 24-25: drag & drop -> parse sebelum insert).
// Dipakai oleh ImportModal — TIDAK dipanggil dari server, karena butuh File API browser.

import * as XLSX from "xlsx";

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Baca file, ambil sheet bernama "DATA" (sesuai struktur Template SAKALA — Bagian 21).
 * Kalau tidak ada sheet "DATA" (mis. CSV polos), fallback ke sheet pertama.
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheetName =
    workbook.SheetNames.find((name) => name.trim().toUpperCase() === "DATA") ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const headers = json.length > 0 ? Object.keys(json[0]) : [];

  const rows = json.map((record) => {
    const row: Record<string, string> = {};
    for (const key of headers) {
      row[key] = String(record[key] ?? "").trim();
    }
    return row;
  });

  return { headers, rows };
}
