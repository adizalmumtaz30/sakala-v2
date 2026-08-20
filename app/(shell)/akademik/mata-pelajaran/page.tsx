"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrainCircuit, CheckCircle2, ExternalLink, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { adoptCurriculumItemsAction, getActiveAcademicContextAction, listAdoptedSubjectsAction, listCurriculumIntelligenceAction } from "./curriculum-actions";
import type { CurriculumInstitution } from "@/lib/domain/curriculumIntelligence";

export const dynamic = "force-dynamic";

type Source = { id: string; institution: string; name: string; official_url: string; status: string };
type Version = { id: string; source_id: string; curriculum_name: string; regulation_number: string | null; regulation_year: number | null; regulation_title: string | null; effective_status: string; document_url: string | null; verification_status: string };
type Item = { id: string; curriculum_version_id: string; subject_name: string; class_level: string; allocation_unit: string | null; official_allocation: number | null; weekly_target: number | null; derivation_status: string; extraction_status: string };
type Context = { id: string; tahun_pelajaran: string; semester: string; is_active: boolean };
type Kelas = { id: string; tingkat: string; nama_rombel: string; tahun_ajaran: string; semester: string };
type AdoptedRow = { id: string; kelasId: string; kelas: string; tingkat: string; subjectId: string; subject: string; kode: string | null; status: string; officialTarget: number | null; schoolTarget: number | null };

