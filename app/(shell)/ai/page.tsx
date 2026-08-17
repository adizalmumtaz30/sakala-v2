"use client";

import { useState, useTransition } from "react";
import { Sparkles, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import { planScheduleAction, saveAiCandidatesAction } from "./actions";
import Button from "@/components/ui/Button";
import { Card, Badge } from "@/components/ui/primitives";

type AiPlan = Extract<Awaited<ReturnType<typeof planScheduleAction>>, { ok: true }>["data"];

export default function AiPage() {
  const [command, setCommand] = useState("");
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="flex items-center gap-3"><Sparkles className="h-6 w-6" /><h1 className="text-2xl font-semibold">AI Penyusunan Jadwal</h1><Badge>Candidate-only</Badge></div>
        <p className="mt-2 text-sm opacity-70">Berikan perintah natural-language. AI mencari kombinasi slot yang memenuhi constraint, lalu menampilkan rancangan sebelum diterapkan.</p>
      </div>
      <Card className="space-y-4 p-5">
        <label className="block text-sm font-medium">Perintah</label>
        <textarea value={command} onChange={(e) => setCommand(e.target.value)} placeholder={'“Buatkan target 4 JP untuk Kelas 7.”'} rows={4} className="w-full rounded-xl border bg-transparent p-4 outline-none" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={runPlan} disabled={isPending || !command.trim()}>{isPending ? "Menganalisis…" : "Susun Rancangan"}</Button>
          <Button variant="secondary" onClick={() => { setCommand(""); setPlan(null); setError(null); setSaved(null); }} disabled={isPending}><RotateCcw className="mr-2 h-4 w-4" />Reset</Button>
        </div>
        {error && <div className="rounded-xl border border-red-500/30 p-4 text-sm"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div>}
      </Card>
      {plan && <Card className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Rancangan Candidate</h2><p className="mt-1 text-sm opacity-70">{plan.explanation}</p></div><Badge>{plan.result.candidates.length}/{plan.targetJp} JP</Badge></div>
        <div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Hari</th><th className="p-3">Jam</th><th className="p-3">Kelas</th><th className="p-3">Mapel</th><th className="p-3">Guru</th><th className="p-3">Status</th></tr></thead><tbody>
          {plan.result.candidates.map((c, i) => <tr key={`${c.requirementId}-${i}`} className="border-b last:border-0"><td className="p-3">{c.draft.day}</td><td className="p-3">JP {c.draft.periodStart}{c.draft.periodEnd !== c.draft.periodStart ? `–${c.draft.periodEnd}` : ""}</td><td className="p-3">{c.draft.classId}</td><td className="p-3">{c.draft.subjectId}</td><td className="p-3">{c.draft.teacherId}</td><td className="p-3"><Badge>candidate</Badge></td></tr>)}
        </tbody></table></div>
        {plan.needsClarification && <div className="rounded-xl border border-amber-500/30 p-4 text-sm"><AlertTriangle className="mr-2 inline h-4 w-4" />{plan.clarification}</div>}
        <div className="flex items-center justify-between gap-3 rounded-xl border p-4"><div className="text-sm"><strong>Belum diterapkan.</strong><br />Jadwal committed tidak diubah. Simpan sebagai candidate untuk masuk ke Candidate Review.</div><Button onClick={saveCandidate} disabled={isPending || plan.result.candidates.length === 0}><CheckCircle2 className="mr-2 h-4 w-4" />Simpan sebagai Candidate</Button></div>
        {saved && <div className="text-sm">{saved} Buka <strong>Jadwal Cerdas</strong> untuk meninjau, mengoptimasi, dan melakukan commit secara eksplisit.</div>}
      </Card>}
    </div>
  );
}
