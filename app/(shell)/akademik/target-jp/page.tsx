"use client";

import { DragEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const cols = ["AcademicContext", "Kelas", "KodeMapel", "MataPelajaran", "TargetJP"];
type Row = Record<string, string>;
type Result = { row: number; status: "valid" | "warning" | "error"; message: string; data?: Row };
type Master = { id: string; label: string; code?: string };
type Target = { academic_context_id: string; kelas_id: string; mata_pelajaran_id: string; target_jp: number };

auto: {
  // label used only to keep the component definition below visually grouped
}

export default function TargetJPPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [contexts, setContexts] = useState<Master[]>([]);
  const [classes, setClasses] = useState<Master[]>([]);
  const [subjects, setSubjects] = useState<Master[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [manualContext, setManualContext] = useState("");
  const [manualClass, setManualClass] = useState("");
  const [manualSubject, setManualSubject] = useState("");
  const [manualJp, setManualJp] = useState(0);

  async function loadData() {
    const res = await fetch("/api/target-jp/import?mode=data", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Gagal memuat data Target JP.");
    setContexts((json.contexts ?? []).map((c: any) => ({ id: c.id, label: `${c.tahun_pelajaran} · ${c.semester}` })));
    setClasses((json.classes ?? []).map((c: any) => ({ id: c.id, label: `${c.tingkat} ${c.nama_rombel}` })));
    setSubjects((json.subjects ?? []).map((s: any) => ({ id: s.id, label: s.nama, code: s.kode ?? "" })));
    setTargets(json.targets ?? []);
    const firstContext = json.contexts?.[0];
    if (firstContext) setManualContext(firstContext.id);
  }

  useEffect(() => { loadData().catch((e) => setMessage(e instanceof Error ? e.message : "Gagal memuat data.")); }, []);

  const targetMap = useMemo(() => new Map(targets.map((t) => [`${t.academic_context_id}:${t.kelas_id}:${t.mata_pelajaran_id}`, t.target_jp])), [targets]);
  const valid = results.filter(r => r.status === "valid").length;
  const errors = results.filter(r => r.status === "error").length;
  const selectedKey = `${manualContext}:${manualClass}:${manualSubject}`;
  const existingJp = targetMap.get(selectedKey);

  async function upload(file: File) {
    setBusy(true); setMessage(""); setResults([]);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/target-jp/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membaca file");
      setRows(json.rows ?? []); setResults(json.results ?? []);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Gagal membaca file"); }
    finally { setBusy(false); }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  async function commit() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/target-jp/import", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import gagal");
      setMessage(`Import berhasil: ${json.upserted} data diproses.`);
      setRows([]); setResults([]); await loadData();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Import gagal"); }
    finally { setBusy(false); }
  }

  async function saveManual() {
    if (!manualContext || !manualClass || !manualSubject) return setMessage("Pilih Academic Context, Kelas, dan Mata Pelajaran terlebih dahulu.");
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/target-jp/import", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: [{ AcademicContext: contexts.find(c => c.id === manualContext)?.label ?? "", Kelas: classes.find(c => c.id === manualClass)?.label ?? "", KodeMapel: subjects.find(s => s.id === manualSubject)?.code ?? "", MataPelajaran: subjects.find(s => s.id === manualSubject)?.label ?? "", TargetJP: String(manualJp) }] }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan Target JP");
      setMessage(`Target JP ${manualJp} JP berhasil disimpan.`);
      await loadData();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Gagal menyimpan Target JP"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
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
          <div><h2 className="font-semibold text-ink-900">Import Target JP</h2><p className="mt-1 text-xs text-ink-500">Drag &amp; drop Excel/CSV, validasi, preview, lalu explicit commit.</p></div>
          <div className="flex gap-2">
            <a href="/api/target-jp/import/template" className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-muted">Download Template</a>
            <label className="cursor-pointer rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              {busy ? "Memproses…" : "Pilih File"}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
        </div>

        <div
          onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
          onDrop={onDrop}
          className={`mt-4 rounded-xl border-2 border-dashed p-8 text-center transition ${dragActive ? "border-brand-600 bg-brand-50" : "border-border bg-surface-muted"}`}
        >
          <p className="text-sm font-semibold text-ink-800">{dragActive ? "Lepaskan file di sini" : "Tarik & lepaskan file Target JP di area ini"}</p>
          <p className="mt-1 text-xs text-ink-500">XLSX, XLS, atau CSV · maksimal 5 MB</p>
        </div>

        <div className="mt-4 grid gap-2 rounded-lg bg-surface-muted p-4 text-xs text-ink-600 md:grid-cols-5">
          {cols.map(c => <div key={c}><span className="font-semibold text-ink-800">{c}</span></div>)}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-semibold text-ink-900">Target JP Manual</h2><p className="mt-1 text-xs text-ink-500">Selector JP resmi 0–10. Perubahan hanya disimpan setelah tombol ditekan.</p></div>
          {existingJp !== undefined && <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">Saat ini: {existingJp} JP</span>}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Select label="Academic Context" value={manualContext} onChange={setManualContext} options={contexts} />
          <Select label="Kelas" value={manualClass} onChange={setManualClass} options={classes} />
          <Select label="Mata Pelajaran" value={manualSubject} onChange={setManualSubject} options={subjects.map(s => ({ ...s, label: s.code ? `${s.code} · ${s.label}` : s.label }))} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {Array.from({ length: 11 }, (_, n) => n).map(n => (
            <button key={n} type="button" onClick={() => setManualJp(n)} className={`h-10 min-w-12 rounded-lg border px-3 text-sm font-semibold ${manualJp === n ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-surface text-ink-700 hover:bg-surface-muted"}`}>{n}</button>
          ))}
          <button type="button" disabled={busy} onClick={saveManual} className="ml-auto rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Simpan Target JP</button>
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
        <ul className="mt-2 list-disc space-y-1 pl-5"><li>Target JP harus bilangan bulat 0–10.</li><li>Academic Context, Kelas, dan Mata Pelajaran harus ditemukan.</li><li>Kode mapel diprioritaskan; nama mapel menjadi fallback.</li><li>Duplikasi dalam file ditolak.</li><li>Data existing di-upsert berdasarkan Context + Kelas + Mapel.</li></ul>
      </section>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Master[] }) {
  return <label className="flex flex-col gap-1.5 text-xs font-medium text-ink-700"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-ink-900"><option value="">Pilih…</option>{options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>;
}
