"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileUp, Link2, RefreshCw, Save, ShieldAlert } from "lucide-react";
import { adoptCurriculumItemsAction, listCurriculumIntelligenceAction } from "../mata-pelajaran/curriculum-actions";

export const dynamic = "force-dynamic";

type Source = { id: string; institution: string; name: string; official_url: string; status: string };
type Version = { id: string; source_id: string; curriculum_name: string; regulation_number: string | null; regulation_year: number | null; regulation_title: string | null; effective_status: string; document_url: string | null; verification_status: string };
type Item = { id: string; curriculum_version_id: string; subject_name: string; class_level: string; allocation_unit: string | null; official_allocation: number | null; weekly_target: number | null; derivation_status: string; extraction_status: string };
type Context = { id: string; tahun_pelajaran: string; semester: string; is_active: boolean };
type Kelas = { id: string; tingkat: string; nama_rombel: string; tahun_ajaran: string; semester: string };
type Candidate = Item & { manualTarget: number | null };

export default function GenerateKurikulumPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [versionId, setVersionId] = useState("");
  const [level, setLevel] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [sourceMode, setSourceMode] = useState<"previous" | "new">("previous");
  const [sourceUrl, setSourceUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [showChanges, setShowChanges] = useState(false);
  const [candidate, setCandidate] = useState<Candidate[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [committing, setCommitting] = useState(false);

  const activeContext = contexts.find((x) => x.is_active) ?? null;
  const activeVersion = versions.find((x) => x.id === versionId) ?? null;
  const levels = useMemo(
    () => Array.from(new Set(items.filter((i) => i.curriculum_version_id === versionId).map((i) => i.class_level))),
    [items, versionId],
  );
  const validItems = items.filter(
    (i) => i.curriculum_version_id === versionId && (!level || i.class_level === level) && i.extraction_status === "verified" && i.derivation_status !== "blocked",
  );
  const eligibleClasses = classes.filter(
    (c) => (!level || c.tingkat === level) && (!activeContext || c.tahun_ajaran === activeContext.tahun_pelajaran) && (!activeContext || c.semester === activeContext.semester),
  );

  const validation = useMemo(() => {
    if (!activeContext) return { status: "blocked", text: "Belum ada Active Academic Context." };
    if (!activeVersion || activeVersion.verification_status !== "verified") return { status: "blocked", text: "Pilih sumber kurikulum yang sudah diverifikasi." };
    if (!level || !classIds.length) return { status: "warning", text: "Pilih jenjang dan minimal satu kelas." };
    if (!candidate.length) return { status: "warning", text: "Belum ada Candidate Kurikulum." };
    if (candidate.some((x) => x.manualTarget == null || !Number.isInteger(x.manualTarget) || x.manualTarget < 0)) return { status: "blocked", text: "Ada angka JP yang belum valid." };
    return { status: "valid", text: "Kurikulum siap disimpan." };
  }, [activeContext, activeVersion, level, classIds, candidate]);

  useEffect(() => {
    void (async () => {
      const result = await listCurriculumIntelligenceAction("all");
      if (result.ok) {
        setSources(result.data.sources as Source[]);
        setVersions(result.data.versions as Version[]);
        setItems(result.data.items as Item[]);
      } else setMessage(result.error);
      try {
        const response = await fetch("/api/target-jp/import?mode=data", { cache: "no-store" });
        if (!response.ok) throw new Error("Data context belum dapat dibaca.");
        const data = await response.json();
        setContexts(data.contexts ?? []);
        setClasses(data.classes ?? []);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Data context belum dapat dibaca.");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  function toggleClass(id: string) {
    setClassIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  async function updateSource() {
    setUpdating(true);
    setMessage("");
    setShowChanges(false);

    if (sourceMode === "previous") {
      if (!versionId) {
        setMessage("Pilih sumber sebelumnya terlebih dahulu.");
        setUpdating(false);
        return;
      }
      setCandidate([]);
      setShowChanges(true);
      setMessage("Sumber sebelumnya siap ditinjau. Data resmi belum diubah.");
      setUpdating(false);
      return;
    }

    if (!sourceUrl.trim() && !fileName) {
      setMessage("Masukkan link atau pilih file terlebih dahulu.");
      setUpdating(false);
      return;
    }

    setCandidate([]);
    setShowChanges(true);
    setMessage("Sumber baru sudah dipilih dan siap ditinjau. Data resmi belum diubah.");
    setUpdating(false);
  }

  function generateCandidate() {
    const next = validItems.map((item) => ({ ...item, manualTarget: item.weekly_target }));
    setCandidate(next);
    setMessage(next.length ? `${next.length} item masuk ke Candidate. Data resmi belum berubah.` : "Belum ada item valid untuk dibuat Candidate.");
  }

  function updateTarget(id: string, value: string) {
    setCandidate((current) => current.map((item) => item.id === id ? { ...item, manualTarget: value === "" ? null : Number(value) } : item));
  }

  async function commitCandidate() {
    if (validation.status !== "valid" || !activeContext) return;
    setCommitting(true);
    setMessage("");
    const result = await adoptCurriculumItemsAction({
      academicContextId: activeContext.id,
      classIds,
      items: candidate.map((item) => ({ id: item.id, weeklyTarget: item.manualTarget })),
    });
    setMessage(result.ok ? `Kurikulum tersimpan: ${result.data.adopted} kombinasi.` : result.error);
    setCommitting(false);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFileName(event.target.files?.[0]?.name ?? "");
    setShowChanges(false);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <header>
        <Link href="/akademik/mata-pelajaran" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-ink-900">Generate Kurikulum</h1>
        <p className="mt-1 max-w-2xl text-base leading-7 text-ink-600">Pilih sumber, buat Candidate, periksa hasilnya, lalu simpan.</p>
      </header>

      <section className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Active Academic Context</p>
        <p className="mt-1 text-lg font-bold text-brand-950">{activeContext ? `${activeContext.tahun_pelajaran} · ${activeContext.semester}` : "Belum ada context aktif"}</p>
      </section>

      <section className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink-900">Sumber &amp; Referensi</h2>
            <p className="mt-1 text-sm leading-6 text-ink-600">Gunakan sumber sebelumnya atau siapkan sumber baru.</p>
          </div>
          <button type="button" onClick={() => void updateSource()} disabled={updating} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${updating ? "animate-spin" : ""}`} /> {updating ? "Memperbarui…" : "Update Sumber"}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <button type="button" onClick={() => setSourceMode("previous")} className={`rounded-xl border p-4 text-left ${sourceMode === "previous" ? "border-brand-600 bg-brand-50" : "border-border"}`}>
            <p className="font-semibold text-ink-900">Sumber sebelumnya</p>
            <p className="mt-1 text-sm leading-6 text-ink-600">Gunakan sumber yang sudah pernah dipakai.</p>
          </button>
          <button type="button" onClick={() => setSourceMode("new")} className={`rounded-xl border p-4 text-left ${sourceMode === "new" ? "border-brand-600 bg-brand-50" : "border-border"}`}>
            <p className="font-semibold text-ink-900">Sumber baru</p>
            <p className="mt-1 text-sm leading-6 text-ink-600">Masukkan link atau import file.</p>
          </button>
        </div>

        {sourceMode === "previous" ? (
          <select aria-label="Pilih sumber sebelumnya" value={versionId} onChange={(event) => setVersionId(event.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm">
            <option value="">Pilih sumber sebelumnya</option>
            {versions.filter((version) => version.verification_status === "verified").map((version) => <option key={version.id} value={version.id}>{version.curriculum_name} · {version.regulation_year ?? "—"}</option>)}
          </select>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="rounded-xl border border-border p-4">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold"><Link2 className="h-4 w-4" /> Masukkan Link</span>
              <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://..." inputMode="url" className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm" />
            </label>
            <label className="cursor-pointer rounded-xl border border-border p-4">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileUp className="h-4 w-4" /> Import File</span>
              <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={onFileChange} className="w-full text-sm" />
              <span className="mt-2 block text-xs text-ink-500">{fileName || "Belum ada file dipilih"}</span>
            </label>
          </div>
        )}

        {showChanges && (
          <div className="rounded-xl border border-border bg-surface-muted p-4" role="status">
            <p className="font-semibold text-ink-900">Sumber siap ditinjau</p>
            <p className="mt-1 text-sm leading-6 text-ink-600">Perubahan belum diterapkan ke data resmi.</p>
          </div>
        )}
      </section>

      <section className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div>
          <h2 className="text-xl font-bold text-ink-900">Parameter</h2>
          <p className="mt-1 text-sm leading-6 text-ink-600">Pilih angka yang tersedia atau isi angka secara manual pada Candidate.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-2 block text-sm font-semibold text-ink-900">Jenjang</span>
            <select aria-label="Pilih jenjang" value={level} onChange={(event) => { setLevel(event.target.value); setClassIds([]); }} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm">
              <option value="">Pilih jenjang</option>
              {levels.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-900">Kelas</p>
            <div className="flex flex-wrap gap-2">
              {eligibleClasses.map((kelas) => <button key={kelas.id} type="button" onClick={() => toggleClass(kelas.id)} aria-pressed={classIds.includes(kelas.id)} className={`rounded-lg border px-3 py-2 text-sm ${classIds.includes(kelas.id) ? "border-brand-600 bg-brand-50 text-brand-700" : "border-border text-ink-700"}`}>{kelas.tingkat} · {kelas.nama_rombel}</button>)}
              {!busy && !eligibleClasses.length && <p className="text-sm text-ink-500">Belum ada kelas yang sesuai dengan context aktif.</p>}
            </div>
          </div>
        </div>
        <button type="button" onClick={generateCandidate} disabled={busy || !activeVersion || activeVersion.verification_status !== "verified" || !level || !classIds.length} className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Generate Candidate</button>
      </section>

      <section className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div>
          <h2 className="text-xl font-bold text-ink-900">Candidate Kurikulum</h2>
          <p className="mt-1 text-sm leading-6 text-ink-600">Hasil generate belum menjadi data resmi. Angka masih bisa diubah manual.</p>
        </div>
        {candidate.length ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-surface-muted"><tr><th className="px-4 py-3 font-semibold">Mata Pelajaran</th><th className="px-4 py-3 font-semibold">Kelas</th><th className="px-4 py-3 font-semibold">Alokasi Resmi</th><th className="px-4 py-3 font-semibold">Target JP</th><th className="px-4 py-3 font-semibold">Status</th></tr></thead>
              <tbody>{candidate.map((item) => <tr key={item.id} className="border-t border-border"><td className="px-4 py-3 font-semibold text-ink-900">{item.subject_name}</td><td className="px-4 py-3">{item.class_level}</td><td className="px-4 py-3">{item.official_allocation ?? "—"} {item.allocation_unit ?? ""}</td><td className="px-4 py-3"><input type="number" min="0" step="1" value={item.manualTarget ?? ""} onChange={(event) => updateTarget(item.id, event.target.value)} aria-label={`Target JP ${item.subject_name}`} className="w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></td><td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Candidate</span></td></tr>)}</tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm leading-6 text-ink-500">Belum ada Candidate. Pilih sumber dan parameter lalu Generate.</div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div><h2 className="text-xl font-bold text-ink-900">Periksa Kurikulum</h2><p className="mt-1 text-sm leading-6 text-ink-600">Periksa sebelum data disimpan.</p></div>
        <div className={`rounded-xl border p-4 ${validation.status === "valid" ? "border-emerald-200 bg-emerald-50" : validation.status === "blocked" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`} role="status">
          <p className="flex items-center gap-2 font-semibold text-ink-900">{validation.status === "valid" ? <CheckCircle2 className="h-5 w-5 text-emerald-700" /> : <ShieldAlert className="h-5 w-5" />} {validation.text}</p>
        </div>
        <button type="button" onClick={() => void commitCandidate()} disabled={committing || validation.status !== "valid"} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" /> {committing ? "Menyimpan…" : "Simpan Kurikulum"}</button>
      </section>

      {message && <p role="status" className="rounded-xl border border-border bg-surface-muted p-4 text-sm leading-6 text-ink-700">{message}</p>}
    </div>
  );
}
