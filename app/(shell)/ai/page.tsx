"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles, CheckCircle2, AlertTriangle, RotateCcw, Target, CalendarDays, WandSparkles, SlidersHorizontal } from "lucide-react";
import { getAiCopilotContextAction, planScheduleAction, runAiCopilotIntentAction, saveAiCandidatesAction, type AiCopilotContext, type AiCopilotIntent } from "./actions";
import Button from "@/components/ui/Button";
import { Card, Badge } from "@/components/ui/primitives";

type AiPlan = Extract<Awaited<ReturnType<typeof planScheduleAction>>, { ok: true }>["data"];

const quickActions: Array<{ intent: AiCopilotIntent; title: string; description: string; icon: typeof Target }> = [
  { intent: "complete_remaining_jp", title: "Selesaikan JP Kurang", description: "Cari kandidat untuk seluruh JP yang belum terpenuhi.", icon: Target },
  { intent: "schedule_full_week", title: "Susun Semua Mapel", description: "Buat Candidate Weekly Schedule dari target aktif.", icon: CalendarDays },
  { intent: "fill_empty_slots", title: "Isi Slot Kosong", description: "Manfaatkan slot valid yang masih tersedia.", icon: WandSparkles },
];

export default function AiPage() {
  const [context, setContext] = useState<AiCopilotContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [command, setCommand] = useState("");
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getAiCopilotContextAction();
      if (!result.ok) {
        setError(result.error);
        setContextLoading(false);
        return;
      }
      setContext(result.data);
      setSelectedClassId(result.data.activeClassId ?? result.data.classes[0]?.id ?? null);
      setContextLoading(false);
    });
  }, []);

  const selectedClass = context?.classes.find((c) => c.id === selectedClassId) ?? null;
  const hasClasses = Boolean(context?.classes.length);
  const canAct = !contextLoading && hasClasses && Boolean(selectedClassId) && !isPending;

  function runIntent(intent: AiCopilotIntent) {
    if (!selectedClassId) return;
    setError(null); setSaved(null); setPlan(null);
    startTransition(async () => {
      const result = await runAiCopilotIntentAction(intent, selectedClassId);
      if (!result.ok) { setError(result.error); return; }
      setPlan(result.data);
    });
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

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-10">
      <div>
        <div className="flex flex-wrap items-center gap-3"><Sparkles className="h-6 w-6 text-brand" /><h1 className="text-2xl font-semibold tracking-tight">SAKALA AI</h1><Badge>Schedule Copilot</Badge><Badge>Candidate-only</Badge></div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-500">AI membaca kondisi jadwal aktif, menyarankan tindakan, lalu menyerahkan pemilihan slot kepada constraint engine. Jadwal committed tidak pernah diubah oleh AI.</p>
      </div>

      <Card className="space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Konteks aktif</div>
            <div className="mt-1.5 text-lg font-semibold text-ink-900">
              {contextLoading ? "Menyiapkan konteks…" : selectedClass?.label ?? "Belum ada kelas aktif"}
            </div>
            <div className="mt-1 text-xs text-ink-500">
              {contextLoading ? "Memeriksa konteks akademik dan kelas yang tersedia." : hasClasses ? "Pilih kelas yang ingin dibantu SAKALA." : "Tambahkan kelas terlebih dahulu agar copilot dapat bekerja."}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <SlidersHorizontal className="h-4 w-4 text-ink-400" />
            <span className="sr-only">Pilih kelas</span>
            <select
              value={selectedClassId ?? ""}
              disabled={contextLoading || !hasClasses || isPending}
              onChange={(e) => { setSelectedClassId(e.target.value); setPlan(null); setError(null); }}
              className="h-10 min-w-44 rounded-xl border border-border bg-surface px-3 text-sm text-ink-700 outline-none transition focus:border-brand/50 focus:ring-2 focus:ring-brand/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Pilih kelas…</option>
              {context?.classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
        </div>

        {contextLoading ? (
          <div className="grid gap-3 sm:grid-cols-3" aria-live="polite" aria-label="Menyiapkan konteks AI">
            {["JP terpenuhi", "JP belum terpenuhi", "Mapel masih kurang"].map((label) => (
              <div key={label} className="rounded-xl bg-surface-muted p-4">
                <div className="text-xs text-ink-400">{label}</div>
                <div className="mt-3 h-7 w-16 animate-pulse rounded-md bg-border" />
              </div>
            ))}
          </div>
        ) : selectedClass ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-surface-muted p-4"><div className="text-xs text-ink-500">JP terpenuhi</div><div className="mt-1 text-2xl font-semibold">{selectedClass.scheduledJp}/{selectedClass.targetJp}</div></div>
            <div className="rounded-xl bg-surface-muted p-4"><div className="text-xs text-ink-500">JP belum terpenuhi</div><div className="mt-1 text-2xl font-semibold">{selectedClass.remainingJp}</div></div>
            <div className="rounded-xl bg-surface-muted p-4"><div className="text-xs text-ink-500">Mapel yang masih kurang</div><div className="mt-1 text-2xl font-semibold">{selectedClass.subjectDeficits.length}</div></div>
          </div>
        ) : null}

        <div>
          <div className="mb-3 text-sm font-semibold text-ink-900">✨ Apa yang bisa saya lakukan sekarang?</div>
          <div className="grid gap-3 md:grid-cols-3">
            {quickActions.map(({ intent, title, description, icon: Icon }) => (
              <button key={intent} type="button" onClick={() => runIntent(intent)} disabled={!canAct} className="group rounded-xl bg-surface-muted p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-brand-50 hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:bg-surface-muted">
                <Icon className="h-5 w-5 text-brand transition-transform group-hover:scale-105" />
                <div className="mt-3 font-semibold text-ink-900">{title}</div>
                <div className="mt-1 text-xs leading-5 text-ink-500">{description}</div>
              </button>
            ))}
          </div>
        </div>

        {selectedClass?.subjectDeficits.length ? <div className="rounded-xl bg-surface-muted p-4"><div className="mb-3 text-sm font-semibold">🎯 JP yang masih kurang</div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{selectedClass.subjectDeficits.slice(0, 9).map((item) => <div key={item.subjectId} className="rounded-lg bg-surface p-3"><div className="text-sm font-medium">{item.subjectName}</div><div className="mt-1 text-xs text-ink-500">Target {item.targetJp} JP · Terjadwal {item.scheduledJp} JP · <strong>Kurang {item.remainingJp} JP</strong></div></div>)}</div></div> : null}
      </Card>

      <Card className="space-y-4 p-6">
        <div><div className="text-sm font-semibold text-ink-900">💬 Atau katakan kebutuhanmu</div><div className="mt-1 text-xs leading-5 text-ink-500">Natural language tetap tersedia. Anda tidak perlu mengetahui struktur intent atau constraint engine.</div></div>
        <textarea value={command} onChange={(e) => setCommand(e.target.value)} placeholder={'Contoh: “Isi jadwal kelas 7 yang masih kosong.”\nAtau: “Susun semua mapel kelas 7 untuk satu minggu.”'} rows={4} className="w-full rounded-xl border border-border bg-surface-muted p-4 text-sm text-ink-900 outline-none transition focus:border-brand/50 focus:ring-2 focus:ring-brand/10" />
        <div className="flex flex-wrap gap-2"><Button onClick={runPlan} disabled={isPending || !command.trim()}>{isPending ? "Menganalisis…" : "Susun Candidate"}</Button><Button variant="secondary" onClick={reset} disabled={isPending}><RotateCcw className="mr-2 h-4 w-4" />Reset</Button></div>
        {error && <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div>}
      </Card>

      {plan && <Card className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="text-lg font-semibold">Rancangan Candidate</h2><Badge>{plan.intent === "schedule_full_week" ? "Weekly Planner" : "Target JP"}</Badge></div><p className="mt-1 max-w-4xl text-sm leading-6 text-ink-500">{plan.explanation}</p></div><Badge>{plan.result.candidates.length}/{plan.targetJp} JP</Badge></div>
        {plan.interpretedTargets?.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{plan.interpretedTargets.map((item) => <div key={item.subjectId} className="rounded-lg bg-surface-muted p-3 text-sm"><strong>{item.subjectName}</strong><div className="mt-1 text-xs text-ink-500">Target {item.targetJp} · Terwakili {item.existingJp} · Sisa {item.remainingJp}</div></div>)}</div> : null}
        <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="p-3">Hari</th><th className="p-3">Jam</th><th className="p-3">Kelas</th><th className="p-3">Mapel</th><th className="p-3">Guru</th><th className="p-3">Status</th></tr></thead><tbody>{plan.result.candidates.map((c, i) => <tr key={`${c.requirementId}-${i}`} className="border-b border-border last:border-0"><td className="p-3">{c.draft.day}</td><td className="p-3">JP {c.draft.periodStart}{c.draft.periodEnd !== c.draft.periodStart ? `–${c.draft.periodEnd}` : ""}</td><td className="p-3">{c.draft.classId}</td><td className="p-3">{c.draft.subjectId}</td><td className="p-3">{c.draft.teacherId}</td><td className="p-3"><Badge>candidate</Badge></td></tr>)}</tbody></table></div>
        {plan.needsClarification && <div className="rounded-xl border border-amber/30 bg-amber-50 p-4 text-sm text-amber"><AlertTriangle className="mr-2 inline h-4 w-4" />{plan.clarification}</div>}
        <div className="flex flex-col gap-3 rounded-xl bg-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between"><div className="text-sm"><strong>Problem → Solution → Review</strong><br />Candidate belum mengubah jadwal committed. Tinjau dahulu di Jadwal Cerdas sebelum commit.</div><Button onClick={saveCandidate} disabled={isPending || plan.result.candidates.length === 0}><CheckCircle2 className="mr-2 h-4 w-4" />Simpan sebagai Candidate</Button></div>
        {saved && <div className="text-sm text-emerald">{saved} Lanjutkan ke <strong>Jadwal Cerdas</strong> untuk review dan commit eksplisit.</div>}
      </Card>}
    </div>
  );
}
