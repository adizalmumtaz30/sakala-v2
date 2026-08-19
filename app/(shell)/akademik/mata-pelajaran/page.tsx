"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrainCircuit, CheckCircle2, ExternalLink, ShieldAlert, ChevronRight } from "lucide-react";
import { adoptCurriculumItemsAction, listCurriculumIntelligenceAction } from "./curriculum-actions";
import type { CurriculumInstitution } from "@/lib/domain/curriculumIntelligence";

const steps = ["Instansi Sumber", "Nama Kurikulum", "Regulasi Acuan", "Jenjang", "Tahun Pelajaran", "Kelas", "Review"];

type Source = Awaited<ReturnType<typeof listCurriculumIntelligenceAction>> extends { ok: true; data: infer D } ? D["sources"][number] : never;
type Version = Awaited<ReturnType<typeof listCurriculumIntelligenceAction>> extends { ok: true; data: infer D } ? D["versions"][number] : never;
type Item = Awaited<ReturnType<typeof listCurriculumIntelligenceAction>> extends { ok: true; data: infer D } ? D["items"][number] : never;

type Context = { id: string; tahun_pelajaran: string; semester: string; is_active: boolean };
type Kelas = { id: string; tingkat: string; nama_rombel: string; tahun_ajaran: string; semester: string };

