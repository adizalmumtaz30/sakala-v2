"use client";

// Implementasi §08-25 kontrak UI/UX SAKALA AI: alur Recommendation→Action.
//
//   Yang Saya Temukan → Rekomendasi → Lihat solusi (Solution Drawer) →
//   Tinjau perubahan (Preview) → Terapkan → Verifikasi → cari masalah berikutnya
//
// Catatan jujur soal batas arsitektur yang ADA (tidak diubah oleh komponen ini):
// "Terapkan" di sini menyimpan hasil sebagai *candidate* — bukan langsung
// mengubah jadwal committed. Itu sudah benar sesuai §01 (SAKALA AI TIDAK BOLEH
// mengubah data diam-diam) dan arsitektur repo yang sudah ada (Jadwal Cerdas
// adalah tempat commit eksplisit). Maka "Verifikasi" di sini menampilkan apa
// yang BENAR-BENAR terjadi (candidate tersimpan), bukan JP kelas yang sudah
// ter-update — supaya tidak menampilkan kepastian yang belum terjadi (§36).
//
// Risiko tindakan (§19): menyimpan candidate adalah risiko rendah (tidak
// menyentuh jadwal committed), jadi alurnya langsung Tinjau → Terapkan tanpa
// konfirmasi tambahan.

import { useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, CheckCircle2, Circle, X, Lightbulb, HelpCircle, Target, BookOpen, CalendarDays, GraduationCap } from "lucide-react";
import { runAiCopilotIntentAction, planScheduleAction, saveAiCandidatesAction, type AiCopilotClassStatus, type AiCopilotIntent } from "@/app/(shell)/ai/actions";
import type { AiSchedulePlan } from "@/lib/application/aiSchedulePlanner";
import Button from "@/components/ui/Button";
import { Card, Badge } from "@/components/ui/primitives";

type FlowStep = "finding" | "solution" | "preview" | "done";

// §26 Cross-Feature Action — arahkan ke fitur yang tepat, jangan menirunya di sini.
const CROSS_FEATURE_LINKS = [
  { href: "/akademik/target-jp", label: "Atur Target JP", icon: Target },
  { href: "/mata-pelajaran", label: "Kelola Mata Pelajaran", icon: BookOpen },
  { href: "/jadwal", label: "Atur Jadwal", icon: CalendarDays },
  { href: "/akademik/generate-kurikulum", label: "Buka Generate Kurikulum", icon: GraduationCap },
] as const;

function CrossFeatureLinks() {
  return <div className="flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
    {CROSS_FEATURE_LINKS.map((l) => <Link key={l.href} href={l.href} className="flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[10.5px] font-medium text-ink-500 hover:border-brand-600/25 hover:text-brand-700"><l.icon size={11} />{l.label}</Link>)}
  </div>;
}

const INTENT_LABEL: Record<AiCopilotIntent, string> = {
  complete_remaining_jp: "Lengkapi JP yang kurang",
  schedule_full_week: "Susun semua mapel",
  fill_empty_slots: "Isi slot kosong",
  schedule_one_subject: "Susun satu mapel",
};

