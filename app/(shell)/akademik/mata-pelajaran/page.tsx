"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrainCircuit, CheckCircle2, ExternalLink, ShieldAlert } from "lucide-react";
import { adoptCurriculumItemsAction, listCurriculumIntelligenceAction } from "./curriculum-actions";
import type { CurriculumInstitution } from "@/lib/domain/curriculumIntelligence";

// Keep this route fresh so the Curriculum Intelligence launcher is present on direct loads/reloads.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Curriculum Intelligence launcher: production entry point for official curriculum review.

type Source = { id: string; institution: string; name: string; official_url: string; status: string };
type Version = { id: string; source_id: string; curriculum_name: string; regulation_number: string | null; regulation_year: number | null; regulation_title: string | null; effective_status: string; document_url: string | null; verification_status: string };
type Item = { id: string; curriculum_version_id: string; subject_name: string; class_level: string; allocation_unit: string | null; official_allocation: number | null; weekly_target: number | null; derivation_status: string; extraction_status: string };
type Context = { id: string; tahun_pelajaran: string; semester: string; is_active: boolean };
type Kelas = { id: string; tingkat: string; nama_rombel: string; tahun_ajaran: string; semester: string };

export default function MataPelajaranCurriculumPage() {
  const [institution, setInstitution] = useState<CurriculumInstitution | "">("");
  const [sources, setSources] = useState<Source[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [versionId, setVersionId] = useState("");
  const [level, setLevel] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);

  const activeContext = contexts.find((x) => x.is_active) ?? null;
  const activeVersion = versions.find((x) => x.id === versionId) ?? null;
  const availableVersions = versions.filter((v) => !institution || sources.some((s) => s.id === v.source_id && s.institution === institution));
  const levels = useMemo(() => Array.from(new Set(items.filter((i) => i.curriculum_version_id === versionId).map((i) => i.class_level))), [items, versionId]);
  const reviewItems = items.filter((i) => i.curriculum_version_id === versionId && (!level || i.class_level === level));
  const validItems = reviewItems.filter((i) => i.extraction_status === "verified" && i.derivation_status !== "blocked" && i.weekly_target != null);
  const eligibleClasses = classes.filter((c) => !level || c.tingkat === level);

  useEffect(() => {
    void (async () => {
      const curriculum = await listCurriculumIntelligenceAction("all");
      if (curriculum.ok) { setSources(curriculum.data.sources as Source[]); setVersions(curriculum.data.versions as Version[]); setItems(curriculum.data.items as Item[]); }
      else setMessage(curriculum.error);
      try {
        const response = await fetch("/api/target-jp/import?mode=data", { cache: "no-store" });
        if (response.ok) { const data = await response.json(); setContexts(data.contexts ?? []); setClasses(data.classes ?? []); }
      } finally { setBusy(false); }
    })();
  }, []);

  const toggle = (value: string, list: string[], setter: (next: string[]) => void) => setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  async function adopt() {
    if (!activeContext || !versionId || !classIds.length || !selected.length) return;
    setBusy(true); setMessage("");
    const result = await adoptCurriculumItemsAction({ academicContextId: activeContext.id, classIds, items: selected.map((id) => ({ id, weeklyTarget: items.find((x) => x.id === id)?.weekly_target ?? null })) });
    setMessage(result.ok ? `Berhasil menambahkan ${result.data.adopted} kombinasi. Target JP diteruskan otomatis.` : result.error);
    setBusy(false);
  }

  return <div className="mx-auto max-w-7xl space-y-6 pb-16">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-600"><BrainCircuit className="h-4 w-4"/> Curriculum Intelligence</div><h1 className="mt-1 text-2xl font-bold text-ink-900">Mata Pelajaran</h1><p className="mt-1 text-sm text-ink-500">Kelola mata pelajaran sekolah atau gunakan sumber kurikulum resmi.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/akademik" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Kembali</Link>
        <button type="button" onClick={() => setShowGenerator((value) => !value)} aria-expanded={showGenerator} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"><BrainCircuit className="h-4 w-4"/> Generate Kurikulum <span aria-hidden="true">{showGenerator ? "⌃" : "⌄"}</span></button>
      </div>
    </header>

    {!showGenerator && <section className="rounded-2xl border border-brand-200 bg-brand-50 p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-bold text-brand-900">Curriculum Intelligence</p><p className="mt-1 max-w-2xl text-sm text-brand-800">Ambil struktur kurikulum dari sumber resmi, tinjau alokasi, lalu tambahkan pilihan ke Mata Pelajaran dan Target JP tanpa silent mutation.</p></div><button type="button" onClick={() => setShowGenerator(true)} className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white">Mulai Generate</button></div></section>}

    {showGenerator && <>
      <section className="grid gap-3 md:grid-cols-4"><Gate label="Source" value={institution ? "Dipilih" : "Belum dipilih"}/><Gate label="Curriculum" value={activeVersion?.curriculum_name ?? "Belum verified"}/><Gate label="Academic Context" value={activeContext ? `${activeContext.tahun_pelajaran} · ${activeContext.semester}` : "Belum aktif"}/><Gate label="Authority" value={activeVersion?.verification_status === "verified" ? "Official ✓" : "BLOCKED"}/></section>

      <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft space-y-6">
        <div><h2 className="text-lg font-bold text-ink-900">Generate Kurikulum</h2><p className="text-sm text-ink-500">Regulasi resmi terverifikasi. SAKALA tetap memisahkan alokasi resmi dan target mingguan hasil derivasi.</p></div>
        <div className="grid gap-3 md:grid-cols-2">{([["kementerian_agama", "Kementerian Agama Republik Indonesia"], ["kemendikdasmen", "Kementerian Pendidikan Dasar dan Menengah Republik Indonesia"]] as const).map(([value, label]) => <button key={value} onClick={() => { setInstitution(value); setVersionId(""); }} className={`rounded-xl border p-4 text-left ${institution === value ? "border-brand-600 bg-brand-50" : "border-border"}`}><p className="font-semibold">{label}</p><p className="mt-1 text-xs text-ink-500">Kementerian = instansi sumber, bukan nama kurikulum.</p></button>)}</div>
        <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-500">Nama Kurikulum</span><select value={versionId} onChange={(e) => setVersionId(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"><option value="">Pilih curriculum version</option>{availableVersions.map((v) => <option key={v.id} value={v.id} disabled={v.verification_status !== "verified"}>{v.curriculum_name} · {v.verification_status}</option>)}</select></label>
        {activeVersion ? <div className="rounded-xl border border-border bg-surface-muted p-5"><div className="grid gap-4 md:grid-cols-2"><Info label="Regulasi" value={activeVersion.regulation_number ? `${activeVersion.regulation_number}${activeVersion.regulation_year ? ` Tahun ${activeVersion.regulation_year}` : ""}` : "—"}/><Info label="Judul" value={activeVersion.regulation_title ?? "—"}/><Info label="Status" value={activeVersion.effective_status}/><Info label="Verification" value={activeVersion.verification_status}/></div>{activeVersion.document_url && <a href={activeVersion.document_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700">Lihat sumber resmi <ExternalLink className="h-4 w-4"/></a>}</div> : <Blocked text="Pilih instansi lalu curriculum version resmi yang sudah diverifikasi. Jika belum tersedia, generate tetap diblokir untuk mencegah AI guess."/>}
      </section>

      {activeVersion?.verification_status === "verified" && <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft space-y-5"><div className="grid gap-3 md:grid-cols-2"><label><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-500">Jenjang</span><select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"><option value="">Pilih jenjang</option>{levels.map((x) => <option key={x}>{x}</option>)}</select></label><div className="rounded-xl border border-brand-200 bg-brand-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Active Academic Context</p><p className="mt-1 font-bold">{activeContext ? `${activeContext.tahun_pelajaran} · ${activeContext.semester}` : "Tidak tersedia"}</p></div></div><div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Kelas</p><div className="flex flex-wrap gap-2">{eligibleClasses.map((c) => <button key={c.id} onClick={() => toggle(c.id, classIds, setClassIds)} className={`rounded-lg border px-3 py-2 text-sm ${classIds.includes(c.id) ? "border-brand-600 bg-brand-50" : "border-border"}`}>{c.tingkat} · {c.nama_rombel}</button>)}</div></div><div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-surface-muted text-xs"><tr><th className="px-4 py-3">Pilih</th><th className="px-4 py-3">Mata Pelajaran</th><th className="px-4 py-3">Kelas</th><th className="px-4 py-3">Alokasi Resmi</th><th className="px-4 py-3">Target JP/JTM</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{reviewItems.map((item) => <tr key={item.id} className="border-t border-border"><td className="px-4 py-3"><input type="checkbox" disabled={!validItems.some((x) => x.id === item.id)} checked={selected.includes(item.id)} onChange={() => toggle(item.id, selected, setSelected)}/></td><td className="px-4 py-3 font-semibold">{item.subject_name}</td><td className="px-4 py-3">{item.class_level}</td><td className="px-4 py-3">{item.official_allocation ?? "—"} {item.allocation_unit ?? ""}</td><td className="px-4 py-3">{item.weekly_target ?? "—"} <span className="text-xs">{item.derivation_status}</span></td><td className="px-4 py-3">{item.extraction_status === "verified" ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4"/> Verified</span> : "BLOCKED"}</td></tr>)}</tbody></table>{!reviewItems.length && <div className="p-10 text-center text-sm text-ink-500">Belum ada curriculum item terverifikasi.</div>}</div><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-ink-500">{selected.length} item dipilih · {validItems.length} item valid</span><button disabled={busy || !activeContext || !classIds.length || !selected.length} onClick={() => void adopt()} className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Tambahkan ke SAKALA + Target JP</button></div>{message && <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm">{message}</div>}</section>}

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><strong>Official source verified:</strong> KMA Nomor 1503 Tahun 2025 tercatat berstatus berlaku pada JDIH Kementerian Agama. Struktur MTs VII–IX telah dimuat sebagai reference dataset; Target JP mingguan ditandai sebagai derived dari alokasi intrakurikuler tahunan dan asumsi minggu efektif pada tabel struktur.</section>
    </>}
  </div>;
}

function Gate({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-surface p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</p><p className="mt-1 font-semibold text-ink-900">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</p><p className="mt-1 font-semibold text-ink-800">{value}</p></div>; }
function Blocked({ text }: { text: string }) { return <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0"/><span>{text}</span></div>; }