export default function MataPelajaranCurriculumPage() {
  const [institution, setInstitution] = useState<CurriculumInstitution | "">("");
  const [sources, setSources] = useState<Source[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [adopted, setAdopted] = useState<AdoptedRow[]>([]);
  const [versionId, setVersionId] = useState("");
  const [level, setLevel] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "selected" | "missing">("all");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);

  const activeContext = contexts.find((x) => x.is_active) ?? null;
  const activeVersion = versions.find((x) => x.id === versionId) ?? null;
  const verifiedVersions = versions.filter((v) => v.verification_status === "verified");
  const availableVersions = versions.filter((v) => !institution || sources.some((s) => s.id === v.source_id && s.institution === institution));
  const levels = useMemo(() => Array.from(new Set(items.filter((i) => i.curriculum_version_id === versionId).map((i) => i.class_level))), [items, versionId]);
  const reviewItems = items.filter((i) => i.curriculum_version_id === versionId && (!level || i.class_level === level));
  const validItems = reviewItems.filter((i) => i.extraction_status === "verified" && i.derivation_status !== "blocked" && i.weekly_target != null);
  const eligibleClasses = classes.filter((c) => !level || c.tingkat === level);
  const selectedNames = new Set(selected.map((id) => items.find((i) => i.id === id)?.subject_name).filter(Boolean) as string[]);
  const adoptedNames = new Set(adopted.map((r) => r.subject));
  const visibleAdopted = adopted.filter((r) => {
    const matchesQuery = !query || `${r.subject} ${r.kode ?? ""} ${r.kelas} ${r.tingkat}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "selected" ? r.status === "selected" : !adoptedNames.has(r.subject));
    return matchesQuery && matchesFilter;
  });

  async function load() {
    setBusy(true); setMessage("");
    const [contextResult, curriculumResult] = await Promise.all([getActiveAcademicContextAction(), listCurriculumIntelligenceAction("all")]);
    if (!contextResult.ok) setMessage(contextResult.error);
    else { setContexts(contextResult.data.contexts as Context[]); setClasses(contextResult.data.classes as Kelas[]); }
    if (!curriculumResult.ok) setMessage(curriculumResult.error);
    else { setSources(curriculumResult.data.sources as Source[]); setVersions(curriculumResult.data.versions as Version[]); setItems(curriculumResult.data.items as Item[]); }
    const context = contextResult.ok ? contextResult.data.contexts.find((x) => x.is_active) : null;
    if (context) {
      const adoptedResult = await listAdoptedSubjectsAction(context.id);
      if (adoptedResult.ok) setAdopted(adoptedResult.data.rows); else setMessage(adoptedResult.error);
    } else setAdopted([]);
    setBusy(false);
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!versionId && verifiedVersions.length === 1) setVersionId(verifiedVersions[0].id);
  }, [versionId, verifiedVersions.length]);

  useEffect(() => {
    if (!activeVersion) return;
    const source = sources.find((s) => s.id === activeVersion.source_id);
    if (source && !institution) setInstitution(source.institution as CurriculumInstitution);
    const firstLevel = levels[0];
    if (!level && firstLevel) setLevel(firstLevel);
    const matchingClasses = classes.filter((c) => !firstLevel || c.tingkat === firstLevel).map((c) => c.id);
    if (!classIds.length && matchingClasses.length) setClassIds(matchingClasses);
  }, [activeVersion, sources, levels, classes, institution, level, classIds.length]);

  function toggleItem(id: string) { setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]); }
  function toggleClasses() { setClassIds((current) => current.length === eligibleClasses.length ? [] : eligibleClasses.map((c) => c.id)); }

  async function adopt() {
    if (!activeContext || !versionId || !classIds.length || !selected.length) return;
    setBusy(true); setMessage("");
    const result = await adoptCurriculumItemsAction({ academicContextId: activeContext.id, classIds, items: selected.map((id) => ({ id, weeklyTarget: items.find((x) => x.id === id)?.weekly_target ?? null })) });
    if (result.ok) { setMessage(`✓ ${result.data.adopted} kombinasi tersinkron ke Mata Pelajaran dan Target JP.`); setSelected([]); await load(); }
    else { setMessage(result.error); setBusy(false); }
  }

  const contextLabel = activeContext ? `${activeContext.tahun_pelajaran} · ${activeContext.semester}` : "Konteks belum aktif";

  return <div className="mx-auto max-w-7xl space-y-6 pb-16">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-600"><BrainCircuit className="h-4 w-4"/> Akademik</div>
        <h1 className="mt-1 text-2xl font-bold text-ink-900">Mata Pelajaran</h1>
        <p className="mt-1 text-sm text-ink-500">Master mata pelajaran yang benar-benar tersinkron dari hasil kurikulum.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/akademik" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Kembali</Link>
        <button type="button" onClick={() => void load()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`}/> Refresh</button>
        <button type="button" onClick={() => setShowGenerator((v) => !v)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"><BrainCircuit className="h-4 w-4"/> {showGenerator ? "Tutup Generate" : "Generate Kurikulum"}</button>
      </div>
    </header>

    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-5 py-4 shadow-soft">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Konteks Aktif</p><p className="mt-1 font-semibold text-ink-900">{contextLabel}</p></div>
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4"/> Data tersinkron dengan konteks aktif</div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Mata pelajaran" value={new Set(adopted.map((r) => r.subjectId)).size}/>
      <Stat label="Kelas" value={new Set(adopted.map((r) => r.kelasId)).size}/>
      <Stat label="Target JP terisi" value={adopted.filter((r) => r.schoolTarget != null).length}/>
      <Stat label="Kurikulum verified" value={verifiedVersions.length}/>
    </section>

    <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari mata pelajaran, kode, atau kelas..." className="w-full rounded-xl border border-border bg-surface px-10 py-3 text-sm outline-none focus:border-brand-500"/></div>
        <div className="flex rounded-xl border border-border p-1 text-sm"><button onClick={() => setFilter("all")} className={`rounded-lg px-3 py-2 ${filter === "all" ? "bg-surface-muted font-semibold" : ""}`}>Semua</button><button onClick={() => setFilter("selected")} className={`rounded-lg px-3 py-2 ${filter === "selected" ? "bg-surface-muted font-semibold" : ""}`}>Aktif</button><button onClick={() => setFilter("missing")} className={`rounded-lg px-3 py-2 ${filter === "missing" ? "bg-surface-muted font-semibold" : ""}`}>Perlu ditinjau</button></div>
      </div>
      <div className="mt-5 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-surface-muted text-xs uppercase tracking-wider text-ink-500"><tr><th className="px-4 py-3">Mata Pelajaran</th><th className="px-4 py-3">Kelas</th><th className="px-4 py-3">JP Resmi</th><th className="px-4 py-3">Target JP</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{visibleAdopted.map((row) => <tr key={row.id} className="border-t border-border hover:bg-surface-muted/60"><td className="px-4 py-3"><p className="font-semibold text-ink-900">{row.subject}</p><p className="text-xs text-ink-500">{row.kode ?? "Tanpa kode"}</p></td><td className="px-4 py-3">{row.tingkat} · {row.kelas}</td><td className="px-4 py-3">{row.officialTarget ?? "—"}</td><td className="px-4 py-3 font-semibold">{row.schoolTarget ?? "—"}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-emerald-700"><ShieldCheck className="h-4 w-4"/> Tersinkron</span></td></tr>)}</tbody></table>
        {!visibleAdopted.length && <div className="p-12 text-center"><p className="font-semibold text-ink-900">Belum ada mata pelajaran tersinkron</p><p className="mt-1 text-sm text-ink-500">Generate kurikulum lalu gunakan hasil terbaru untuk memasukkannya ke master ini.</p><button onClick={() => setShowGenerator(true)} className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Mulai Generate</button></div>}
      </div>
    </section>

    {showGenerator && <section className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Generate → Review → Sync</p><h2 className="mt-1 text-xl font-bold text-ink-900">Generate Kurikulum</h2><p className="mt-1 text-sm text-ink-500">Context aktif dipakai otomatis. Data hanya masuk setelah operator memilih dan menyinkronkan.</p></div><div className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">{activeContext ? "Context siap" : "Context belum siap"}</div></div>
      <div className="grid gap-3 md:grid-cols-4"><Gate label="Context" value={contextLabel}/><Gate label="Curriculum" value={activeVersion?.curriculum_name ?? "Belum verified"}/><Gate label="Source" value={institution ? "Tersedia" : "Otomatis"}/><Gate label="Authority" value={activeVersion?.verification_status === "verified" ? "Official ✓" : "BLOCKED"}/></div>
      <div className="grid gap-3 md:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-500">Kurikulum</span><select value={versionId} onChange={(e) => setVersionId(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"><option value="">Pilih curriculum version</option>{availableVersions.map((v) => <option key={v.id} value={v.id} disabled={v.verification_status !== "verified"}>{v.curriculum_name} · {v.verification_status}</option>)}</select></label><div className="rounded-xl border border-brand-200 bg-brand-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Sumber</p><p className="mt-1 font-semibold">{activeVersion ? (sources.find((s) => s.id === activeVersion.source_id)?.name ?? "Source verified") : "Akan dipilih otomatis"}</p>{activeVersion?.document_url && <a href={activeVersion.document_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">Lihat sumber resmi <ExternalLink className="h-3.5 w-3.5"/></a>}</div></div>
      {activeVersion && <div className="grid gap-3 md:grid-cols-3"><Gate label="Regulasi" value={activeVersion.regulation_number ? `${activeVersion.regulation_number}${activeVersion.regulation_year ? ` Tahun ${activeVersion.regulation_year}` : ""}` : "—"}/><Gate label="Jenjang" value={level || "Otomatis"}/><Gate label="Kelas" value={`${classIds.length} kelas siap`}/></div>}
      {activeVersion?.verification_status === "verified" && <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Review mata pelajaran</p><p className="text-xs text-ink-500">{selected.length} dipilih · {validItems.length} valid</p></div><button type="button" onClick={toggleClasses} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">{classIds.length === eligibleClasses.length ? "Batalkan kelas" : "Pilih semua kelas"}</button></div><div className="flex flex-wrap gap-2">{eligibleClasses.map((c) => <button key={c.id} type="button" onClick={() => setClassIds((current) => current.includes(c.id) ? current.filter((id) => id !== c.id) : [...current, c.id])} className={`rounded-lg border px-3 py-2 text-xs ${classIds.includes(c.id) ? "border-brand-600 bg-brand-50" : "border-border"}`}>{c.tingkat} · {c.nama_rombel}</button>)}</div><div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-surface-muted text-xs"><tr><th className="px-4 py-3">Pilih</th><th className="px-4 py-3">Mata Pelajaran</th><th className="px-4 py-3">Jenjang</th><th className="px-4 py-3">JP Resmi</th><th className="px-4 py-3">Target JP</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{reviewItems.map((item) => <tr key={item.id} className="border-t border-border"><td className="px-4 py-3"><input type="checkbox" disabled={!validItems.some((x) => x.id === item.id)} checked={selected.includes(item.id)} onChange={() => toggleItem(item.id)}/></td><td className="px-4 py-3 font-semibold">{item.subject_name}</td><td className="px-4 py-3">{item.class_level}</td><td className="px-4 py-3">{item.official_allocation ?? "—"}</td><td className="px-4 py-3">{item.weekly_target ?? "—"}</td><td className="px-4 py-3">{item.extraction_status === "verified" ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4"/> Verified</span> : "BLOCKED"}</td></tr>)}</tbody></table>{!reviewItems.length && <div className="p-10 text-center text-sm text-ink-500">Tidak ada curriculum item untuk konteks ini.</div>}</div><button type="button" disabled={busy || !activeContext || !classIds.length || !selected.length} onClick={() => void adopt()} className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Simpan & Sinkronkan</button></div>}
      {message && <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm">{message}</div>}
    </section>}
  </div>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft"><p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</p><p className="mt-2 text-2xl font-bold text-ink-900">{value}</p></div>; }
function Gate({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-surface-muted p-4"><p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</p><p className="mt-1 text-sm font-semibold text-ink-900">{value}</p></div>; }
