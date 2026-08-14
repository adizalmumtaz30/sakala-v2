"use client";

import { useState } from "react";
import { Upload, Download, X, CheckCircle2, AlertTriangle } from "lucide-react";
import Button from "@/components/ui/Button";
import { parseSpreadsheetFile } from "@/lib/import/parse-spreadsheet";

export interface ImportRowResult {
  rowNumber: number;
  primaryLabel: string;
  secondaryLabel?: string;
  status: "valid" | "perlu_diperbaiki";
  issues: { column: string; message: string }[];
}

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  templateUrl: string;
  templateFilename: string;
  /** Validasi baris hasil parse (server action) — dipanggil setelah file diparse. */
  onValidate: (rows: Record<string, string>[]) => Promise<ImportRowResult[]>;
  /** Commit baris yang valid (server action) — server RE-VALIDATE, tidak percaya client. */
  onCommit: (rows: Record<string, string>[]) => Promise<{ imported: number; skipped: number }>;
  /** Dipanggil setelah commit sukses, supaya list induk bisa refresh. */
  onImported: () => void;
}

/**
 * Import flow generik (Bagian 24): Upload -> Detect -> Parse -> Preview -> Confirm -> Import.
 * Reusable lintas modul master data (Guru, Mapel, ...) — bedanya hanya di onValidate/onCommit
 * yang dikirim tiap modul, supaya aturan bisnis tetap ada di domain masing-masing entity.
 */
export default function ImportModal({
  open,
  onClose,
  title,
  description,
  templateUrl,
  templateFilename,
  onValidate,
  onCommit,
  onImported,
}: ImportModalProps) {
  const [stage, setStage] = useState<"upload" | "preview" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [results, setResults] = useState<ImportRowResult[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ imported: number; skipped: number } | null>(null);

  function reset() {
    setStage("upload");
    setFileName("");
    setRawRows([]);
    setResults([]);
    setParseError(null);
    setSummary(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(file: File) {
    setParseError(null);
    setFileName(file.name);
    setIsBusy(true);
    try {
      const { rows } = await parseSpreadsheetFile(file);
      if (rows.length === 0) {
        setParseError("Sheet DATA kosong atau tidak ditemukan. Gunakan Template SAKALA.");
        setIsBusy(false);
        return;
      }
      setRawRows(rows);
      const validated = await onValidate(rows);
      setResults(validated);
      setStage("preview");
    } catch {
      setParseError("Format file tidak sesuai. Gunakan Template SAKALA (.xlsx).");
    } finally {
      setIsBusy(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function handleConfirm() {
    setIsBusy(true);
    const result = await onCommit(rawRows);
    setSummary(result);
    setStage("done");
    setIsBusy(false);
    onImported();
  }

  if (!open) return null;

  const validCount = results.filter((r) => r.status === "valid").length;
  const issueCount = results.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl2 border border-border bg-surface p-6 shadow-float">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-ink-900">{title}</h2>
          <button onClick={handleClose} className="rounded-lg p-1 text-ink-400 hover:bg-surface-muted" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-[12.5px] text-ink-500">{description}</p>

        {stage === "upload" && (
          <div className="flex flex-col gap-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="flex flex-col items-center gap-2 rounded-xl2 border-2 border-dashed border-border py-10 text-center transition-colors hover:border-brand-600/40"
            >
              <Upload size={26} className="text-ink-300" />
              <p className="text-[13.5px] font-medium text-ink-900">Tarik file ke sini</p>
              <p className="text-[12px] text-ink-400">atau</p>
              <label className="cursor-pointer">
                <span className="inline-flex h-9 items-center rounded-xl border border-border bg-surface px-3 text-[12.5px] font-medium text-ink-900 hover:bg-surface-muted">
                  Pilih File
                </span>
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
              <p className="text-[11px] text-ink-400">XLSX / CSV</p>
            </div>

            {parseError && <p className="text-[12.5px] text-rose">{parseError}</p>}
            {isBusy && <p className="text-[12.5px] text-ink-500">Memproses {fileName}...</p>}

            <a
              href={templateUrl}
              download={templateFilename}
              className="flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-brand-700 hover:underline"
            >
              <Download size={14} /> Download Template SAKALA
            </a>
          </div>
        )}

        {stage === "preview" && (
          <div className="flex flex-1 flex-col gap-3 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
              <span className="flex items-center gap-1 font-medium text-emerald">
                <CheckCircle2 size={14} /> {validCount} valid
              </span>
              {issueCount > 0 && (
                <span className="flex items-center gap-1 font-medium text-amber">
                  <AlertTriangle size={14} /> {issueCount} perlu diperbaiki
                </span>
              )}
              <span className="text-ink-400">· {results.length} baris ditemukan di {fileName}</span>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border border-border">
              <table className="w-full text-left text-[12.5px]">
                <thead className="sticky top-0 bg-surface-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium text-ink-500">#</th>
                    <th className="px-3 py-2 font-medium text-ink-500">Data</th>
                    <th className="px-3 py-2 font-medium text-ink-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.rowNumber} className="border-t border-border align-top">
                      <td className="px-3 py-2 text-ink-400">{r.rowNumber}</td>
                      <td className="px-3 py-2 text-ink-900">
                        {r.primaryLabel}
                        {r.secondaryLabel && <span className="ml-1.5 text-ink-400">{r.secondaryLabel}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {r.status === "valid" ? (
                          <span className="text-emerald">✓ Valid</span>
                        ) : (
                          <span className="text-amber">
                            ⚠{" "}
                            {r.issues.map((issue, i) => (
                              <span key={i} className="block">
                                {issue.column}: {issue.message}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={reset}>
                Ganti File
              </Button>
              <Button onClick={handleConfirm} loading={isBusy} disabled={validCount === 0}>
                Import {validCount} Data
              </Button>
            </div>
          </div>
        )}

        {stage === "done" && summary && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 size={32} className="text-emerald" />
            <p className="text-[14px] font-semibold text-ink-900">{summary.imported} data berhasil diimpor</p>
            {summary.skipped > 0 && (
              <p className="text-[12.5px] text-ink-500">{summary.skipped} baris dilewati karena tidak valid.</p>
            )}
            <Button className="mt-2" onClick={handleClose}>
              Selesai
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
