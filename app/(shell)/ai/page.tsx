"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Search, X, CalendarClock, UserRoundX, TriangleAlert } from "lucide-react";
import { getAiCopilotContextAction, type AiCopilotClassStatus, type AiCopilotContext } from "./actions";
import { Card, Badge, EmptyState, ErrorState } from "@/components/ui/primitives";
import RecommendationFlow from "@/components/ai/RecommendationFlow";
import { IntelligenceCore, IntelligencePerimeter, type IntelligenceState } from "@/components/ai/IntelligenceCore";
import { findClosestMatch } from "@/lib/domain/fuzzyMatch";

function classStatusTone(remainingJp: number, belumSiapJp: number): "success" | "warning" | "danger" {
  if (remainingJp === 0) return "success";
  return belumSiapJp > 0 ? "danger" : "warning";
}

function classStatusLabel(remainingJp: number, belumSiapJp: number): string {
  if (remainingJp === 0) return "Sesuai";
  if (belumSiapJp > 0 && belumSiapJp >= remainingJp) return `${belumSiapJp} JP guru belum ditentukan`;
  if (belumSiapJp > 0) return `${belumSiapJp} JP guru belum ada · ${remainingJp - belumSiapJp} JP belum terjadwal`;
  return `${remainingJp} JP belum terjadwal`;
}

function searchClasses(query: string, classes: AiCopilotClassStatus[]): AiCopilotClassStatus[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const wantsKurang = q.includes("kurang");
  const wantsSesuai = !wantsKurang && /sesuai|cukup|lengkap|terpenuhi/.test(q);
  if (wantsKurang) return classes.filter((c) => c.remainingJp > 0).sort((a, b) => b.remainingJp - a.remainingJp);
  if (wantsSesuai) return classes.filter((c) => c.remainingJp === 0);
  return classes.filter((c) => c.label.toLowerCase().includes(q) || c.subjectDeficits.some((d) => d.subjectName.toLowerCase().includes(q)));
}

// §35/§36 — kalau pencarian kosong hasil DAN bukan query pola khusus (kurang/
// sesuai), coba tawarkan koreksi ("Maksud Anda X?") daripada diam menampilkan
// "belum menemukan". Threshold ketat (lib/domain/fuzzyMatch) supaya tidak
// asal menyarankan sesuatu yang sebenarnya tidak mirip.
function searchSuggestion(query: string, classes: AiCopilotClassStatus[]): string | null {
  const q = query.trim().toLowerCase();
  if (!q || q.includes("kurang") || /sesuai|cukup|lengkap|terpenuhi/.test(q)) return null;
  const classNames = classes.map((c) => c.label);
  const subjectNames = [...new Set(classes.flatMap((c) => c.subjectDeficits.map((d) => d.subjectName)))];
  return findClosestMatch(query, [...classNames, ...subjectNames]);
}

function ClassCard({ status, onSelect }: { status: AiCopilotClassStatus; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className="group flex min-h-24 flex-col justify-between rounded-xl border border-border bg-surface px-3.5 py-3 text-left transition duration-150 hover:-translate-y-px hover:border-violet/30 hover:bg-violet-50/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/35">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-semibold text-ink-900">{status.label}</span>
        <Badge tone={classStatusTone(status.remainingJp, status.belumSiapJp)}>{classStatusLabel(status.remainingJp, status.belumSiapJp)}</Badge>
      </div>
      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-[19px] font-light tabular-nums text-ink-900">{status.scheduledJp}<span className="text-[11px] font-medium text-ink-400"> / {status.targetJp} JP</span></span>
        <span className="text-[10.5px] font-semibold text-violet opacity-0 transition group-hover:opacity-100">Tinjau →</span>
      </div>
    </button>
  );
}

