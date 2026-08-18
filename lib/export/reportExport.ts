"use client";

import * as XLSX from "xlsx";

export type ReportColumn = { key: string; label: string };
export type ReportRow = Record<string, string | number | null | undefined>;

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCsv(title: string, columns: ReportColumn[], rows: ReportRow[]) {
  const headers = columns.map((c) => c.label);
  const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const body = rows.length ? rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(",")) : [];
  const csv = [headers.map(csvCell).join(","), ...body].join("\r\n");
  downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-${stamp()}.csv`);
}

export function exportExcel(title: string, columns: ReportColumn[], rows: ReportRow[], context?: string) {
  const data = rows.map((r) => Object.fromEntries(columns.map((c) => [c.label, r[c.key] ?? ""])));
  const sheetRows = [
    [title],
    context ? [context] : [],
    [],
    columns.map((c) => c.label),
    ...data.map((r) => columns.map((c) => r[c.label] ?? "")),
  ].filter((r) => r.length);
  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  ws["!cols"] = columns.map((c) => ({ wch: Math.max(14, Math.min(34, c.label.length + 8)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Laporan");
  XLSX.writeFile(wb, `${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-${stamp()}.xlsx`);
}

export async function exportPdf(
  title: string,
  columns: ReportColumn[],
  rows: ReportRow[],
  options: { context?: string; schoolName?: string; periodLabel?: string; filterLabel?: string; landscape?: boolean } = {},
) {
  const response = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title,
      columns,
      rows,
      context: options.context,
      schoolName: options.schoolName,
      periodLabel: options.periodLabel,
      filterLabel: options.filterLabel,
      landscape: options.landscape ?? true,
    }),
  });
  if (!response.ok) throw new Error("PDF gagal dibuat");
  downloadBlob(await response.blob(), `${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-${stamp()}.pdf`);
}
