"use client";

// Kontrak UI/UX SAKALA AI (FINAL/LOCKED) — bagian yang diimplementasikan di file
// ini: §03 First Screen, §04 Class Selection, §05 Header setelah kelas dipilih,
// §06 Top Summary. Bagian Recommendation→Action (§08-25: "Yang Saya Temukan",
// Solution Drawer, Preview, Approval, Execution, Verification) BELUM
// diimplementasikan di sini — menyusul di fase berikutnya. Fungsi
// runIntent/runPlan/saveCandidate di bawah ini adalah jembatan sementara ke
// backend planner yang sudah ada (candidate-only, tidak pernah mengubah
// jadwal committed) sambil menunggu komponen Recommendation→Action yang sesuai
// kontrak dibangun di atasnya.

import { useEffect, useMemo, useState, useTransition } from "react";
import { Sparkles, CheckCircle2, AlertTriangle, RotateCcw, ChevronDown, Check, Search, X } from "lucide-react";
import { getAiCopilotContextAction, planScheduleAction, saveAiCandidatesAction, type AiCopilotContext, type AiCopilotClassStatus } from "./actions";
import Button from "@/components/ui/Button";
import { Card, Badge, EmptyState, ErrorState } from "@/components/ui/primitives";
import RecommendationFlow from "@/components/ai/RecommendationFlow";

type AiPlan = Extract<Awaited<ReturnType<typeof planScheduleAction>>, { ok: true }>["data"];

function classStatusTone(remainingJp: number): "success" | "warning" {
  return remainingJp === 0 ? "success" : "warning";
}

