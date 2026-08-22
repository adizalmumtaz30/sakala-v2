"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  GraduationCap,
  Info,
  Layers3,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { getAiCopilotContextAction, type AiCopilotContext, type AiSubjectInsight } from "./actions";

const statusLabel: Record<AiSubjectInsight["status"], string> = {
  siap: "Siap",
  belum_terintegrasi: "Belum terintegrasi",
  target_belum_diisi: "Target belum diisi",
  berbeda: "Berbeda",
  perlu_ditinjau: "Perlu ditinjau",
};

function StatusPill({ status }: { status: AiSubjectInsight["status"] }) {
  const tone = status === "siap" ? "bg-emerald-50 text-emerald-700" : status === "berbeda" || status === "perlu_ditinjau" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{statusLabel[status]}</span>;
}

function Metric({ value, label, tone = "neutral", onClick }: { value: string | number; label: string; tone?: "neutral" | "good" | "warning" | "danger"; onClick?: () => void }) {
  const tones = { neutral: "text-ink-900", good: "text-emerald-700", warning: "text-amber-700", danger: "text-rose-700" };
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl bg-surface-muted p-4 text-left transition hover:-translate-y-0.5 hover:bg-surface hover:shadow-soft ${onClick ? "cursor-pointer" : "cursor-default"}`}>
      <div className={`text-2xl font-semibold tracking-tight ${tones[tone]}`}>{value}</div>
      <div className="mt-1 text-xs text-ink-500">{label}</div>
    </button>
  );
}

export default function AiPage() {
  const [context, setContext] = useState<AiCopilotContext | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<AiSubjectInsight | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getAiCopilotContextAction();
      if (!result.ok) setError(result.error);
      else setContext(result.data);
    });
  }, []);

  const selectedClass = context?.classes.find((item) => item.id === selectedClassId) ?? null;
  const selectedSubjects = useMemo(() => {
    if (!context || !selectedClass) return [];
    const rows = context.subjects.filter((item) => item.level === selectedClass.level);
    return rows.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
  }, [context, selectedClass, search]);

  const insights = useMemo(() => {
    if (!selectedClass) return [] as Array<{ title: string; text: string; tone: "danger" | "warning" | "good" | "neutral"; action: "generate" | "target" | "subjects" }>; 
    const result: Array<{ title: string; text: string; tone: "danger" | "warning" | "good" | "neutral"; action: "generate" | "target" | "subjects" }> = [];
    if (selectedClass.missingSubjects > 0) result.push({ title: `${selectedClass.missingSubjects} mapel belum terintegrasi`, text: `Data kurikulum resmi untuk ${selectedClass.label} belum seluruhnya masuk ke integrasi kelas.`, tone: "danger", action: "generate" });
    if (selectedClass.gapJp > 0) result.push({ title: `${selectedClass.gapJp} JP belum terpenuhi`, text: "Target sekolah masih berada di bawah alokasi kurikulum yang terbaca.", tone: "warning", action: "target" });
    if (selectedClass.emptyTargets > 0) result.push({ title: `${selectedClass.emptyTargets} target JP belum diisi`, text: "Beberapa kombinasi kelas dan mapel belum memiliki Target JP aktif.", tone: "warning", action: "target" });
    if (selectedClass.ready) result.push({ title: "Integrasi kurikulum siap", text: "Mapel, integrasi, dan Target JP pada kelas ini sudah terbaca konsisten.", tone: "good", action: "subjects" });
    if (!result.length) result.push({ title: "Ada data yang bisa ditinjau", text: "SAKALA AI menemukan data kurikulum yang dapat diperiksa lebih lanjut.", tone: "neutral", action: "subjects" });
    return result;
  }, [selectedClass]);

  function reload() {
    setError(null);
    startTransition(async () => {
      const result = await getAiCopilotContextAction();
      if (!result.ok) setError(result.error);
      else setContext(result.data);
    });
  }

  function actionHref(action: "generate" | "target" | "subjects") {
    if (action === "generate") return "/akademik/generate-kurikulum";
    if (action === "target") return "/akademik/target-jp";
    return "/akademik/mata-pelajaran";
  }

  return (
    <main className="mx-auto max-w-6xl space-y-7 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand"><Sparkles className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.18em]">Intelligent Academic Workspace</span></div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-950">SAKALA AI</h1>
          <p className="mt-1 text-sm text-ink-500">Pahami data. Temukan solusi.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={reload} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-sm font-semibold text-ink-700 transition hover:bg-surface-muted disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Periksa ulang</button>
          <button type="button" onClick={() => setScopeOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-sm font-semibold text-ink-700 transition hover:bg-surface-muted"><Info className="h-4 w-4" />Data yang diperiksa</button>
        </div>
      </header>

      <section className="overflow-hidden rounded-[26px] border border-border bg-surface shadow-soft">
        <div className="border-b border-border px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">Konteks aktif</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
                <span>{context ? `${context.academicYear} · ${context.semester}` : "Menyiapkan konteks…"}</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">● Aktif</span>
              </div>
            </div>
            <span className="text-xs text-ink-400">SAKALA AI hanya membaca data · tidak mengubah data</span>
          </div>
        </div>

        <div className="px-5 py-6 sm:px-7">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand"><GraduationCap className="h-5 w-5" /></div><div><h2 className="text-lg font-semibold text-ink-950">Pilih kelas</h2><p className="text-xs text-ink-500">Pilih kelas terlebih dahulu. Setelah itu SAKALA AI langsung membaca kondisinya.</p></div></div>

            {loading && !context ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-surface-muted" />)}</div>
            ) : context?.classes.length ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {context.classes.map((kelas) => {
                  const active = selectedClassId === kelas.id;
                  return <button key={kelas.id} type="button" onClick={() => { setSelectedClassId(kelas.id); setSearch(""); setDetail(null); }} className={`group rounded-2xl border p-4 text-left transition-all ${active ? "border-brand bg-brand-50/60 shadow-soft" : "border-border bg-surface hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-soft"}`}>
                    <div className="flex items-start justify-between gap-3"><div><div className="text-base font-semibold text-ink-950">Kelas {kelas.label}</div><div className="mt-1 text-xs text-ink-500">{kelas.integratedSubjects}/{kelas.expectedSubjects} mapel terintegrasi</div></div><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${active ? "bg-brand text-white" : "bg-surface-muted text-ink-400"}`}><ArrowRight className="h-4 w-4" /></span></div>
                    <div className="mt-4 flex items-end justify-between"><div><div className={`text-xl font-semibold ${kelas.gapJp > 0 ? "text-amber-700" : "text-emerald-700"}`}>{kelas.schoolJp} / {kelas.officialJp} JP</div><div className="mt-0.5 text-[11px] text-ink-400">Target sekolah / kurikulum</div></div><span className={`text-[11px] font-semibold ${kelas.ready ? "text-emerald-700" : "text-amber-700"}`}>{kelas.ready ? "✓ Siap" : `Perlu perhatian`}</span></div>
                  </button>;
                })}
              </div>
            ) : <div className="mt-5 rounded-2xl bg-surface-muted p-6 text-sm text-ink-600">Belum ada kelas pada konteks aktif.</div>}
          </div>
        </div>
      </section>

      {error && <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}<button type="button" onClick={reload} className="ml-3 font-semibold underline">Coba lagi</button></section>}

      {selectedClass && context && (
        <div className="space-y-6">
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-5 py-4 shadow-soft sm:px-6">
            <div><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">Kelas terpilih</div><div className="mt-1 text-xl font-semibold text-ink-950">Kelas {selectedClass.label}</div></div>
            <div className="relative"><button type="button" onClick={() => setSelectedClassId(null)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-sm font-semibold text-ink-700 hover:bg-surface-muted">Ganti kelas <ChevronDown className="h-4 w-4" /></button></div>
          </section>

          <section className="space-y-4">
            <div><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">Kondisi kelas</div><h2 className="mt-1 text-xl font-semibold tracking-tight text-ink-950">Ringkasan yang perlu diketahui</h2></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric value={`${selectedClass.schoolJp}/${selectedClass.officialJp}`} label="JP terpenuhi" tone={selectedClass.gapJp ? "warning" : "good"} />
              <Metric value={selectedClass.gapJp} label="JP belum terpenuhi" tone={selectedClass.gapJp ? "danger" : "good"} />
              <Metric value={selectedClass.missingSubjects} label="Mapel belum terintegrasi" tone={selectedClass.missingSubjects ? "danger" : "good"} />
              <Metric value={selectedClass.emptyTargets} label="Target JP belum diisi" tone={selectedClass.emptyTargets ? "warning" : "good"} />
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
            <div className="space-y-4">
              <div><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">Insight</div><h2 className="mt-1 text-xl font-semibold tracking-tight text-ink-950">✦ Yang saya temukan</h2></div>
              <div className="space-y-3">
                {insights.map((item) => <div key={item.title} className="rounded-2xl border border-border bg-surface p-5 shadow-soft transition hover:shadow-md"><div className="flex gap-4"><div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone === "danger" ? "bg-rose-50 text-rose-600" : item.tone === "warning" ? "bg-amber-50 text-amber-600" : item.tone === "good" ? "bg-emerald-50 text-emerald-600" : "bg-brand-50 text-brand"}`}>{item.tone === "good" ? <CheckCircle2 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="font-semibold text-ink-950">{item.title}</div><p className="mt-1 text-sm leading-6 text-ink-500">{item.text}</p><Link href={actionHref(item.action)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">{item.action === "generate" ? "Tinjau integrasi" : item.action === "target" ? "Atur Target JP" : "Lihat mata pelajaran"}<ArrowRight className="h-4 w-4" /></Link></div></div></div>)}
              </div>
            </div>

            <aside className="h-fit rounded-2xl border border-border bg-surface p-5 shadow-soft">
              <div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand"><Sparkles className="h-4 w-4" /></div><div><div className="text-sm font-semibold text-ink-950">Langkah berikutnya</div><div className="text-xs text-ink-500">SAKALA menyarankan yang paling relevan.</div></div></div>
              <div className="mt-5 rounded-2xl bg-surface-muted p-4"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Prioritas</div><div className="mt-1 text-base font-semibold text-ink-950">{insights[0]?.title ?? "Periksa data kelas"}</div><p className="mt-1 text-xs leading-5 text-ink-500">{insights[0]?.text}</p><Link href={actionHref(insights[0]?.action ?? "subjects")} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:opacity-90">Mulai <ArrowRight className="h-4 w-4" /></Link></div>
              <div className="mt-4 text-[11px] leading-5 text-ink-400">SAKALA AI tidak menjalankan perubahan otomatis. Anda tetap menyetujui tindakan di fitur asalnya.</div>
            </aside>
          </section>

          <section className="rounded-2xl border border-border bg-surface shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6"><div><h2 className="font-semibold text-ink-950">Detail kurikulum kelas</h2><p className="mt-1 text-xs text-ink-500">Data yang dipakai SAKALA AI untuk menyusun insight di atas.</p></div><div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari mata pelajaran…" className="h-10 w-full rounded-xl border border-border bg-surface-muted pl-9 pr-3 text-sm outline-none transition focus:border-brand/50 focus:ring-2 focus:ring-brand/10" /></div></div>
            <div className="divide-y divide-border">
              {selectedSubjects.map((subject) => <button key={subject.id} type="button" onClick={() => setDetail(subject)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-surface-muted sm:px-6"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink-500"><BookOpenCheck className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-ink-900">{subject.name}</div><div className="mt-1 text-xs text-ink-500">Kurikulum {subject.officialJp ?? 0} JP · Target aktif {subject.targetJp == null ? "—" : `${subject.targetJp} JP`}</div></div><StatusPill status={subject.status} /><ArrowRight className="h-4 w-4 shrink-0 text-ink-300" /></button>)}
              {!selectedSubjects.length && <div className="p-10 text-center text-sm text-ink-500">Tidak ada mata pelajaran yang cocok.</div>}
            </div>
          </section>
        </div>
      )}

      {!selectedClass && context && <section className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Sparkles className="h-5 w-5" /></div><h2 className="mt-4 text-lg font-semibold text-ink-950">Pilih kelas untuk mulai</h2><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-ink-500">SAKALA AI akan langsung membaca integrasi kurikulum, Target JP, dan menemukan hal yang perlu Anda lakukan.</p></section>}

      {detail && <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Detail ${detail.name}`}><button type="button" aria-label="Tutup" onClick={() => setDetail(null)} className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" /><aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl"><header className="flex items-center justify-between border-b border-border px-5 py-4"><div><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">Detail</div><h2 className="mt-1 text-lg font-semibold text-ink-950">{detail.name}</h2></div><button type="button" onClick={() => setDetail(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-ink-500 hover:bg-surface-muted"><X className="h-4 w-4" /></button></header><div className="flex-1 overflow-auto p-5"><StatusPill status={detail.status} /><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-surface-muted p-4"><div className="text-xs text-ink-400">Kurikulum</div><div className="mt-1 text-xl font-semibold">{detail.officialJp ?? 0} JP</div></div><div className="rounded-xl bg-surface-muted p-4"><div className="text-xs text-ink-400">Target aktif</div><div className="mt-1 text-xl font-semibold">{detail.targetJp == null ? "—" : `${detail.targetJp} JP`}</div></div></div><div className="mt-5 rounded-2xl border border-border p-4"><div className="text-sm font-semibold text-ink-900">Apa yang terjadi?</div><p className="mt-2 text-sm leading-6 text-ink-500">{detail.reason}</p></div><div className="mt-4 rounded-2xl bg-surface-muted p-4"><div className="text-sm font-semibold text-ink-900">Tindakan yang tersedia</div><p className="mt-1 text-xs leading-5 text-ink-500">SAKALA AI tidak mengubah data dari sini. Gunakan fitur sumber agar perubahan tetap terkontrol.</p><Link href={detail.status === "belum_terintegrasi" ? "/akademik/generate-kurikulum" : "/akademik/target-jp"} className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white">{detail.status === "belum_terintegrasi" ? "Tinjau integrasi" : "Buka Target JP"}<ArrowRight className="h-4 w-4" /></Link></div></div></aside></div>}

      {scopeOpen && context?.source && <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Data yang diperiksa"><button type="button" aria-label="Tutup" onClick={() => setScopeOpen(false)} className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" /><aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl"><header className="flex items-center justify-between border-b border-border px-5 py-4"><div><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">Transparansi</div><h2 className="mt-1 text-lg font-semibold text-ink-950">Data yang diperiksa</h2></div><button type="button" onClick={() => setScopeOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-ink-500 hover:bg-surface-muted"><X className="h-4 w-4" /></button></header><div className="flex-1 overflow-auto p-5"><div className="rounded-2xl bg-surface-muted p-4"><div className="text-xs text-ink-400">Sumber aktif</div><div className="mt-1 font-semibold text-ink-950">{context.source.curriculumName}</div><div className="mt-1 text-xs text-ink-500">{context.source.name} · {context.source.regulationYear ?? "—"}</div><div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Terverifikasi</div></div><div className="mt-4 space-y-2">{context.dataScope.map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm"><Layers3 className="h-4 w-4 text-brand" /><span>{item}</span></div>)}</div><div className="mt-5 text-xs leading-5 text-ink-400">SAKALA AI menggunakan data ini untuk membaca kondisi dan memberi rekomendasi. AI tidak membuat kurikulum dan tidak menulis perubahan otomatis.</div>{context.source.officialUrl && <a href={context.source.officialUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline">Lihat sumber resmi <ExternalLink className="h-4 w-4" /></a>}</div></aside></div>}
    </main>
  );
}