export default function RecommendationFlow({
  classStatus,
  subjectNames,
  teacherNames,
  onCandidatesSaved,
}: {
  classStatus: AiCopilotClassStatus;
  subjectNames: Record<string, string>;
  teacherNames: Record<string, string>;
  onCandidatesSaved: () => void;
}) {
  const [step, setStep] = useState<FlowStep>("finding");
  const [intent, setIntent] = useState<AiCopilotIntent>("complete_remaining_jp");
  const [primaryPlan, setPrimaryPlan] = useState<AiSchedulePlan | null>(null);
  const [altPlan, setAltPlan] = useState<AiSchedulePlan | null>(null);
  const [altFocusSubject, setAltFocusSubject] = useState<string | null>(null);
  const [variant, setVariant] = useState<"primary" | "alt">("primary");
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [whyOpen, setWhyOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const plan = variant === "alt" && altPlan ? altPlan : primaryPlan;

  const deficits = classStatus.subjectDeficits;
  if (deficits.length === 0) return null; // tidak ada temuan untuk kelas ini — komponen tidak render apa pun.

  const totalKurang = deficits.reduce((s: number, d: { remainingJp: number }) => s + d.remainingJp, 0);
  const topDeficit = deficits[0];

  function lihatSolusi(chosenIntent: AiCopilotIntent) {
    setError(null);
    setIntent(chosenIntent);
    setWhyOpen(false);
    setVariant("primary");
    setAltPlan(null);
    startTransition(async () => {
      // §23 Alternative Solutions — alternatif harus BENAR-BENAR berbeda hasilnya,
      // bukan cuma judul tombol berbeda dengan hasil identik (itu pilihan palsu,
      // melanggar §36). Untuk 'lengkapi JP kurang' dengan >1 mapel kurang, alternatif
      // yang jujur adalah: fokus mapel dengan kekurangan terbesar dulu, secara
      // bertahap — bukan intent lain yang ternyata dipetakan ke planner yang sama.
      const topAlt = deficits.length > 1 ? deficits.reduce((max, d) => (d.remainingJp > max.remainingJp ? d : max), deficits[0]) : null;
      const [primaryResult, altResult] = await Promise.all([
        runAiCopilotIntentAction(chosenIntent, classStatus.id),
        chosenIntent === "complete_remaining_jp" && topAlt
          ? planScheduleAction(`Lengkapi ${topAlt.subjectName} kelas ${classStatus.label}.`)
          : Promise.resolve(null),
      ]);
      if (!primaryResult.ok) { setError(primaryResult.error); return; }
      setPrimaryPlan(primaryResult.data);
      if (altResult?.ok && altResult.data.result.candidates.length > 0) { setAltPlan(altResult.data); setAltFocusSubject(topAlt?.subjectName ?? null); }
      setStep("solution");
    });
  }

  function terapkan() {
    if (!plan) return;
    setError(null);
    startTransition(async () => {
      const result = await saveAiCandidatesAction(plan.result.candidates.map((c) => c.draft));
      if (!result.ok) { setError(result.error); return; }
      setSavedCount(result.data.savedCount);
      setSkippedCount(result.data.skippedCount);
      setStep("done");
      onCandidatesSaved();
    });
  }

  function batal() {
    setStep("finding");
    setPrimaryPlan(null);
    setAltPlan(null);
    setAltFocusSubject(null);
    setVariant("primary");
    setError(null);
  }

  // ── §08 Yang Saya Temukan + §09 Rekomendasi + §10 Langkah Berikutnya ──
  if (step === "finding") {
    return <Card className="space-y-4 border-brand-600/15 bg-gradient-to-br from-brand-50/40 to-transparent">
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[.1em] text-brand-600">Yang saya temukan</p>
          <p className="mt-1 text-[14px] font-semibold leading-5 text-ink-900">{totalKurang} JP belum terpenuhi</p>
          <p className="mt-1 text-[12px] leading-5 text-ink-500">
            Kelas {classStatus.label} baru memiliki {classStatus.scheduledJp} dari {classStatus.targetJp} JP.
            {topDeficit && ` ${topDeficit.subjectName} kekurangan ${topDeficit.remainingJp} JP` }
            {deficits.length > 1 && `, dan ${deficits.length - 1} mapel lain juga masih kurang.`}
            {deficits.length === 1 && "."}
          </p>
        </div>
      </div>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11.5px] text-rose">{error}</p>}
      <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
        <Button onClick={() => lihatSolusi("complete_remaining_jp")} disabled={isPending} loading={isPending}>{isPending ? "Memeriksa solusi…" : "Lihat solusi"}</Button>
        <Button variant="secondary" onClick={() => lihatSolusi("fill_empty_slots")} disabled={isPending}>Isi slot kosong</Button>
        <Button variant="secondary" onClick={() => lihatSolusi("schedule_full_week")} disabled={isPending}>Susun semua mapel</Button>
      </div>
      <CrossFeatureLinks />
    </Card>;
  }

  // ── §15 Solution Drawer ──
  if (step === "solution" && plan) {
    const targets = plan.interpretedTargets ?? [];
    return <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.1em] text-brand-600">Solusi</p>
          <p className="mt-1 text-[14px] font-semibold text-ink-900">{INTENT_LABEL[intent]}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setWhyOpen((v) => !v)} aria-expanded={whyOpen} className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${whyOpen ? "border-brand-600/40 bg-brand-50 text-brand-700" : "border-border text-ink-500 hover:border-brand-600/25 hover:text-brand-700"}`}><HelpCircle size={11} />Mengapa?</button>
          <button type="button" onClick={batal} aria-label="Batal" className="rounded-full p-1 text-ink-400 hover:bg-surface-muted hover:text-ink-700"><X size={16} /></button>
        </div>
      </div>
      {/* §30 Trust — dasar rekomendasi, data nyata dari sumber yang sama dengan Top Summary. */}
      {whyOpen && <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-muted p-3 text-[11px] sm:grid-cols-4">
        <div><p className="text-ink-400">Target JP</p><p className="mt-0.5 font-semibold tabular-nums text-ink-800">{classStatus.targetJp}</p></div>
        <div><p className="text-ink-400">JP saat ini</p><p className="mt-0.5 font-semibold tabular-nums text-ink-800">{classStatus.scheduledJp}</p></div>
        <div><p className="text-ink-400">Slot ditemukan</p><p className="mt-0.5 font-semibold tabular-nums text-ink-800">{plan.result.candidates.length}</p></div>
        <div><p className="text-ink-400">Mapel terkait</p><p className="mt-0.5 font-semibold tabular-nums text-ink-800">{targets.length || deficits.length}</p></div>
        <p className="col-span-2 mt-1 text-ink-400 sm:col-span-4">Data diperiksa: Target JP · Mata Pelajaran · Pembagian Mengajar · Jadwal committed.</p>
      </div>}

      {/* §23 Alternative Solutions — dua strategi yang genuinely berbeda hasilnya: semua sekaligus vs bertahap. */}
      {altPlan && <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => setVariant("primary")} className={`rounded-xl border p-3 text-left transition-colors ${variant === "primary" ? "border-brand-600/40 bg-brand-50" : "border-border bg-surface hover:border-brand-600/20"}`}>
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand-600">★ Disarankan</p>
          <p className="mt-1 text-[12px] font-semibold text-ink-900">Lengkapi semua mapel yang kurang</p>
          <p className="mt-0.5 text-[11px] text-ink-500">{primaryPlan?.result.candidates.length ?? 0} slot · {deficits.length} mapel sekaligus</p>
        </button>
        <button type="button" onClick={() => setVariant("alt")} className={`rounded-xl border p-3 text-left transition-colors ${variant === "alt" ? "border-brand-600/40 bg-brand-50" : "border-border bg-surface hover:border-brand-600/20"}`}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Alternatif</p>
          <p className="mt-1 text-[12px] font-semibold text-ink-900">Fokus {altFocusSubject} dulu</p>
          <p className="mt-0.5 text-[11px] text-ink-500">{altPlan.result.candidates.length} slot · bertahap, sisanya menyusul lain kali</p>
        </button>
      </div>}
      <p className="text-[12px] leading-5 text-ink-500">{plan.explanation}</p>

      {targets.length > 0 && <div className="space-y-1.5 border-t border-border/60 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-[.1em] text-ink-400">✦ Disarankan</p>
        {targets.map((t) => <div key={t.subjectId} className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2">
          <span className="text-[12.5px] font-medium text-ink-800">{t.subjectName}</span>
          <span className="text-[12px] font-semibold tabular-nums text-brand-700">+{t.remainingJp} JP</span>
        </div>)}
      </div>}

      <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 text-[12.5px]">
        <span className="text-ink-500">{classStatus.scheduledJp} JP</span>
        <ArrowRight size={13} className="text-ink-300" />
        <span className="font-semibold text-ink-900">{classStatus.scheduledJp + plan.result.candidates.length} JP</span>
      </div>

      {plan.result.candidates.length === 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber">Belum ada slot valid yang ditemukan untuk solusi ini. Coba pilihan lain, atau atur jadwal secara manual.</p>}
      {plan.needsClarification && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber">{plan.clarification}</p>}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11.5px] text-rose">{error}</p>}

      <div className="flex gap-2 border-t border-border/60 pt-3">
        <Button onClick={() => setStep("preview")} disabled={plan.result.candidates.length === 0}>Tinjau perubahan</Button>
        <Button variant="secondary" onClick={batal}>Batal</Button>
      </div>
    </Card>;
  }

  // ── §17 Preview Perubahan + §18 Approval ──
  if (step === "preview" && plan) {
    return <Card className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.1em] text-brand-600">Perubahan</p>
        <p className="mt-1 text-[14px] font-semibold text-ink-900">{plan.result.candidates.length} perubahan</p>
      </div>

      <div className="max-h-64 space-y-1.5 overflow-y-auto border-t border-border/60 pt-3">
        {plan.result.candidates.map((c, i) => <div key={`${c.requirementId}-${i}`} className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2 text-[12px]">
          <span className="min-w-0 truncate font-medium text-ink-800">{subjectNames[c.draft.subjectId] ?? c.draft.subjectId}</span>
          <span className="shrink-0 text-ink-400">{c.draft.day} · JP {c.draft.periodStart}{c.draft.periodEnd !== c.draft.periodStart ? `–${c.draft.periodEnd}` : ""}</span>
          <span className="shrink-0 truncate text-ink-500">{teacherNames[c.draft.teacherId] ?? c.draft.teacherId}</span>
        </div>)}
      </div>

      <div className="flex items-center justify-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px]">
        <span className="text-ink-500">{classStatus.scheduledJp} / {classStatus.targetJp} JP</span>
        <ArrowRight size={13} className="text-ink-300" />
        <span className="font-semibold text-ink-900">{classStatus.scheduledJp + plan.result.candidates.length} / {classStatus.targetJp} JP{classStatus.scheduledJp + plan.result.candidates.length >= classStatus.targetJp ? " ✓" : ""}</span>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11.5px] text-rose">{error}</p>}

      <p className="text-[11px] leading-5 text-ink-400">Belum ada perubahan yang diterapkan. Menekan tombol di bawah akan menyimpan sebagai <em>candidate</em> — jadwal committed baru berubah setelah ditinjau dan diterapkan eksplisit di Jadwal Cerdas.</p>

      <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
        <Button onClick={terapkan} disabled={isPending} loading={isPending}><CheckCircle2 className="mr-1.5 h-4 w-4" />{isPending ? "Menerapkan…" : `Terapkan ${plan.result.candidates.length} perubahan`}</Button>
        <Button variant="secondary" onClick={() => setStep("solution")} disabled={isPending}>Kembali</Button>
        <Button variant="ghost" onClick={batal} disabled={isPending}>Batal</Button>
      </div>
    </Card>;
  }

  // ── §20 Execution + §21 Verifikasi + §22 AI tidak berhenti setelah action ──
  if (step === "done") {
    const sisaDeficit = deficits.filter((d: { subjectId: string }) => !plan?.interpretedTargets?.some((t) => t.subjectId === d.subjectId));
    return <Card className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-emerald"><CheckCircle2 size={16} /><p className="text-[13.5px] font-semibold">Sudah diperbarui</p></div>
        <ExecutionRow label="Candidate jadwal disimpan" done />
        <ExecutionRow label="Jadwal committed diperbarui" done={false} note="menunggu ditinjau di Jadwal Cerdas" />
      </div>

      <div className="rounded-lg bg-surface-muted p-3 text-[12.5px] text-ink-700">
        <strong>{savedCount}</strong> candidate tersimpan{skippedCount > 0 && <span className="text-amber"> · {skippedCount} dilewati karena conflict</span>}.
        Lanjutkan ke <Link href="/jadwal-cerdas" className="font-semibold text-brand-600 hover:underline">Jadwal Cerdas</Link> untuk meninjau dan menerapkan ke jadwal resmi.
      </div>

      {sisaDeficit.length > 0 ? <div className="flex items-start gap-2.5 border-t border-border/60 pt-3">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-ink-900">Saya menemukan {sisaDeficit.length} hal lagi</p>
          <p className="mt-0.5 text-[11.5px] leading-5 text-ink-500">{sisaDeficit[0].subjectName} masih kekurangan {sisaDeficit[0].remainingJp} JP.</p>
          <Button size="sm" className="mt-2" onClick={() => { setStep("finding"); setPrimaryPlan(null); setAltPlan(null); setVariant("primary"); setSavedCount(null); }}>Lihat solusi</Button>
        </div>
      </div> : <p className="border-t border-border/60 pt-3 text-[12px] text-ink-500">Tidak ada masalah JP lain yang saya temukan untuk kelas ini saat ini.</p>}
    </Card>;
  }

  return null;
}

function ExecutionRow({ label, done, note }: { label: string; done: boolean; note?: string }) {
  return <div className="flex items-center gap-2 text-[12px]">
    {done ? <CheckCircle2 size={14} className="shrink-0 text-emerald" /> : <Circle size={14} className="shrink-0 text-ink-300" />}
    <span className={done ? "text-ink-700" : "text-ink-400"}>{label}</span>
    {note && <span className="text-ink-300">— {note}</span>}
  </div>;
}
