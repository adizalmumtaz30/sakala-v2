"use client";

import { useState } from "react";
import { Upload, Download, X, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
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
  onValidate: (rows: Record<string, string>[]) => Promise<ImportRowResult[]>;
  onCommit: (rows: Record<string, string>[]) => Promise<{ imported: number; skipped: number }>;
  onImported: () => void;
}

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
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ imported: number; skipped: number } | null>(null);

  function reset() {
    setStage("upload");
    setFileName("");
    setRawRows([]);
    setResults([]);
    setParseError(null);
    setSummary(null);
    setIsDragging(false);
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
      const isSupported = /\.(xlsx|csv)$/i.test(file.name);
      if (!isSupported) {
        setParseError("Format file belum didukung. Gunakan file XLSX atau CSV dari Template SAKALA.");
        return;
      }
      const { rows } = await parseSpreadsheetFile(file);
      if (rows.length === 0) {
        setParseError("Belum ada data yang ditemukan. Pastikan sheet DATA terisi dan gunakan Template SAKALA.");
        return;
      }
      setRawRows(rows);
      const validated = await onValidate(rows);
      setResults(validated);
      setStage("preview");
    } catch {
      setParseError("File belum dapat dibaca. Gunakan Template SAKALA (.xlsx) atau file CSV dengan format yang sesuai.");
    } finally {
      setIsBusy(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl2 border border-border bg-surface p-6 shadow-float" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
        <div className="mb-1 flex items-center justify-between">
          <h2 id="import-dialog-title" className="text-[16px] font-semibold text-ink-900">{title}</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-ink-400 outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand-600/40" aria-label="Tutup impor">
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-[12.5px] text-ink-500">{description}</p>
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-brand-600/15 bg-brand-600/[0.04] px-3 py-2 text-[11.5px] text-ink-600">
          <span className="font-semibold text-ink-800">Format SAKALA</span>
          <span>Gunakan template sesuai halaman ini.</span>
          <span>Validasi dilakukan sebelum data disimpan.</span>
        </div>

        {stage === "upload" && (
          <div className="flex flex-col gap-4">
            <div
              onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={(e) => { if (e.currentTarget === e.target) setIsDragging(false); }}
              onDrop={handleDrop}
              className={`flex flex-col items-center gap-2 rounded-xl2 border-2 border-dashed py-10 text-center transition-colors ${
                isDragging ? "border-brand-600 bg-brand-600/5" : "border-border hover:border-brand-600/40"
              }`}
              aria-label="Area unggah file"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600/10 text-brand-700">
                <FileSpreadsheet size={24} aria-hidden="true" />
              </div>
              <p className="text-[13.5px] font-semibold text-ink-900">
                {isDragging ? "Lepaskan file di sini" : "Tarik file ke sini"}
              </p>
              <p className="text-[12px] text-ink-400">atau pilih file dari perangkat Anda</p>
              <label className="cursor-pointer">
                <span className="inline-flex h-9 items-center rounded-xl border border-border bg-surface px-3 text-[12.5px] font-medium text-ink-900 hover:bg-surface-muted focus-within:ring-2 focus-within:ring-brand-600/40">
                  Pilih File
                </span>
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  className="sr-only"
                  aria-label="Pilih file XLSX atau CSV"
                  onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])}
                />
              </label>
              <p className="text-[11px] text-ink-400">XLSX atau CSV</p>
            </div>

            {parseError && <p role="alert" className="text-[12.5px] text-rose">{parseError}</p>}
            {isBusy && <p className="text-[12.5px] text-ink-500" aria-live="polite">Memeriksa {fileName}...</p>}

            <a
              href={templateUrl}
              download={templateFilename}
              className="flex items-center justify-center gap-1.5 rounded-lg py-1 text-[12.5px] font-medium text-brand-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand-600/40"
            >
              <Download size={14} aria-hidden="true" /> Unduh Template SAKALA khusus halaman ini
            </a>
          </div>
        )}

        {stage === "preview" && (
          <div className="flex flex-1 flex-col gap-3 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 text-[12.5px]" aria-live="polite">
              <span className="flex items-center gap-1 font-medium text-emerald">
                <CheckCircle2 size={14} aria-hidden="true" /> {validCount} data siap diimpor
              </span>
              {issueCount > 0 && (
                <span className="flex items-center gap-1 font-medium text-amber">
                  <AlertTriangle size={14} aria-hidden="true" /> {issueCount} perlu diperbaiki
                </span>
              )}
              <span className="text-ink-400">· {results.length} baris ditemukan di {fileName}</span>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border border-border">
              <table className="w-full text-left text-[12.5px]">
                <thead className="sticky top-0 bg-surface-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium text-ink-500">No.</th>
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
                          <span className="text-emerald">✓ Siap</span>
                        ) : (
                          <span className="text-amber">
                            ⚠ Perlu diperbaiki
                            {r.issues.map((issue, i) => (
                              <span key={i} className="block">{issue.column}: {issue.message}</span>
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
              <Button variant="secondary" onClick={reset}>Ganti File</Button>
              <Button onClick={handleConfirm} loading={isBusy} disabled={validCount === 0}>Impor {validCount} Data</Button>
            </div>
          </div>
        )}

        {stage === "done" && summary && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 size={32} className="text-emerald" aria-hidden="true" />
            <p className="text-[14px] font-semibold text-ink-900">{summary.imported} data berhasil diimpor</p>
            {summary.skipped > 0 && (
              <p className="text-[12.5px] text-ink-500">{summary.skipped} baris dilewati karena belum valid.</p>
            )}
            <Button className="mt-2" onClick={handleClose}>Selesai</Button>
          </div>
        )}
      </div>
    </div>
  );
}
