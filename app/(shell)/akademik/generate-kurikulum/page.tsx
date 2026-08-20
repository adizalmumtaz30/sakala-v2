"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ChevronRight, FileUp, Link2, RefreshCw, Save, Search, X } from "lucide-react";
import { adoptCurriculumItemsAction, listCurriculumIntelligenceAction } from "../mata-pelajaran/curriculum-actions";

export const dynamic = "force-dynamic";

type Source = { id: string; institution: string; name: string; official_url: string; status: string };
type Version = { id: string; source_id: string; curriculum_name: string; regulation_number: string | null; regulation_year: number | null; regulation_title: string | null; effective_status: string; document_url: string | null; verification_status: string };
type Item = { id: string; curriculum_version_id: string; subject_name: string; class_level: string; allocation_unit: string | null; official_allocation: number | null; weekly_target: number | null; derivation_status: string; extraction_status: string };
type Context = { id: string; tahun_pelajaran: string; semester: string; is_active: boolean };
type Kelas = { id: string; tingkat: string; nama_rombel: string; tahun_ajaran: string; semester: string };
type Candidate = Item & { manualTarget: number | null };
type StatusFilter = "all" | "new" | "changed" | "review";

export default function GenerateKurikulumPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [versionId, setVersionId] = useState("");
  const [level, setLevel] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [candidate, setCandidate] = useState<Candidate[]>([]);
  const [baseline, setBaseline] = useState<Record<string, number | null>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [updateOpen, setUpdateOpen] = useState(false);
  const [sourceDrawer, setSourceDrawer] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [updateMode, setUpdateMode] = useState<"previous" | "new">("previous");
  const [sourceUrl, setSourceUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [updateReady, setUpdateReady] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [compareOpen, setCompareOpen] = useState(false);
  const [success, setSuccess] = useState(false);

  const activeContext = contexts.find((x) => x.is_active) ?? null;
  const verifiedVersions = useMemo(() => versions.filter((v) => v.verification_status === "verified"), [versions]);
  const activeVersion = versions.find((x) => x.id === versionId) ?? null;
  const activeSource = sources.find((x) => x.id === activeVersion?.source_id) ?? null;
  const levels = useMemo(() => Array.from(new Set(items.filter((i) => i.curriculum_version_id === versionId).map((i) => i.class_level))), [items, versionId]);
  const validItems = items.filter((i) => i.curriculum_version_id === versionId && (!level || i.class_level === level) && i.extraction_status === "verified" && i.derivation_status !== "blocked");
  const eligibleClasses = classes.filter((c) => (!level || c.tingkat === level) && (!activeContext || c.tahun_ajaran === activeContext.tahun_pelajaran) && (!activeContext || c.semester === activeContext.semester));

  const changedIds = candidate.filter((x) => x.manualTarget !== baseline[x.id]).map((x) => x.id);
  const newIds = candidate.filter((x) => baseline[x.id] === undefined).map((x) => x.id);
  const reviewIds = candidate.filter((x) => x.manualTarget == null || !Number.isInteger(x.manualTarget) || x.manualTarget < 0).map((x) => x.id);
  const totalTarget = candidate.reduce((sum, x) => sum + (x.manualTarget ?? 0), 0);
  const officialTotal = candidate.reduce((sum, x) => sum + (x.official_allocation ?? 0), 0);
  const visibleCandidate = candidate.filter((x) => {
    const matchesSearch = x.subject_name.toLowerCase().includes(query.toLowerCase());
    const changed = changedIds.includes(x.id);
    const isNew = newIds.includes(x.id);
    const needsReview = reviewIds.includes(x.id);
    return matchesSearch && (filter === "all" || (filter === "changed" && changed) || (filter === "new" && isNew) || (filter === "review" && needsReview));
  });

  const validation = useMemo(() => {
    if (!activeContext) return { status: "blocked", text: "Konteks akademik belum siap." } as const;
    if (!activeVersion || activeVersion.verification_status !== "verified") return { status: "blocked", text: "Pilih kurikulum dengan sumber yang sudah terverifikasi." } as const;
    if (!classIds.length) return { status: "warning", text: "Menyiapkan kelas dari konteks aktif…" } as const;
    if (!candidate.length) return { status: "warning", text: "Konteks siap · Kurikulum siap · Sumber siap" } as const;
    if (reviewIds.length) return { status: "warning", text: `${reviewIds.length} data perlu ditinjau.` } as const;
    return { status: "valid", text: "Konteks siap · Kurikulum siap · Sumber siap" } as const;
  }, [activeContext, activeVersion, classIds.length, candidate.length, reviewIds.length]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const result = await listCurriculumIntelligenceAction("all");
      if (!mounted) return;
      if (result.ok) {
        setSources(result.data.sources as Source[]);
        setVersions(result.data.versions as Version[]);
        setItems(result.data.items as Item[]);
        const verified = (result.data.versions as Version[]).filter((v) => v.verification_status === "verified");
        if (verified.length === 1) setVersionId(verified[0].id);
      } else setMessage(result.error);
      try {
        const response = await fetch("/api/target-jp/import?mode=data", { cache: "no-store" });
        if (!response.ok) throw new Error("Data context belum dapat dibaca.");
        const data = await response.json();
        if (!mounted) return;
        setContexts(Array.isArray(data.contexts) ? data.contexts : []);
        setClasses(Array.isArray(data.classes) ? data.classes : []);
      } catch (error) {
        if (mounted) setMessage(error instanceof Error ? error.message : "Data context belum dapat dibaca.");
      } finally {
        if (mounted) setBusy(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Operator-first handoff: once the canonical context and curriculum are loaded,
  // SAKALA prepares the applicable classes automatically. Manual controls remain
  // available for exceptions, but they are no longer a prerequisite to Generate.
  useEffect(() => {
    if (busy || !activeContext || classIds.length) return;
    const matchingClasses = classes.filter((c) => c.tahun_ajaran === activeContext.tahun_pelajaran && c.semester === activeContext.semester);
    if (matchingClasses.length) setClassIds(matchingClasses.map((c) => c.id));
  }, [busy, activeContext, classes, classIds.length]);

  function toggleClass(id: string) { setClassIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]); }
  function openUpdate(mode: "previous" | "new") { setUpdateMode(mode); setUpdateReady(false); setMessage(""); setUpdateOpen(true); }
  function chooseVersion(id: string) { setVersionId(id); setLevel(""); setCandidate([]); setBaseline({}); setSelectedIds([]); setUpdateReady(false); }
  function toggleSelected(id: string) { setSelectedIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]); }
  function updateTarget(id: string, value: string) { setCandidate((current) => current.map((item) => item.id === id ? { ...item, manualTarget: value === "" ? null : Number(value) } : item)); }
  function restoreTarget(id: string) { setCandidate((current) => current.map((item) => item.id === id ? { ...item, manualTarget: baseline[id] ?? item.weekly_target } : item)); }
  function bulkTarget() {
    const value = window.prompt("Target JP baru untuk mata pelajaran yang dipilih");
    if (value === null || value.trim() === "") return;
    const next = Number(value);
    if (!Number.isInteger(next) || next < 0) return;
    setCandidate((current) => current.map((item) => selectedIds.includes(item.id) ? { ...item, manualTarget: next } : item));
    setSelectedIds([]);
  }

  async function applyUpdateSelection() {
    setUpdating(true); setMessage(""); setUpdateReady(false);
    await new Promise((resolve) => setTimeout(resolve, 350));
    if (updateMode === "previous") {
      if (!versionId) { setMessage("Pilih sumber sebelumnya terlebih dahulu."); setUpdating(false); return; }
      setUpdateReady(true); setMessage("Sumber sebelumnya siap digunakan. Data resmi belum diubah.");
    } else if (!sourceUrl.trim() && !fileName) {
      setMessage("Masukkan link atau pilih file terlebih dahulu.");
    } else {
      setUpdateReady(true); setMessage("Sumber baru siap ditinjau. Import sumber baru belum menimpa data resmi.");
    }
    setUpdating(false);
  }

  function generateCandidate() {
    if (!activeVersion || activeVersion.verification_status !== "verified" || !classIds.length) return;
    setProgress(1);
    const steps = [1, 2, 3, 4, 5];
    let index = 0;
    const timer = window.setInterval(() => {
      setProgress(steps[index]);
      index += 1;
      if (index >= steps.length) {
        window.clearInterval(timer);
        const next = validItems.map((item) => ({ ...item, manualTarget: item.weekly_target }));
        setCandidate(next);
        setBaseline(Object.fromEntries(next.map((item) => [item.id, item.weekly_target])));
        setSelectedIds([]); setFilter("all"); setQuery("");
        setMessage(next.length ? "Kurikulum siap ditinjau." : "Belum ada item valid untuk dibuat.");
      }
    }, 180);
  }

  async function commitCandidate() {
    if (validation.status !== "valid" || !activeContext) return;
    setCompareOpen(false); setCommitting(true); setMessage("Menyinkronkan…");
    const result = await adoptCurriculumItemsAction({ academicContextId: activeContext.id, classIds, items: candidate.map((item) => ({ id: item.id, weeklyTarget: item.manualTarget })) });
    if (result.ok) { setSuccess(true); setMessage(`Kurikulum tersimpan: ${result.data.adopted} kombinasi.`); }
    else setMessage(result.error);
    setCommitting(false);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) { setFileName(event.target.files?.[0]?.name ?? ""); setUpdateReady(false); }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/akademik/mata-pelajaran" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft className="h-4 w-4" /> Kembali</Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-900">Generate Kurikulum</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-600">Siapkan sumber, generate, tinjau perubahan, lalu sinkronkan ke konteks akademik aktif.</p>
        </div>
        <button type="button" onClick={() => openUpdate("previous")} className="inline-flex items-center gap-2 rounded-xl border border-brand-300 bg-surface px-5 py-3 text-sm font-bold text-brand-700 shadow-soft hover:bg-brand-50" aria-haspopup="dialog"><RefreshCw className="h-4 w-4" /> Update</button>
      </header>

      <section className="relative rounded-2xl border border-brand-200 bg-brand-50 p-4">
        <button type="button" onClick={() => setContextOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={contextOpen}>
          <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">Konteks Aktif</p><p className="mt-1 font-bold text-brand-950">{activeContext ? `SMP/MTs · Kemenag · ${activeContext.tahun_pelajaran} · ${activeContext.semester}` : "Konteks akademik belum siap"}</p></div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${activeContext ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{activeContext ? "✓ Konteks siap" : "⚠ Belum lengkap"}</span>
        </button>
        {contextOpen && <div className="absolute left-4 right-4 top-full z-30 mt-2 rounded-xl border border-border bg-surface p-4 shadow-lg"><p className="font-bold text-ink-900">Konteks Akademik</p><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><span>Jenjang — SMP/MTs</span><span>Kementerian — Kemenag</span><span>Tahun — {activeContext?.tahun_pelajaran ?? "—"}</span><span>Semester — {activeContext?.semester ?? "—"}</span></div><Link href="/pengaturan/konteks-akademik" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Buka Konteks Akademik <ChevronRight className="h-4 w-4" /></Link></div>}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-ink-500">Kurikulum</p><div className="mt-1 flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-ink-900">{activeVersion?.curriculum_name ?? "Belum dipilih"}</h2>{activeVersion && <span className="text-emerald-700">✓</span>}</div><p className="text-sm text-ink-600">{activeVersion ? `Kemenag · ${activeVersion.regulation_year ?? "tahun tidak dicantumkan"}` : "SAKALA akan memilih kurikulum relevan bila hanya ada satu."}</p></div><button type="button" onClick={() => openUpdate("previous")} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-surface-muted">Update</button></div>
        {verifiedVersions.length > 1 && <select aria-label="Pilih kurikulum" value={versionId} onChange={(e) => chooseVersion(e.target.value)} className="mt-4 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"><option value="">Pilih kurikulum</option>{verifiedVersions.map((v) => <option key={v.id} value={v.id}>{v.curriculum_name} · Kemenag · {v.regulation_year ?? "—"}</option>)}</select>}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-ink-900">Sumber &amp; Referensi</h2><p className="mt-1 text-sm text-ink-600">Sumber aktif tetap ringkas; detail tersedia tanpa pindah halaman.</p></div><div className="flex gap-2">{activeVersion && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">✓ Sumber siap</span>}<button type="button" onClick={() => setSourceDrawer(true)} disabled={!activeVersion} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">Lihat detail</button></div></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted p-4"><div><p className="font-semibold text-ink-900">{activeVersion?.curriculum_name ?? "Belum ada sumber aktif"}</p><p className="mt-1 text-sm text-ink-600">{activeSource?.name ?? "Gunakan Update untuk memilih sumber."}</p></div><button type="button" onClick={() => openUpdate("new")} className="text-sm font-bold text-brand-700">Update Sumber</button></div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-ink-900">Generate</h2><p className="mt-1 text-sm text-ink-600">Parameter kelas disiapkan otomatis dari konteks aktif; operator tetap dapat menyesuaikannya.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${validation.status === "valid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{validation.text}</span></div>
        <div className="mt-4 grid gap-4 md:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Jenjang <span className="font-normal text-ink-500">(opsional)</span></span><select aria-label="Pilih jenjang" value={level} onChange={(e) => { setLevel(e.target.value); setCandidate([]); }} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"><option value="">Semua jenjang dari kurikulum</option>{levels.map((value) => <option key={value}>{value}</option>)}</select></label><div><p className="mb-2 text-sm font-semibold">Kelas</p><div className="flex flex-wrap gap-2">{eligibleClasses.map((kelas) => <button key={kelas.id} type="button" onClick={() => toggleClass(kelas.id)} aria-pressed={classIds.includes(kelas.id)} className={`rounded-lg border px-3 py-2 text-sm ${classIds.includes(kelas.id) ? "border-brand-600 bg-brand-50 text-brand-700" : "border-border text-ink-700"}`}>{kelas.tingkat} · {kelas.nama_rombel}</button>)}{!busy && !eligibleClasses.length && <span className="text-sm text-ink-500">Belum ada kelas yang sesuai.</span>}</div></div></div>
        <button type="button" onClick={generateCandidate} disabled={busy || !activeVersion || activeVersion.verification_status !== "verified" || !classIds.length} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-soft disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Generate Kurikulum</button>
        {progress > 0 && progress < 5 && <div className="mt-4 grid grid-cols-5 gap-2 text-[11px] font-semibold text-ink-500"><span className={progress >= 1 ? "text-emerald-700" : ""}>Membaca sumber {progress >= 1 ? "✓" : "○"}</span><span className={progress >= 2 ? "text-emerald-700" : ""}>Struktur {progress >= 2 ? "✓" : "○"}</span><span className={progress >= 3 ? "text-brand-700" : ""}>Mapel {progress >= 3 ? "●" : "○"}</span><span className={progress >= 4 ? "text-brand-700" : ""}>JP {progress >= 4 ? "●" : "○"}</span><span className={progress >= 5 ? "text-emerald-700" : ""}>Hasil {progress >= 5 ? "✓" : "○"}</span></div>}
      </section>

      {candidate.length > 0 && <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-ink-500">Review Mode</p><h2 className="mt-1 text-xl font-bold text-ink-900">Hasil Generate</h2><p className="mt-1 text-sm text-ink-600">{candidate.length} mata pelajaran · {changedIds.length} berubah · {newIds.length} baru</p></div><div className="flex rounded-xl bg-surface-muted p-1 text-sm font-semibold"><button onClick={() => setFilter("all")} className={`rounded-lg px-3 py-2 ${filter === "all" ? "bg-surface shadow-sm" : "text-ink-500"}`}>{candidate.length} Total</button><button onClick={() => setFilter("changed")} className={`rounded-lg px-3 py-2 ${filter === "changed" ? "bg-surface shadow-sm" : "text-ink-500"}`}>{changedIds.length} Berubah</button><button onClick={() => setFilter("new")} className={`rounded-lg px-3 py-2 ${filter === "new" ? "bg-surface shadow-sm" : "text-ink-500"}`}>{newIds.length} Baru</button></div></div>
        <div className="flex flex-wrap gap-2"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari mata pelajaran..." className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm" /></div><button onClick={() => setFilter("review")} className={`rounded-lg border px-3 py-2 text-sm ${filter === "review" ? "border-amber-400 bg-amber-50" : "border-border"}`}>Perlu ditinjau {reviewIds.length}</button></div>
        {selectedIds.length > 0 && <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm"><strong>{selectedIds.length} mata pelajaran dipilih</strong><div className="flex gap-2"><button onClick={bulkTarget} className="rounded-lg bg-brand-600 px-3 py-2 font-bold text-white">Atur Target JP</button><button onClick={() => setSelectedIds([])} className="rounded-lg border border-border bg-surface px-3 py-2">Batalkan</button></div></div>}
        <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-surface-muted"><tr><th className="w-10 px-3 py-3"><input type="checkbox" aria-label="Pilih semua" checked={visibleCandidate.length > 0 && visibleCandidate.every((x) => selectedIds.includes(x.id))} onChange={(e) => setSelectedIds(e.target.checked ? visibleCandidate.map((x) => x.id) : [])} /></th><th className="px-3 py-3">Mata Pelajaran</th><th className="px-3 py-3">JP Resmi</th><th className="px-3 py-3">Target JP</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Aksi</th></tr></thead><tbody>{visibleCandidate.map((item) => { const changed = changedIds.includes(item.id); const invalid = reviewIds.includes(item.id); return <tr key={item.id} className={`border-t border-border transition ${selectedIds.includes(item.id) ? "bg-brand-50/50" : "hover:bg-surface-muted"}`}><td className="px-3 py-3"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} aria-label={`Pilih ${item.subject_name}`} /></td><td className="px-3 py-3"><p className="font-semibold text-ink-900">{item.subject_name}</p><p className="text-xs text-ink-500">{item.class_level}</p></td><td className="px-3 py-3">{item.official_allocation ?? "—"}</td><td className="px-3 py-3"><input type="number" min="0" step="1" value={item.manualTarget ?? ""} onChange={(e) => updateTarget(item.id, e.target.value)} className={`w-24 rounded-lg border px-3 py-2 font-semibold ${invalid ? "border-amber-400 bg-amber-50" : "border-border bg-surface"}`} aria-label={`Target JP ${item.subject_name}`} />{changed && <p className="mt-1 text-[11px] text-amber-700">{baseline[item.id] ?? "—"} → {item.manualTarget ?? "—"}</p>}</td><td className="px-3 py-3">{invalid ? <span className="text-amber-700">⚠ Perlu ditinjau</span> : newIds.includes(item.id) ? <span className="text-brand-700">Baru</span> : changed ? <span className="text-amber-700">Berubah</span> : <span className="text-emerald-700">✓ Tetap</span>}</td><td className="px-3 py-3"><button onClick={() => restoreTarget(item.id)} className="text-xs font-semibold text-ink-600 hover:text-brand-700">Kembalikan</button></td></tr>; })}</tbody></table></div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted p-4"><div><p className="font-bold text-ink-900">Total Target JP: {totalTarget}</p><p className="mt-1 text-xs text-ink-500">JP resmi: {officialTotal} · Perubahan: {totalTarget - candidate.reduce((s, x) => s + (baseline[x.id] ?? 0), 0) >= 0 ? "+" : ""}{totalTarget - candidate.reduce((s, x) => s + (baseline[x.id] ?? 0), 0)} JP</p></div><span className={`text-sm font-semibold ${totalTarget > 0 ? "text-emerald-700" : "text-amber-700"}`}>{totalTarget > 0 ? "✓ Target diterima" : "⚠ Total perlu ditinjau"}</span></div>
      </section>}

      {candidate.length > 0 && !success && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-ink-700">{changedIds.length} perubahan belum disimpan</p><button type="button" onClick={() => setCompareOpen(true)} disabled={validation.status !== "valid" || committing} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" /> Simpan &amp; Sinkronkan</button></div></div>}

      {success && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-700" /><div><h2 className="font-bold text-emerald-900">Kurikulum tersimpan</h2><p className="mt-1 text-sm text-emerald-800">{candidate.length} mata pelajaran · {changedIds.length} diperbarui · {newIds.length} ditambahkan · 0 dihapus</p><div className="mt-3 flex gap-2"><Link href="/akademik/mata-pelajaran" className="rounded-lg bg-surface px-3 py-2 text-sm font-semibold">Lihat Mata Pelajaran</Link><Link href="/akademik/target-jp" className="rounded-lg bg-surface px-3 py-2 text-sm font-semibold">Lihat Target JP</Link></div></div></div></section>}

      {candidate.length === 0 && !busy && <section className="rounded-2xl border border-dashed border-border p-8 text-center"><p className="font-semibold text-ink-900">Belum ada hasil kurikulum.</p><p className="mt-1 text-sm text-ink-500">Pilih kurikulum dan sumber untuk mulai.</p></section>}
      {message && <p role="status" className="rounded-xl border border-border bg-surface-muted p-4 text-sm leading-6 text-ink-700">{message}</p>}

      {sourceDrawer && activeVersion && <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setSourceDrawer(false)}><aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-ink-500">Source Preview</p><h2 className="mt-1 text-xl font-bold">{activeVersion.curriculum_name}</h2><p className="text-sm text-ink-600">Kemenag · {activeVersion.regulation_year ?? "—"}</p></div><button onClick={() => setSourceDrawer(false)} aria-label="Tutup"><X className="h-5 w-5" /></button></div><div className="mt-6 space-y-4 text-sm"><div><p className="font-semibold">Status</p><p className="mt-1 text-emerald-700">✓ Siap digunakan</p></div><div><p className="font-semibold">Sumber</p><p className="mt-1">{activeSource?.name ?? "Regulasi resmi"}</p></div><div><p className="font-semibold">Regulasi</p><p className="mt-1 text-ink-600">{activeVersion.regulation_number ?? "Belum dicantumkan"}{activeVersion.regulation_title ? ` · ${activeVersion.regulation_title}` : ""}</p></div><div className="flex gap-2 pt-3"><button onClick={() => setSourceDrawer(false)} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white">Gunakan sumber</button><button onClick={() => setSourceDrawer(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Tutup</button></div></div></aside></div>}

      {updateOpen && <div className="fixed inset-0 z-50 bg-black/20 p-4" onClick={() => setUpdateOpen(false)}><div role="dialog" aria-modal="true" className="mx-auto mt-[8vh] max-h-[84vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Update</p><h2 className="mt-1 text-xl font-bold">Perbarui pilihan kurikulum</h2><p className="mt-1 text-sm text-ink-600">Menggunakan konteks aktif · SMP/MTs · Kemenag · {activeContext?.tahun_pelajaran ?? "—"} · {activeContext?.semester ?? "—"}</p></div><button onClick={() => setUpdateOpen(false)} aria-label="Tutup"><X className="h-5 w-5" /></button></div><div className="mt-5 flex rounded-xl bg-surface-muted p-1"><button onClick={() => setUpdateMode("previous")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${updateMode === "previous" ? "bg-surface shadow-sm" : "text-ink-500"}`}>Sumber sebelumnya</button><button onClick={() => setUpdateMode("new")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${updateMode === "new" ? "bg-surface shadow-sm" : "text-ink-500"}`}>Sumber baru</button></div>{updateMode === "previous" ? <div className="mt-4 space-y-2"><div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"><Search className="h-4 w-4 text-ink-400" /><input placeholder="Cari sumber..." className="w-full bg-transparent text-sm outline-none" /></div>{verifiedVersions.map((v) => <button key={v.id} type="button" onClick={() => chooseVersion(v.id)} className={`w-full rounded-xl border p-4 text-left ${versionId === v.id ? "border-brand-500 bg-brand-50" : "border-border"}`}><p className="font-semibold">{v.curriculum_name}</p><p className="mt-1 text-sm text-ink-600">Kemenag · {v.regulation_year ?? "—"}</p>{versionId === v.id && <p className="mt-1 text-xs font-bold text-emerald-700">✓ Dipilih</p>}</button>)}</div> : <div className="mt-4 grid gap-3 md:grid-cols-2"><label className="rounded-xl border border-border p-4"><span className="mb-2 flex items-center gap-2 text-sm font-semibold"><Link2 className="h-4 w-4" /> Link</span><input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." inputMode="url" className="w-full rounded-lg border border-border px-3 py-2 text-sm" /></label><label className="cursor-pointer rounded-xl border border-border p-4"><span className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileUp className="h-4 w-4" /> Import File</span><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={onFileChange} className="w-full text-sm" /><span className="mt-2 block text-xs text-ink-500">{fileName || "Belum ada file dipilih"}</span></label></div>}<div className="mt-5 flex items-center justify-between gap-3"><p className="text-sm text-ink-600">{updateReady ? "✓ Pilihan siap digunakan" : "Data resmi belum berubah."}</p><button type="button" onClick={() => void applyUpdateSelection()} disabled={updating} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${updating ? "animate-spin" : ""}`} /> {updating ? "Mencari…" : "Gunakan sumber"}</button></div></div></div>}

      {compareOpen && <div className="fixed inset-0 z-[60] bg-black/20 p-4" onClick={() => setCompareOpen(false)}><div role="dialog" aria-modal="true" className="mx-auto mt-[12vh] w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Automatic Compare</p><h2 className="mt-1 text-xl font-bold">Perubahan ditemukan</h2><p className="mt-1 text-sm text-ink-600">{changedIds.length} perubahan perlu ditinjau sebelum sinkronisasi.</p><div className="mt-4 space-y-2 rounded-xl bg-surface-muted p-4 text-sm">{changedIds.slice(0, 8).map((id) => { const item = candidate.find((x) => x.id === id); return item ? <div key={id} className="flex justify-between gap-3"><span>{item.subject_name}</span><strong>{baseline[id] ?? "—"} → {item.manualTarget ?? "—"}</strong></div> : null; })}{changedIds.length > 8 && <p className="text-xs text-ink-500">+ {changedIds.length - 8} perubahan lainnya</p>}{newIds.length > 0 && <p className="pt-2 text-sm font-semibold text-brand-700">{newIds.length} mata pelajaran baru ditemukan.</p>}</div><p className="mt-4 text-sm text-ink-600">Saran: gunakan hasil terbaru. Data yang tidak berubah tidak perlu ditinjau satu per satu.</p><div className="mt-5 flex flex-wrap justify-end gap-2"><button onClick={() => setCompareOpen(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Tinjau perbedaan</button><button onClick={() => void commitCandidate()} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white">Gunakan hasil terbaru</button></div></div></div>}
    </div>
  );
}