export default function MataPelajaranCurriculumPage() {
  const [step, setStep] = useState(0);
  const [institution, setInstitution] = useState<CurriculumInstitution | "">("");
  const [sources, setSources] = useState<Source[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const activeContext = contexts.find((context) => context.is_active) ?? contexts[0] ?? null;
  const activeVersion = versions.find((version) => version.id === selectedVersion) ?? null;
  const visibleVersions = institution ? versions.filter((version) => sources.some((source) => source.id === version.source_id && source.institution === institution)) : versions;
  const reviewItems = items.filter((item) => item.curriculum_version_id === selectedVersion && (selectedLevels.length === 0 || selectedLevels.includes(item.class_level)));
  const validReviewItems = reviewItems.filter((item) => item.extraction_status === "verified" && item.derivation_status !== "blocked" && item.weekly_target != null);

  useEffect(() => {
    void (async () => {
      setBusy(true);
      const [curriculum, contextRes] = await Promise.all([
        listCurriculumIntelligenceAction("all"),
        fetch("/api/target-jp/import?mode=data", { cache: "no-store" }).then((res) => res.ok ? res.json() : { contexts: [], classes: [] }),
      ]);
      if (curriculum.ok) {
        setSources(curriculum.data.sources);
        setVersions(curriculum.data.versions);
        setItems(curriculum.data.items);
      } else setMessage(curriculum.error);
      setContexts(contextRes.contexts ?? []);
      setClasses(contextRes.classes ?? []);
      setBusy(false);
    })();
  }, []);

  const levels = useMemo(() => Array.from(new Set(items.filter((item) => item.curriculum_version_id === selectedVersion).map((item) => item.class_level))), [items, selectedVersion]);

  function toggle(list: string[], value: string, setter: (value: string[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function adopt() {
    if (!activeContext || !selectedVersion || selectedClasses.length === 0 || selectedItems.length === 0) return;
    setBusy(true); setMessage("");
    const result = await adoptCurriculumItemsAction({
      academicContextId: activeContext.id,
      classIds: selectedClasses,
      items: selectedItems.map((id) => ({ id, weeklyTarget: items.find((item) => item.id === id)?.weekly_target ?? null })),
    });
    if (result.ok) setMessage(`Berhasil menambahkan ${result.data.adopted} kombinasi kurikulum. Target JP diteruskan ke Target JP SAKALA tanpa input ulang.`);
    else setMessage(result.error);
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-600"><BrainCircuit className="h-4 w-4" /> Curriculum Intelligence</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">Mata Pelajaran</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-500">Generate dari sumber resmi → review → pilih → masuk ke SAKALA. Tidak ada silent mutation dan tidak ada AI guess.</p>
        </div>
        <Link href="/akademik" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-surface-muted">Kembali</Link>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          {steps.map((label, index) => <button key={label} type="button" disabled={index > step} onClick={() => setStep(index)} className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${index === step ? "bg-brand-600 text-white" : index < step ? "bg-brand-50 text-brand-700" : "bg-surface-muted text-ink-400"}`}><span>{index + 1}</span>{label}{index < steps.length - 1 && <ChevronRight className="h-3 w-3" />}</button>)}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        {step === 0 && <div className="space-y-5"><WizardTitle title="Pilih Instansi Sumber" text="Kementerian adalah sumber regulasi. Ia bukan nama kurikulum."/><div className="grid gap-3 md:grid-cols-2">{([["kementerian_agama", "Kementerian Agama Republik Indonesia"], ["kemendikdasmen", "Kementerian Pendidikan Dasar dan Menengah Republik Indonesia"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => { setInstitution(value); setSelectedVersion(""); setStep(1); }} className={`rounded-xl border p-5 text-left transition hover:border-brand-400 ${institution === value ? "border-brand-600 bg-brand-50" : "border-border"}`}><p className="font-semibold text-ink-900">{label}</p><p className="mt-1 text-xs text-ink-500">Authority registry → dokumen resmi → verifikasi.</p></button>)}</div></div>}

        {step === 1 && <div className="space-y-5"><WizardTitle title="Nama Kurikulum" text="Nama hanya boleh berasal dari Curriculum Version yang berhasil diverifikasi."/><SelectBox value={selectedVersion} onChange={(value) => { setSelectedVersion(value); setStep(2); }} placeholder="Pilih kurikulum yang telah terdaftar" options={visibleVersions.map((version) => ({ value: version.id, label: version.curriculum_name, disabled: version.verification_status !== "verified" }))}/>{visibleVersions.length === 0 && <Blocked text="Belum ada curriculum version. SAKALA tidak mengarang nama kurikulum."/>}</div>}

        {step === 2 && <div className="space-y-5"><WizardTitle title="Regulasi Acuan" text="Regulasi wajib traceable dan verified sebelum Generate aktif."/>{activeVersion ? <div className="rounded-xl border border-border bg-surface-muted p-5"><div className="grid gap-4 md:grid-cols-2"><Info label="Kurikulum" value={activeVersion.curriculum_name}/><Info label="Regulasi" value={activeVersion.regulation_number ? `${activeVersion.regulation_number}${activeVersion.regulation_year ? ` Tahun ${activeVersion.regulation_year}` : ""}` : "Belum diverifikasi"}/><Info label="Judul" value={activeVersion.regulation_title ?? "—"}/><Info label="Status" value={activeVersion.effective_status}/></div><div className="mt-4 flex items-center gap-2 text-sm font-semibold">{activeVersion.verification_status === "verified" ? <><CheckCircle2 className="h-4 w-4 text-emerald-600"/> Official Source Verified</> : <><ShieldAlert className="h-4 w-4 text-amber-600"/> Generate diblokir sampai sumber diverifikasi</>}</div>{activeVersion.document_url && <a href={activeVersion.document_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700">Lihat dokumen <ExternalLink className="h-4 w-4"/></a>}</div> : <Blocked text="Regulasi belum dipilih."/>}<div className="flex justify-end"><button disabled={!activeVersion || activeVersion.verification_status !== "verified"} onClick={() => setStep(3)} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Lanjut</button></div></div>}

        {step === 3 && <div className="space-y-5"><WizardTitle title="Jenjang" text="Pilihan jenjang dibatasi oleh struktur data hasil regulasi."/><div className="grid gap-3 sm:grid-cols-3">{levels.map((level) => <button key={level} type="button" onClick={() => { setSelectedLevels([level]); setStep(4); }} className="rounded-xl border border-border p-5 text-left font-semibold hover:border-brand-400">{level}</button>)}</div>{levels.length === 0 && <Blocked text="Belum ada item kurikulum terverifikasi untuk version ini."/>}</div>}

        {step === 4 && <div className="space-y-5"><WizardTitle title="Tahun Pelajaran" text="Generate terikat pada Active Academic Context."/><div className="rounded-xl border border-brand-200 bg-brand-50 p-5"><p className="text-xs font-semibold uppercase tracking-widest text-brand-700">Active Academic Context</p><p className="mt-1 text-lg font-bold text-ink-900">{activeContext ? `${activeContext.tahun_pelajaran} · ${activeContext.semester}` : "Belum tersedia"}</p></div><button disabled={!activeContext} onClick={() => setStep(5)} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Gunakan Context Aktif</button></div>}

        {step === 5 && <div className="space-y-5"><WizardTitle title="Pilih Kelas" text="Pilih satu atau beberapa kelas sesuai jenjang yang dipilih."/><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{classes.filter((kelas) => selectedLevels.includes(kelas.tingkat)).map((kelas) => <button key={kelas.id} type="button" onClick={() => toggle(selectedClasses, kelas.id, setSelectedClasses)} className={`rounded-xl border p-4 text-left ${selectedClasses.includes(kelas.id) ? "border-brand-600 bg-brand-50" : "border-border"}`}><p className="font-semibold">{kelas.tingkat} · {kelas.nama_rombel}</p><p className="text-xs text-ink-500">{kelas.tahun_ajaran} · {kelas.semester}</p></button>)}</div><button disabled={!selectedClasses.length} onClick={() => setStep(6)} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Generate Review</button></div>}

        {step === 6 && <div className="space-y-5"><div className="rounded-xl border border-border bg-surface-muted p-5"><div className="grid gap-3 md:grid-cols-4"><Info label="Sumber" value={institution === "kementerian_agama" ? "Kementerian Agama RI" : "Kemendikdasmen RI"}/><Info label="Kurikulum" value={activeVersion?.curriculum_name ?? "—"}/><Info label="Academic Context" value={activeContext ? `${activeContext.tahun_pelajaran} · ${activeContext.semester}` : "—"}/><Info label="Kelas" value={`${selectedClasses.length} dipilih`}/></div></div><div><div className="mb-3 flex items-end justify-between"><div><h2 className="font-semibold text-ink-900">Curriculum Review</h2><p className="text-xs text-ink-500">Official allocation dan derived weekly target ditampilkan terpisah.</p></div><button type="button" onClick={() => setSelectedItems(selectedItems.length === validReviewItems.length ? [] : validReviewItems.map((item) => item.id))} className="text-sm font-semibold text-brand-700">{selectedItems.length === validReviewItems.length ? "Batalkan Semua" : "Pilih Semua Valid"}</button></div><div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-surface-muted text-xs"><tr><th className="px-4 py-3">Pilih</th><th className="px-4 py-3">Mata Pelajaran</th><th className="px-4 py-3">Kelas</th><th className="px-4 py-3">Alokasi Resmi</th><th className="px-4 py-3">Target JP/JTM</th><th className="px-4 py-3">Source</th></tr></thead><tbody>{reviewItems.map((item) => <tr key={item.id} className="border-t border-border"><td className="px-4 py-3"><input type="checkbox" disabled={item.extraction_status !== "verified" || item.derivation_status === "blocked" || item.weekly_target == null} checked={selectedItems.includes(item.id)} onChange={() => toggle(selectedItems, item.id, setSelectedItems)}/></td><td className="px-4 py-3 font-semibold">{item.subject_name}</td><td className="px-4 py-3">{item.class_level}</td><td className="px-4 py-3">{item.official_allocation ?? "—"} {item.allocation_unit ?? ""}</td><td className="px-4 py-3">{item.weekly_target ?? "—"} {item.derivation_status === "derived" ? <span className="text-xs text-amber-700">Derived</span> : item.derivation_status === "official" ? <span className="text-xs text-emerald-700">Official</span> : null}</td><td className="px-4 py-3">{item.extraction_status === "verified" ? "🟢 Official" : "🔴 Blocked"}</td></tr>)}</tbody></table>{reviewItems.length === 0 && <div className="p-10 text-center text-sm text-ink-500">Belum ada curriculum item. Generate dihentikan.</div>}</div></div><div className="flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-ink-500">{selectedItems.length} item dipilih · {validReviewItems.length} item valid</div><button disabled={busy || selectedItems.length === 0 || validReviewItems.length === 0} onClick={() => void adopt()} className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Tambahkan ke SAKALA + Target JP</button></div>{message && <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm">{message}</div>}</div>}
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Integrity gate:</strong> saat ini database belum memiliki curriculum version terverifikasi. Itu disengaja. SAKALA tidak akan mengisi nama kurikulum, nomor regulasi, mapel, atau JP berdasarkan tebakan.</section>
    </div>
  );
}

function WizardTitle({ title, text }: { title: string; text: string }) { return <div><h2 className="text-xl font-bold text-ink-900">{title}</h2><p className="mt-1 text-sm text-ink-500">{text}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</p><p className="mt-1 font-semibold text-ink-800">{value}</p></div>; }
function Blocked({ text }: { text: string }) { return <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0"/><span>{text}</span></div>; }
function SelectBox({ value, onChange, placeholder, options }: { value: string; onChange: (value: string) => void; placeholder: string; options: Array<{ value: string; label: string; disabled?: boolean }> }) { return <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink-800 outline-none focus:border-brand-500"><option value="">{placeholder}</option>{options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}{option.disabled ? " · belum verified" : ""}</option>)}</select>; }
