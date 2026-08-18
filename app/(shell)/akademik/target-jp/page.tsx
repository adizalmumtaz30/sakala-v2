"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const cols = ["AcademicContext", "Kelas", "KodeMapel", "MataPelajaran", "TargetJP"];

type Row = Record<string, string>;
type Result = { row: number; status: "valid" | "warning" | "error"; message: string; data?: Row };

export default function TargetJPPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(file: File) {
    setBusy(true); setMessage(""); setResults([]);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/target-jp/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membaca file");
      setRows(json.rows); setResults(json.results);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Gagal membaca file"); }
    finally { setBusy(false); }
  }

  async function commit() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/target-jp/import", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import gagal");
      setMessage(`Import berhasil: ${json.upserted} data diproses.`);
      setRows([]); setResults([]);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Import gagal"); }
    finally { setBusy(false); }
  }

  const valid = results.filter(r => r.status === "valid").length;
  const errors = results.filter(r => r.status === "error").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Academic Workload Integrity</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">Target JP Resmi</h1>
          <p className="mt-1 text-sm text-ink-500">Target resmi per Academic Context · Kelas · Mata Pelajaran.</p>
        </div>
        <Link href="/akademik" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-700 hover:bg-surface-muted">Kembali ke Akademik</Link>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold text-ink-900">Import Target JP</h2><p className="mt-1 text-xs text-ink-500">Upload Excel/CSV, validasi, preview, lalu explicit commit. Tidak ada silent mutation.</p></div>
          <div className="flex gap-2">
            <a href="/api/target-jp/import/template" className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-muted">Download Template</a>
            <label className="cursor-pointer rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              {busy ? "Memproses…" : "Upload Excel / CSV"}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-2 rounded-lg bg-surface-muted p-4 text-xs text-ink-600 md:grid-cols-5">
          {cols.map(c => <div key={c}><span className="font-semibold text-ink-800">{c}</span></div>)}
        </div>
      </section>

      {message && <div className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-700">{message}</div>}

      {results.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div><h2 className="font-semibold text-ink-900">Validation Preview</h2><p className="text-xs text-ink-500">{valid} valid · {errors} error · {results.length} baris</p></div>
            <button disabled={busy || errors > 0 || valid === 0} onClick={commit} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Confirm Import</button>
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-surface-muted"><tr><th className="px-4 py-3">Baris</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Keterangan</th></tr></thead>
              <tbody>{results.map(r => <tr key={r.row} className="border-t border-border"><td className="px-4 py-3">{r.row}</td><td className="px-4 py-3 font-semibold">{r.status.toUpperCase()}</td><td className="px-4 py-3">{r.data ? `${r.data.Kelas} · ${r.data.MataPelajaran || r.data.KodeMapel} · ${r.data.TargetJP} JP` : "—"}</td><td className="px-4 py-3 text-ink-500">{r.message}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-600">
        <p className="font-semibold text-ink-900">Aturan import</p>
        <ul className="mt-2 list-disc space-y-1 pl-5"><li>Target JP harus bilangan bulat ≥ 0.</li><li>Academic Context, Kelas, dan Mata Pelajaran harus ditemukan.</li><li>Kode mapel diprioritaskan; nama mapel menjadi fallback.</li><li>Duplikasi dalam file ditolak.</li><li>Data existing di-upsert berdasarkan Context + Kelas + Mapel.</li></ul>
      </section>
    </div>
  );
}
