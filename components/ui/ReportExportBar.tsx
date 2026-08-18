"use client";

import { Download, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { useState } from "react";
import { exportCsv, exportExcel, exportPdf, type ReportColumn, type ReportRow } from "@/lib/export/reportExport";
import Button from "./Button";

export default function ReportExportBar({
  title,
  context,
  columns,
  rows,
  landscape = true,
}: {
  title: string;
  context?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  landscape?: boolean;
}) {
  const [busy, setBusy] = useState<"pdf" | "excel" | "csv" | null>(null);
  async function run(kind: "pdf" | "excel" | "csv") {
    setBusy(kind);
    try {
      if (kind === "pdf") await exportPdf(title, columns, rows, { context, landscape });
      if (kind === "excel") exportExcel(title, columns, rows, context);
      if (kind === "csv") exportCsv(title, columns, rows);
    } catch {
      // Keep export controls non-blocking; the caller's normal page state remains intact.
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3">
      <div className="mr-1 flex items-center gap-2 text-[12px] font-semibold text-ink-700">
        <Download size={15} /> Export laporan
        {rows.length === 0 && <span className="font-normal text-ink-400">· belum ada data, template tetap tersedia</span>}
      </div>
      <Button variant="secondary" size="sm" loading={busy === "pdf"} onClick={() => run("pdf")}>
        <FileText size={14} /> PDF A4
      </Button>
      <Button variant="secondary" size="sm" loading={busy === "excel"} onClick={() => run("excel")}>
        <FileSpreadsheet size={14} /> Excel
      </Button>
      <Button variant="secondary" size="sm" loading={busy === "csv"} onClick={() => run("csv")}>
        <Table2 size={14} /> CSV
      </Button>
    </div>
  );
}
