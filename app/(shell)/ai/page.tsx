"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, CircleHelp, Database, RefreshCw, Search, Sparkles, Target, X } from "lucide-react";
import { getAiCurriculumContextAction, setAiTargetJpAction, type AiCurriculumContext, type AiRecommendation } from "./actions";
import { Badge, Card } from "@/components/ui/primitives";
import Button from "@/components/ui/Button";

export default function AiPage() {
  const [data, setData] = useState<AiCurriculumContext | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<AiRecommendation | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const load = useCallback((classId?: string | null) => {
    setLoading(true); setError(null);
    startTransition(async () => {
      const result = await getAiCurriculumContextAction(classId);
      if (!result.ok) { setError(result.error); setData(null); setLoading(false); return; }
      setData(result.data);
      setSelectedClassId(result.data.selectedClass?.id ?? result.data.classes[0]?.id ?? null);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(null); }, [load]);

  const selected = data?.selectedClass ?? null;
  const filteredClasses = useMemo(() => data?.classes.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())) ?? [], [data?.classes, query]);
  const primaryIssue = data?.issues[0] ?? null;

  function chooseClass(id: string) {
    setSelectedClassId(id);
    setDrawer(null);
    load(id);
  }

  async function applyRecommendation(item: AiRecommendation) {
    if (!item.subjectId || !item.suggestedJp || !selectedClassId) { setDrawer(item); return; }
    setBusyAction(item.id); setToast(null);
    const result = await setAiTargetJpAction({ classId: selectedClassId, subjectId: item.subjectId, targetJp: item.suggestedJp });
    if (!result.ok) { setToast(result.error); setBusyAction(null); return; }
    setToast(`${item.subjectName ?? "Target JP"} disiapkan pada ${result.data.targetJp} JP.`);
    setDrawer(null); setBusyAction(null); load(selectedClassId);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <header className="relative overflow-hidden rounded-[28px] border border-border bg-surface p-6 shadow-soft md:p-8">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-brand-50 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700"><Sparkles className="h-4 w-4" /> SAKALA AI <Badge>Proaktif</Badge></div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900">Pahami data. Temukan solusi.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">Saya membaca integrasi kurikulum yang tersedia, menemukan hal yang perlu diperhatikan, lalu menyarankan langkah konkret. Saya tidak membuat kurikulum baru.</p>
          </div>
          <div className="min-w-[260px] rounded-2xl border border-border bg-surface-muted/70 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">Konteks aktif</div>
            <div className="mt-1 font-semibold text-ink-900">{data?.academicContext.tahunPelajaran ?? "—"} · {data?.academicContext.semester ?? "—"}</div>
            <div className="mt-1 text-xs text-ink-500">{data?.curriculum?.name ?? "Kurikulum belum terbaca"}</div>
          </div>
        </div>
      </header>

      {error && <Card className="border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}<button className="ml-3 font-semibold underline" onClick={() => load(selectedClassId)}>Coba lagi</button></Card>}

      <section className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit p-4 lg:sticky lg:top-5">
          <div className="flex items-center justify-between"><div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Mulai dari sini</div><h2 className="mt-1 text-lg font-semibold">Pilih kelas</h2></div><button onClick={() => load(selectedClassId)} className="rounded-lg p-2 text-ink-400 hover:bg-surface-muted hover:text-ink-700" title="Periksa ulang"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
          <div className="relative mt-4"><Search className="absolute left-3 top-3 h-4 w-4 text-ink-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari kelas..." className="h-10 w-full rounded-xl border border-border bg-surface-muted pl-9 pr-3 text-sm outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10" /></div>
          <div className="mt-3 max-h-[430px] space-y-1 overflow-y-auto pr-1">
            {loading && !data ? <div className="space-y-2">{[1,2,3,4].map((x) => <div key={x} className="h-14 animate-pulse rounded-xl bg-surface-muted" />)}</div> : filteredClasses.map((kelas) => (
              <button key={kelas.id} onClick={() => chooseClass(kelas.id)} className={`w-full rounded-xl p-3 text-left transition ${selectedClassId === kelas.id ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-surface-muted"}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-semibold text-ink-900">{kelas.label}</span><ChevronRight className="h-4 w-4 text-ink-300" /></div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-ink-500"><span>{kelas.targetFilledJp}/{kelas.officialJp || kelas.targetJp} JP</span><span className={kelas.status === "ready" ? "text-emerald-700" : kelas.status === "blocked" ? "text-rose-700" : "text-amber-700"}>{kelas.status === "ready" ? "Siap" : kelas.status === "blocked" ? "Belum siap" : "Perlu perhatian"}</span></div>
              </button>
            ))}
            {!loading && !filteredClasses.length && <div className="p-4 text-center text-sm text-ink-500">Kelas tidak ditemukan.</div>}
          </div>
        </Card>

        <main className="space-y-5" aria-live="polite">
          {loading && !data ? <Card className="space-y-5 p-6"><div className="h-8 w-56 animate-pulse rounded-lg bg-surface-muted" /><div className="grid gap-3 sm:grid-cols-4">{[1,2,3,4].map((x) => <div key={x} className="h-24 animate-pulse rounded-2xl bg-surface-muted" />)}</div></Card> : selected ? <>
            <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Kondisi kelas</div><h2 className="mt-1 text-2xl font-semibold text-ink-900">{selected.label}</h2><p className="mt-1 text-sm text-ink-500">Saya sudah memeriksa data integrasi kurikulum untuk kelas ini.</p></div>
              <Badge>{selected.status === "ready" ? "✓ Siap" : selected.status === "blocked" ? "⚠ Belum siap" : "⚠ Perlu perhatian"}</Badge>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric icon={<Target className="h-4 w-4" />} value={`${selected.targetFilledJp}/${selected.officialJp || selected.targetJp}`} label="JP terisi dari integrasi" />
              <Metric icon={<AlertTriangle className="h-4 w-4" />} value={String(selected.missingTargetCount)} label="Mapel tanpa Target JP" />
              <Metric icon={<Database className="h-4 w-4" />} value={String(selected.newSubjectCount)} label="Mapel belum terhubung" />
              <Metric icon={<CircleHelp className="h-4 w-4" />} value={String(selected.reviewCount)} label="Perlu ditinjau" />
            </div>

            <Card className="p-6">
              <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-semibold text-ink-900"><Sparkles className="h-4 w-4 text-brand" /> Yang saya temukan</div><p className="mt-1 text-xs text-ink-500">Saya tidak menunggu pertanyaan. Ini prioritas yang saya temukan dari data yang terhubung.</p></div><span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-ink-500">{data?.issues.length ?? 0} temuan</span></div>
              <div className="mt-5 space-y-2">
                {data?.issues.length ? data.issues.map((issue, index) => <button key={issue.id} onClick={() => { const rec = data.recommendations.find((r) => r.id.replace("adopt-", "new-") === issue.id || r.id === issue.id); if (rec) setDrawer(rec); }} className="group flex w-full items-start gap-3 rounded-2xl bg-surface-muted p-4 text-left transition hover:bg-brand-50">
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${issue.severity === "high" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{String(index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1"><span className="block font-semibold text-ink-900">{issue.title}</span><span className="mt-1 block text-sm leading-5 text-ink-500">{issue.description}</span></span><ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand" />
                </button>) : <div className="rounded-2xl bg-emerald-50 p-5"><div className="flex items-center gap-2 font-semibold text-emerald-800"><CheckCircle2 className="h-5 w-5" /> Tidak ada masalah penting.</div><p className="mt-1 text-sm text-emerald-700">Data integrasi kurikulum kelas ini terlihat konsisten dari sumber yang tersedia.</p></div>}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start justify-between gap-4"><div><div className="text-sm font-semibold text-ink-900">✦ Langkah berikutnya</div><p className="mt-1 text-xs text-ink-500">Saya prioritaskan tindakan yang paling berguna terlebih dahulu.</p></div><Badge>{primaryIssue ? "Prioritas" : "Selesai"}</Badge></div>
              {primaryIssue ? <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-5"><div className="text-lg font-semibold text-brand-950">{primaryIssue.title}</div><p className="mt-1 max-w-2xl text-sm leading-6 text-brand-900/70">{primaryIssue.description}</p><button onClick={() => { const rec = data?.recommendations.find((r) => r.id === primaryIssue.id || r.id.replace("adopt-", "new-") === primaryIssue.id); if (rec) setDrawer(rec); }} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95">{primaryIssue.action}<ArrowRight className="h-4 w-4" /></button></div> : <div className="mt-4 rounded-2xl bg-surface-muted p-5"><div className="font-semibold text-ink-900">Kelas ini sudah siap.</div><p className="mt-1 text-sm text-ink-500">SAKALA AI tidak menemukan tindakan penting lain dari data integrasi kurikulum saat ini.</p></div>}
            </Card>

            <Card className="p-6"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold text-ink-900">Data yang saya gunakan</div><div className="mt-1 text-xs text-ink-500">SAKALA AI hanya membaca data integrasi yang relevan dengan kurikulum.</div></div><Database className="h-5 w-5 text-ink-300" /></div><div className="mt-4 flex flex-wrap gap-2">{data?.connectedData.map((item) => <span key={item} className="rounded-full border border-border bg-surface-muted px-3 py-1.5 text-xs text-ink-600">✓ {item}</span>)}</div><div className="mt-4 text-xs text-ink-400">Sumber: {data?.source ? `${data.source.name} · ${data.source.institution}` : "belum terbaca"} · Kurikulum: {data?.curriculum?.name ?? "—"}</div></Card>

            <div className="rounded-2xl border border-border bg-surface-muted/70 p-4"><div className="flex items-center gap-2 text-sm font-medium text-ink-700"><Search className="h-4 w-4" />Ingin mencari sesuatu secara khusus?</div><div className="mt-1 text-xs text-ink-500">Chat tetap tersedia sebagai lapisan tambahan, bukan pintu masuk utama.</div></div>
          </> : <Card className="p-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Sparkles className="h-6 w-6" /></div><h2 className="mt-4 text-lg font-semibold">Belum ada kelas untuk diperiksa</h2><p className="mt-1 text-sm text-ink-500">Pastikan kelas tersedia pada Active Academic Context.</p></Card>}
        </main>
      </section>

      {toast && <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium text-ink-800 shadow-soft"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{toast}<button onClick={() => setToast(null)}><X className="h-4 w-4 text-ink-400" /></button></div>}

      {drawer && <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setDrawer(null)}><aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Rekomendasi SAKALA AI</div><h2 className="mt-2 text-2xl font-semibold text-ink-900">{drawer.title}</h2></div><button onClick={() => setDrawer(null)} className="rounded-lg p-2 hover:bg-surface-muted"><X className="h-5 w-5" /></button></div>
        <div className="mt-6 space-y-4"><InfoBlock label="Mengapa saya menyarankan ini" value={drawer.reason} /><InfoBlock label="Dampaknya" value={drawer.impact} />{drawer.suggestedJp != null && <div className="rounded-2xl bg-surface-muted p-4"><div className="text-xs text-ink-400">Target yang disarankan</div><div className="mt-1 text-2xl font-semibold">{drawer.suggestedJp} JP</div></div>}</div>
        <div className="mt-7 flex gap-2"><Button onClick={() => void applyRecommendation(drawer)} disabled={busyAction === drawer.id || drawer.type === "review" || drawer.type === "info"}>{busyAction === drawer.id ? "Menyiapkan…" : drawer.type === "target" ? "Terapkan Target JP" : drawer.type === "adoption" ? "Buka data mapel" : "Tinjau"}</Button><Button variant="secondary" onClick={() => setDrawer(null)}>Batal</Button></div>
        {drawer.type === "review" && <p className="mt-3 text-xs leading-5 text-amber-700">Perbedaan tidak saya ubah otomatis. Tinjau dulu agar operator tetap memegang keputusan.</p>}
      </aside></div>}
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm"><div className="flex items-center gap-2 text-xs text-ink-500">{icon}{label}</div><div className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">{value}</div></div>;
}
function InfoBlock({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">{label}</div><p className="mt-1 text-sm leading-6 text-ink-700">{value}</p></div>;
}
