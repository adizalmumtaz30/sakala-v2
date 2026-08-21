"use client";

import { Download, FileSpreadsheet, FileText, Table2, ChevronDown } from "lucide-react";
import { useState } from "react";
import { exportCsv, exportExcel, exportPdf, type ReportColumn, type ReportRow } from "@/lib/export/reportExport";
import Button from "./Button";

export default function ReportExportBar({
  title,
  context,
  schoolName,
  periodLabel,
  filterLabel,
  summary,
  columns,
  rows,
  landscape = true,
  compact = false,
}: {
  title: string;
  context?: string;
  schoolName?: string;
  periodLabel?: string;
  filterLabel?: string;
  summary?: { label: string; value: string | number }[];
  columns: ReportColumn[];
  rows: ReportRow[];
  landscape?: boolean;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState<"pdf" | "excel" | "csv" | null>(null);
  const [open, setOpen] = useState(false);

  async function run(kind: "pdf" | "excel" | "csv") {
    setOpen(false);
    setBusy(kind);
    try {
      if (kind === "pdf") await exportPdf(title, columns, rows, { context, schoolName, periodLabel: periodLabel ?? context, filterLabel, landscape });
      if (kind === "excel") exportExcel(title, columns, rows, { context, filterLabel, summary });
      if (kind === "csv") exportCsv(title, columns, rows);
    } catch {
      // Keep export controls non-blocking; the caller's normal page state remains intact.
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={compact ? "relative" : "flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3"}>
      {!compact && (
        <div className="mr-1 flex items-center gap-2 text-[12px] font-semibold text-ink-700">
          <Download size={15} /> Export laporan
          {rows.length === 0 && <span className="font-normal text-ink-400">· belum ada data, template tetap tersedia</span>}
        </div>
      )}
      <div className="relative">
        <Button variant="secondary" size="sm" loading={busy !== null} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu">
          <Download size={14} /> Export <ChevronDown size={14} />
        </Button>
        {open && (
          <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[190px] overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lg">
            <button role="menuitem" onClick={() => run("pdf")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[12.5px] text-ink-700 hover:bg-surface-muted">
              <FileText size={14} /> PDF A4
            </button>
            <button role="menuitem" onClick={() => run("excel")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[12.5px] text-ink-700 hover:bg-surface-muted">
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button role="menuitem" onClick={() => run("csv")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[12.5px] text-ink-700 hover:bg-surface-muted">
              <Table2 size={14} /> CSV
            </button>
          </div>
        )}
      </div>
      {compact && rows.length === 0 && <span className="ml-1 hidden text-[11px] text-ink-400 sm:inline">Belum ada data · tetap dapat diekspor</span>}
    </div>
  );
}