// §32 AI State — bahasa status sederhana, tanpa animasi "berpikir" berlebihan.
type AiState = "checking" | "watching" | "checked";
const AI_STATE_LABEL: Record<AiState, string> = { checking: "Sedang diperiksa", watching: "Memeriksa perubahan", checked: "Data diperiksa" };
function AiStateBadge({ state }: { state: AiState }) {
  return <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${state === "checked" ? "bg-emerald-50 text-emerald" : "bg-surface-muted text-ink-500"}`}>
    {state === "checking" ? <Search size={11} className="animate-pulse" /> : state === "watching" ? <RotateCcw size={11} className="animate-spin" /> : <Check size={11} />}
    {AI_STATE_LABEL[state]}
  </span>;
}

// §28 Search — bahasa natural sederhana atas data kelas yang sudah ada di context
// (tidak perlu panggilan backend baru; hasil selalu berupa data + tindakan, bukan
// sekadar daftar pencarian).
function searchClasses(query: string, classes: AiCopilotClassStatus[]): AiCopilotClassStatus[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const wantsKurang = q.includes("kurang");
  const wantsSesuai = !wantsKurang && /sesuai|cukup|lengkap|terpenuhi/.test(q);
  if (wantsKurang) return classes.filter((c) => c.remainingJp > 0).sort((a, b) => b.remainingJp - a.remainingJp);
  if (wantsSesuai) return classes.filter((c) => c.remainingJp === 0);
  return classes.filter((c) => c.label.toLowerCase().includes(q) || c.subjectDeficits.some((d) => d.subjectName.toLowerCase().includes(q)));
}

export default function AiPage() {
  const [context, setContext] = useState<AiCopilotContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [command, setCommand] = useState("");
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getAiCopilotContextAction();
      if (!result.ok) {
        setLoadError(result.error);
        setContextLoading(false);
        return;
      }
      setContext(result.data);
      // Belum ada kelas yang dipilih operator di First Screen — jangan auto-select
      // (§03: operator memilih sendiri, bukan AI yang menebak).
      setContextLoading(false);
    });
  }, []);

  const selectedClass = context?.classes.find((c) => c.id === selectedClassId) ?? null;
  const hasClasses = Boolean(context?.classes.length);
  const searchResults = useMemo(() => searchClasses(searchQuery, context?.classes ?? []), [searchQuery, context]);

  const kondisiKelas = useMemo(() => {
    if (!selectedClass) return null;
    return {
      jpLabel: `${selectedClass.scheduledJp} / ${selectedClass.targetJp}`,
      jpSubtitle: "JP terpenuhi",
      mapelKurang: selectedClass.subjectDeficits.length,
    };
  }, [selectedClass]);

  function selectClass(id: string) {
    setSelectedClassId(id);
    setClassPickerOpen(false);
    setPlan(null); setError(null); setSaved(null);
  }

  function runPlan() {
    setError(null); setSaved(null);
    startTransition(async () => {
      const result = await planScheduleAction(command);
      if (!result.ok) { setPlan(null); setError(result.error); return; }
      setPlan(result.data);
    });
  }

  function saveCandidate() {
    if (!plan) return;
    startTransition(async () => {
      const result = await saveAiCandidatesAction(plan.result.candidates.map((c) => c.draft));
      if (!result.ok) { setError(result.error); return; }
      setSaved(`${result.data.savedCount} candidate disimpan.${result.data.skippedCount ? ` ${result.data.skippedCount} dilewati karena conflict.` : ""}`);
    });
  }

  function reset() { setCommand(""); setPlan(null); setError(null); setSaved(null); }

  if (loadError) {
    return <div className="mx-auto max-w-3xl px-4 pt-10"><ErrorState message={loadError} /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      {/* §03/§05 — Header: identitas + konteks selalu terlihat, tidak pernah hilang. */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-brand-600" /><h1 className="text-[19px] font-semibold tracking-tight text-ink-900">SAKALA AI</h1></div>
          <p className="text-[12.5px] text-ink-500">Pahami data. Temukan solusi.</p>
        </div>
        {/* §32 AI State — mencerminkan status nyata (fetch/pending), bukan animasi berpikir dibuat-buat. */}
        <AiStateBadge state={contextLoading ? "checking" : isPending ? "watching" : "checked"} />
      </header>

      {contextLoading ? (
        <Card className="space-y-3">
          <p className="text-[11.5px] font-medium text-ink-400">Memeriksa data kelas…</p>
          <div className="h-3 w-40 animate-pulse rounded bg-surface-muted" />
          <div className="h-6 w-64 animate-pulse rounded bg-surface-muted" />
        </Card>
      ) : !hasClasses ? (
        <Card><EmptyState title="Belum ada kelas" description="Belum ada kelas dengan target JP aktif untuk konteks akademik ini." action={<a href="/akademik" className="mt-1 text-[12.5px] font-semibold text-brand-600">Buka Data Akademik →</a>} /></Card>
      ) : !selectedClass ? (
        // §03 First Screen — tanpa chat kosong, tanpa "ada yang bisa saya bantu", langsung ke pemilihan kelas.
        <Card className="space-y-4">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[.14em] text-brand-600">Konteks Aktif</p>
            <p className="mt-1 text-[13px] font-semibold text-ink-800">{context?.schoolName} · {context?.contextLabel}</p>
          </div>
          <div>
            <p className="mb-2.5 text-[12.5px] font-semibold text-ink-700">Pilih kelas</p>
            {/* §28 Search — bahasa natural, hasil = data + tindakan langsung. */}
            <div className="relative mb-3">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder='Cari kelas… mis. "kelas yang kurang JP"' className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-8 text-[12.5px] text-ink-900 outline-none transition focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/10" />
              {searchQuery && <button type="button" onClick={() => setSearchQuery("")} aria-label="Bersihkan pencarian" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-ink-300 hover:bg-surface-muted hover:text-ink-600"><X size={13} /></button>}
            </div>
            {searchQuery.trim() ? (
              <div className="space-y-1.5">
                <p className="text-[11.5px] text-ink-500">{searchResults.length > 0 ? `Saya menemukan ${searchResults.length} kelas.` : "Saya belum menemukan kelas yang cocok dengan itu."}</p>
                {searchResults.map((c) => <button key={c.id} type="button" onClick={() => selectClass(c.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left hover:border-brand-600/30 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
                  <span className="flex items-center gap-2.5"><span className="text-[13px] font-semibold text-ink-900">{c.label}</span><Badge tone={classStatusTone(c.remainingJp)}>{c.remainingJp === 0 ? "Sesuai" : `${c.remainingJp} JP kurang`}</Badge></span>
                  <span className="text-[10.5px] font-semibold text-brand-600">Tinjau →</span>
                </button>)}
              </div>
            ) : (
              // §04 Class Selection — kartu berisi status JP, bukan sekadar nama kelas.
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {context?.classes.map((c) => <ClassCard key={c.id} status={c} onSelect={() => selectClass(c.id)} />)}
              </div>
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* §05 — Header setelah kelas dipilih: konteks + kelas tetap terlihat, dengan Ganti kelas. */}
          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-[.14em] text-brand-600">{context?.schoolName} · {context?.contextLabel}</p>
                <h2 className="mt-1 text-[17px] font-semibold text-ink-900">Kelas {selectedClass.label}</h2>
              </div>
              <div className="relative">
                <button type="button" onClick={() => setClassPickerOpen((v) => !v)} aria-expanded={classPickerOpen} className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-ink-600 hover:border-brand-600/25 hover:text-brand-700">
                  Ganti kelas <ChevronDown size={13} className={`transition-transform ${classPickerOpen ? "rotate-180" : ""}`} />
                </button>
                {classPickerOpen && <div className="absolute right-0 top-full z-20 mt-2 max-h-72 w-64 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5 shadow-xl">
                  {context?.classes.map((c) => <button key={c.id} type="button" onClick={() => selectClass(c.id)} className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-[12px] hover:bg-surface-muted ${c.id === selectedClassId ? "text-brand-700" : "text-ink-700"}`}>
                    <span className="font-medium">{c.label}</span>
                    <span className="flex items-center gap-1.5"><span className="text-[10.5px] tabular-nums text-ink-400">{c.scheduledJp}/{c.targetJp} JP</span>{c.id === selectedClassId && <Check size={13} className="text-brand-600" />}</span>
                  </button>)}
                </div>}
              </div>
            </div>

            {/* §06 Top Summary — Kondisi Kelas, metric interaktif menuju bagian relevan. */}
            {kondisiKelas && <div className="grid gap-2.5 sm:grid-cols-2">
              <div className={`rounded-xl p-4 ${selectedClass.remainingJp === 0 ? "bg-emerald-50" : "bg-amber-50"}`}>
                <div className="text-[19px] font-bold leading-none tabular-nums text-ink-900">{kondisiKelas.jpLabel} JP</div>
                <div className="mt-1.5 text-[11px] font-medium text-ink-600">{kondisiKelas.jpSubtitle}</div>
                <div className="mt-1"><Badge tone={classStatusTone(selectedClass.remainingJp)}>{selectedClass.remainingJp === 0 ? "Sesuai" : `${selectedClass.remainingJp} JP kurang`}</Badge></div>
              </div>
              <button type="button" onClick={() => document.getElementById("mapel-kurang")?.scrollIntoView({ behavior: "smooth", block: "start" })} disabled={kondisiKelas.mapelKurang === 0} className="rounded-xl bg-surface-muted p-4 text-left transition-colors enabled:hover:bg-brand-50 disabled:cursor-default">
                <div className="text-[19px] font-bold leading-none tabular-nums text-ink-900">{kondisiKelas.mapelKurang}</div>
                <div className="mt-1.5 text-[11px] font-medium text-ink-600">Mapel perlu diatur</div>
              </button>
            </div>}
          </Card>

          {/* §08-25 — Recommendation→Action: Yang Saya Temukan → Solusi → Preview → Terapkan → Verifikasi. */}
          <div id="mapel-kurang">
            <RecommendationFlow
              key={selectedClass.id}
              classStatus={selectedClass}
              subjectNames={context?.subjectNames ?? {}}
              teacherNames={context?.teacherNames ?? {}}
              onCandidatesSaved={() => {
                startTransition(async () => {
                  const result = await getAiCopilotContextAction();
                  if (result.ok) setContext(result.data);
                });
              }}
            />
          </div>

          <Card className="space-y-4">
            <div><div className="text-[12.5px] font-semibold text-ink-900">Atau katakan kebutuhanmu</div><div className="mt-1 text-[11px] leading-5 text-ink-500">Jalur tambahan — Anda tidak perlu mengetahui struktur intent atau constraint engine.</div></div>
            <textarea value={command} onChange={(e) => setCommand(e.target.value)} placeholder={'Contoh: "Isi jadwal kelas ini yang masih kosong."\nAtau: "Susun semua mapel untuk satu minggu."'} rows={3} className="w-full rounded-xl border border-border bg-surface-muted p-4 text-[12.5px] text-ink-900 outline-none transition focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/10" />
            <div className="flex flex-wrap gap-2"><Button onClick={runPlan} disabled={isPending || !command.trim()}>{isPending ? "Memeriksa data…" : "Susun rancangan"}</Button><Button variant="secondary" onClick={reset} disabled={isPending}><RotateCcw className="mr-2 h-4 w-4" />Batal</Button></div>
            {error && <div className="rounded-xl bg-rose-50 p-4 text-[12.5px] text-rose"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div>}
          </Card>

          {plan && <Card className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="text-[15px] font-semibold text-ink-900">Rancangan Perubahan</h2><Badge tone="info">{plan.intent === "schedule_full_week" ? "Susun Mingguan" : "Target JP"}</Badge></div><p className="mt-1 max-w-4xl text-[12px] leading-6 text-ink-500">{plan.explanation}</p></div><Badge tone="neutral">{plan.result.candidates.length}/{plan.targetJp} JP</Badge></div>
            {plan.interpretedTargets?.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{plan.interpretedTargets.map((item) => <div key={item.subjectId} className="rounded-lg bg-surface-muted p-3 text-[12px]"><strong>{item.subjectName}</strong><div className="mt-1 text-[11px] text-ink-500">Target {item.targetJp} · Terwakili {item.existingJp} · Sisa {item.remainingJp}</div></div>)}</div> : null}
            <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-[12.5px]"><thead><tr className="border-b border-border text-left"><th className="p-3">Hari</th><th className="p-3">Jam</th><th className="p-3">Kelas</th><th className="p-3">Mapel</th><th className="p-3">Guru</th><th className="p-3">Status</th></tr></thead><tbody>{plan.result.candidates.map((c, i) => <tr key={`${c.requirementId}-${i}`} className="border-b border-border last:border-0"><td className="p-3">{c.draft.day}</td><td className="p-3">JP {c.draft.periodStart}{c.draft.periodEnd !== c.draft.periodStart ? `–${c.draft.periodEnd}` : ""}</td><td className="p-3">{c.draft.classId}</td><td className="p-3">{c.draft.subjectId}</td><td className="p-3">{c.draft.teacherId}</td><td className="p-3"><Badge tone="neutral">rancangan</Badge></td></tr>)}</tbody></table></div>
            {plan.needsClarification && <div className="rounded-xl border border-amber/30 bg-amber-50 p-4 text-[12.5px] text-amber"><AlertTriangle className="mr-2 inline h-4 w-4" />{plan.clarification}</div>}
            <div className="flex flex-col gap-3 rounded-xl bg-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between"><div className="text-[12.5px]"><strong>Belum ada perubahan yang diterapkan.</strong><br />Tinjau dahulu di Jadwal Cerdas sebelum diterapkan.</div><Button onClick={saveCandidate} disabled={isPending || plan.result.candidates.length === 0}><CheckCircle2 className="mr-2 h-4 w-4" />Simpan rancangan</Button></div>
            {saved && <div className="text-[12.5px] text-emerald">{saved} Lanjutkan ke <strong>Jadwal Cerdas</strong> untuk meninjau dan menerapkan.</div>}
          </Card>}
        </>
      )}
    </div>
  );
}

// §04 Class Selection — kartu workspace, bukan form: tampilkan status JP sebelum dipilih.
function ClassCard({ status, onSelect }: { status: AiCopilotClassStatus; onSelect: () => void }) {
  const ok = status.remainingJp === 0;
  return <button type="button" onClick={onSelect} className="group flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-brand-600/30 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
    <span className="text-[14px] font-semibold text-ink-900 group-hover:text-brand-700">{status.label}</span>
    <span className="text-[11px] tabular-nums text-ink-500">{status.scheduledJp} / {status.targetJp} JP</span>
    <Badge tone={ok ? "success" : "warning"}>{ok ? "Sesuai" : `${status.remainingJp} JP kurang`}</Badge>
  </button>;
}