export default function AiPage() {
  const [context, setContext] = useState<AiCopilotContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [, startTransition] = useTransition();
  const [intelligenceState, setIntelligenceState] = useState<IntelligenceState>("idle");
  const analysisRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const result = await getAiCopilotContextAction();
      if (!result.ok) {
        setLoadError(result.error);
        setContextLoading(false);
        return;
      }
      setContext(result.data);
      setContextLoading(false);
      setIntelligenceState("ready");
    });
  }, []);

  const selectedClass = context?.classes.find((c) => c.id === selectedClassId) ?? null;
  const searchResults = useMemo(() => searchClasses(searchQuery, context?.classes ?? []), [searchQuery, context]);
  const suggestion = useMemo(
    () => (searchResults.length === 0 ? searchSuggestion(searchQuery, context?.classes ?? []) : null),
    [searchQuery, searchResults, context]
  );

  useEffect(() => {
    const root = analysisRef.current;
    if (!root) return;
    const sync = () => {
      const text = root.textContent ?? "";
      const busy = /Memeriksa solusi|Menetapkan|Mengurangi|Menerapkan|Mengembalikan/.test(text);
      if (busy) {
        setIntelligenceState("analyzing");
        return;
      }
      if (/Disarankan|Tinjau perubahan|perubahan dipilih/.test(text)) {
        setIntelligenceState("found");
        return;
      }
      if (/Sudah diperbarui|Dikembalikan|Tidak ada masalah/.test(text)) setIntelligenceState("ready");
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => observer.disconnect();
  }, [selectedClassId]);

  function selectClass(id: string) {
    setSelectedClassId(id);
    setClassPickerOpen(false);
    setSearchQuery("");
    setIntelligenceState("ready");
  }

  async function refreshContext() {
    const result = await getAiCopilotContextAction();
    if (!result.ok) return;
    setContext(result.data);
    if (selectedClassId && !result.data.classes.some((c) => c.id === selectedClassId)) setSelectedClassId(null);
  }

  if (loadError) return <div className="mx-auto max-w-3xl px-4 pt-10"><ErrorState message={loadError} /></div>;

  const summary = selectedClass ? {
    scheduled: selectedClass.scheduledJp,
    target: selectedClass.targetJp,
    remaining: selectedClass.remainingJp,
    missingTeacher: selectedClass.belumSiapJp,
    conflicts: selectedClass.subjectExcess.length,
  } : null;

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <div className="px-1 py-1 sm:px-2">
        <header className="flex items-start justify-between gap-4 pb-7">
          <div className="flex min-w-0 items-center gap-3">
            <IntelligenceCore state={contextLoading ? "analyzing" : intelligenceState} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-ink-900">SAKALA AI</h1>
                {intelligenceState === "found" && <span className="text-[10px] font-semibold text-violet">4 hal perlu perhatian</span>}
              </div>
              <p className="mt-0.5 text-[12.5px] text-ink-500">Pahami data. Temukan solusi.</p>
            </div>
          </div>
          <span className={`shrink-0 pt-1 text-[10.5px] font-medium ${intelligenceState === "analyzing" ? "text-violet" : "text-ink-400"}`}>
            {contextLoading ? "Menganalisis…" : intelligenceState === "analyzing" ? "Menganalisis…" : intelligenceState === "found" ? "4 hal perlu perhatian" : "Siap membantu."}
          </span>
        </header>

        {contextLoading ? (
          <div className="space-y-3 py-8">
            <p className="text-[12px] text-ink-400">Memeriksa data akademik…</p>
            <div className="h-2.5 w-48 animate-pulse rounded bg-surface-muted" />
            <div className="h-6 w-72 animate-pulse rounded bg-surface-muted" />
          </div>
        ) : !context?.classes.length ? (
          <Card><EmptyState title="Belum ada kelas" description="Belum ada kelas dengan target JP aktif untuk konteks akademik ini." action={<a href="/akademik" className="mt-1 text-[12.5px] font-semibold text-brand-600">Buka Data Akademik →</a>} /></Card>
        ) : !selectedClass ? (
          <section className="space-y-6">
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-[.14em] text-violet">KONTEKS</p>
              <p className="mt-1 text-[14px] font-semibold text-ink-900">{context.schoolName}</p>
              <p className="text-[12px] text-ink-500">{context.contextLabel}</p>
            </div>
            <div className="border-t border-border/70 pt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[12.5px] font-semibold text-ink-800">Pilih kelas</p>
                <span className="text-[10.5px] text-ink-400">{context.classes.length} kelas</span>
              </div>
              <div className="relative mb-4 max-w-xl">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari kelas atau kebutuhan…" className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-9 text-[12.5px] text-ink-900 outline-none transition focus:border-violet/45 focus:ring-2 focus:ring-violet/10" />
                {searchQuery && <button type="button" onClick={() => setSearchQuery("")} aria-label="Bersihkan pencarian" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-300 hover:bg-surface-muted hover:text-ink-600"><X size={13} /></button>}
              </div>
              {searchQuery.trim() ? (
                <div className="max-w-2xl space-y-1.5">
                  <p className="text-[11.5px] text-ink-500">{searchResults.length ? `Saya menemukan ${searchResults.length} kelas.` : "Saya belum menemukan kelas yang cocok dengan itu."}</p>
                  {searchResults.length === 0 && suggestion && (
                    <button type="button" onClick={() => setSearchQuery(suggestion)} className="flex items-center gap-1.5 rounded-full border border-violet/25 bg-violet-50/40 px-3 py-1.5 text-[11.5px] font-medium text-violet hover:bg-violet-50">
                      Maksud Anda <strong>"{suggestion}"</strong>?
                    </button>
                  )}
                  {searchResults.map((c) => <button key={c.id} type="button" onClick={() => selectClass(c.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left hover:border-violet/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/35"><span className="flex items-center gap-2.5"><span className="text-[13px] font-semibold text-ink-900">{c.label}</span><Badge tone={classStatusTone(c.remainingJp, c.belumSiapJp)}>{classStatusLabel(c.remainingJp, c.belumSiapJp)}</Badge></span><span className="text-[10.5px] font-semibold text-violet">Tinjau →</span></button>)}
                </div>
              ) : <div className="grid max-w-4xl gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{context.classes.map((c) => <ClassCard key={c.id} status={c} onSelect={() => selectClass(c.id)} />)}</div>}
            </div>
          </section>
        ) : (
          <section className="space-y-8">
            <div className="border-b border-border/70 pb-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-[.14em] text-violet">KONTEKS AKTIF</p>
                  <p className="mt-1 text-[13px] font-semibold text-ink-900">{context.schoolName}</p>
                  <p className="text-[11.5px] text-ink-500">{context.contextLabel}</p>
                </div>
                <div className="relative">
                  <button type="button" onClick={() => setClassPickerOpen((v) => !v)} aria-expanded={classPickerOpen} className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-ink-600 hover:border-violet/25 hover:text-violet">{selectedClass.label}<ChevronDown size={13} className={classPickerOpen ? "rotate-180" : ""} /></button>
                  {classPickerOpen && <div className="absolute right-0 top-full z-30 mt-2 max-h-72 w-64 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5 shadow-xl">{context.classes.map((c) => <button key={c.id} type="button" onClick={() => selectClass(c.id)} className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-[12px] hover:bg-surface-muted ${c.id === selectedClassId ? "text-violet" : "text-ink-700"}`}><span className="font-medium">{c.label}</span><span className="flex items-center gap-1.5"><span className="text-[10.5px] tabular-nums text-ink-400">{c.scheduledJp}/{c.targetJp}</span>{c.id === selectedClassId && <Check size={13} />}</span></button>)}</div>}
                </div>
              </div>
            </div>

            {summary && <section>
              <p className="mb-3 text-[9.5px] font-bold uppercase tracking-[.14em] text-ink-400">RINGKASAN INTELLIGENCE</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-surface p-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet"><CalendarClock size={15} /></div>
                  <p className="mt-2.5 text-[24px] font-light leading-none tabular-nums text-ink-900">{summary.remaining}</p>
                  <p className="mt-1 text-[11px] text-ink-500">JP belum terjadwal</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber"><UserRoundX size={15} /></div>
                  <p className="mt-2.5 text-[24px] font-light leading-none tabular-nums text-ink-900">{summary.missingTeacher}</p>
                  <p className="mt-1 text-[11px] text-ink-500">JP belum memiliki guru</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose"><TriangleAlert size={15} /></div>
                  <p className="mt-2.5 text-[24px] font-light leading-none tabular-nums text-ink-900">{summary.conflicts}</p>
                  <p className="mt-1 text-[11px] text-ink-500">mapel kelebihan JP</p>
                </div>
              </div>
            </section>}

            <section ref={analysisRef} aria-label="Analisis SAKALA AI">
              <p className="mb-4 text-[9.5px] font-bold uppercase tracking-[.14em] text-ink-400">ANALISIS</p>
              <IntelligencePerimeter active={intelligenceState === "analyzing"}>
                <div className="px-0.5 py-0.5">
                  <RecommendationFlow classStatus={selectedClass} subjectNames={context.subjectNames} teacherNames={context.teacherNames} roomNames={context.roomNames} onCandidatesSaved={refreshContext} />
                </div>
              </IntelligencePerimeter>
            </section>

            <section className="border-t border-border/70 pt-4">
              <details>
                <summary className="cursor-pointer list-none text-[11.5px] font-medium text-ink-500 hover:text-ink-700">⌄ Mengapa solusi ini?</summary>
                <div className="mt-3 grid gap-2 sm:grid-cols-4"><div><p className="text-[10px] text-ink-400">Target JP</p><p className="text-[12px] font-semibold tabular-nums text-ink-800">{selectedClass.targetJp}</p></div><div><p className="text-[10px] text-ink-400">JP terjadwal</p><p className="text-[12px] font-semibold tabular-nums text-ink-800">{selectedClass.scheduledJp}</p></div><div><p className="text-[10px] text-ink-400">Guru</p><p className="text-[12px] font-semibold tabular-nums text-ink-800">{selectedClass.belumSiapJp === 0 ? "Siap" : `${selectedClass.belumSiapJp} JP belum siap`}</p></div><div><p className="text-[10px] text-ink-400">Kelebihan JP</p><p className="text-[12px] font-semibold tabular-nums text-ink-800">{selectedClass.excessJp}</p></div></div>
              </details>
            </section>
          </section>
        )}
      </div>
    </div>
  );
}
