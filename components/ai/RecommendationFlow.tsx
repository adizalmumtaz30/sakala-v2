"use client";

// Implementasi §08-25 kontrak UI/UX SAKALA AI: alur Recommendation→Action.
//
//   Temuan → Solusi → Preview → Diterapkan
//
// DESAIN — "Thread" (identitas visual SAKALA AI, lihat app/theme.css):
// Bukan tumpukan Card yang saling menggantikan (terasa seperti form berurutan).
// Empat tahap dirender SEKALIGUS sebagai satu utas vertikal violet — operator
// selalu melihat seluruh perjalanan: tahap yang sudah lewat menciut jadi
// ringkasan satu baris, tahap aktif terbuka penuh, tahap berikutnya terlihat
// redup sebagai peta jalan. Ini bukan dekorasi — ini merender literal state
// machine (`step`) yang memang sudah linear di kode, sesuai §11.
// Violet = "suara AI" (dipakai app untuk fitur cerdas/generate lain, cth.
// Generate Kurikulum) — dibedakan dari biru (brand) yang dipakai navigasi biasa.
//
// Catatan jujur soal batas arsitektur yang ADA (tidak diubah oleh komponen ini):
// "Terapkan" di sini menyimpan hasil sebagai *candidate* — bukan langsung
// mengubah jadwal committed. Itu sudah benar sesuai §01 (SAKALA AI TIDAK BOLEH
// mengubah data diam-diam) dan arsitektur repo yang sudah ada (Jadwal Cerdas
// adalah tempat commit eksplisit). Maka "Diterapkan" di sini menampilkan apa
// yang BENAR-BENAR terjadi (candidate tersimpan), bukan JP kelas yang sudah
// ter-update — supaya tidak menampilkan kepastian yang belum terjadi (§36).
//
// Risiko tindakan (§19): menyimpan candidate adalah risiko rendah (tidak
// menyentuh jadwal committed), jadi alurnya langsung Tinjau → Terapkan tanpa
// konfirmasi tambahan.

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { runAiCopilotIntentAction, planScheduleAction, saveAiCandidatesAction, rollbackAiCandidatesAction, kurangiJpAction, tetapkanGuruAction, type AiCopilotClassStatus, type AiCopilotIntent } from "@/app/(shell)/ai/actions";
import type { AiSchedulePlan } from "@/lib/application/aiSchedulePlanner";
import Button from "@/components/ui/Button";
import { Sparkles, ArrowRight, CheckCircle2, Circle, X, Lightbulb, HelpCircle, Target, BookOpen, CalendarDays, GraduationCap, Pencil, AlertTriangle } from "lucide-react";

type FlowStep = "finding" | "solution" | "preview" | "done";
const STAGE_ORDER: FlowStep[] = ["finding", "solution", "preview", "done"];
const STAGE_TITLE: Record<FlowStep, string> = { finding: "Temuan", solution: "Solusi", preview: "Preview", done: "Diterapkan" };

const INTENT_LABEL: Record<AiCopilotIntent, string> = {
  complete_remaining_jp: "Lengkapi JP yang kurang",
  schedule_full_week: "Susun semua mapel",
  fill_empty_slots: "Isi slot kosong",
  schedule_one_subject: "Susun satu mapel",
};

// §26 Cross-Feature Action — arahkan ke fitur yang tepat, jangan menirunya di sini.
const CROSS_FEATURE_LINKS = [
  { href: "/akademik/target-jp", label: "Atur Target JP", icon: Target },
  { href: "/mata-pelajaran", label: "Kelola Mata Pelajaran", icon: BookOpen },
  { href: "/jadwal", label: "Atur Jadwal", icon: CalendarDays },
  { href: "/akademik/generate-kurikulum", label: "Buka Generate Kurikulum", icon: GraduationCap },
] as const;

function CrossFeatureLinks() {
  return <div className="flex flex-wrap gap-1.5 pt-1">
    {CROSS_FEATURE_LINKS.map((l) => <Link key={l.href} href={l.href} className="flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[10.5px] font-medium text-ink-500 hover:border-violet/30 hover:text-violet"><l.icon size={11} />{l.label}</Link>)}
  </div>;
}

/** Satu tahap di utas SAKALA AI: dot + garis penghubung + konten (penuh/ringkas/redup). */
function Stage({ status, title, isLast, onReopen, children }: { status: "done" | "active" | "upcoming"; title: string; isLast: boolean; onReopen?: () => void; children: ReactNode }) {
  return <div className="relative flex gap-3.5">
    <div className="flex shrink-0 flex-col items-center">
      <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ${status === "done" ? "bg-violet text-white" : status === "active" ? "sakala-thread-dot--active border-2 border-violet bg-surface" : "border border-border bg-surface"}`}>
        {status === "done" ? <CheckCircle2 size={12} /> : status === "active" ? <span className="h-1.5 w-1.5 rounded-full bg-violet" /> : <Circle size={7} className="text-ink-300" />}
      </span>
      {!isLast && <span className={`w-px flex-1 ${status === "done" ? "bg-violet/30" : "bg-border"}`} style={{ minHeight: 16 }} />}
    </div>
    <div className={`min-w-0 flex-1 ${status === "upcoming" ? "pb-4" : "pb-5"}`}>
      {status === "active" ? (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-violet">{title}</p>
      ) : status === "done" ? (
        <button type="button" onClick={onReopen} disabled={!onReopen} className={`group mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-ink-400 ${onReopen ? "hover:text-violet" : ""}`}>
          {title}{onReopen && <Pencil size={9} className="opacity-0 transition-opacity group-hover:opacity-100" />}
        </button>
      ) : (
        <p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink-300">{title}</p>
      )}
      {children}
    </div>
  </div>;
}

function ExcessAlert({ excess, onKurangi, isPending, pendingId, error }: {
  excess: AiCopilotClassStatus["subjectExcess"];
  onKurangi: (assignmentId: string) => void;
  isPending: boolean;
  pendingId: string | null;
  error: string | null;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  if (excess.length === 0) return null;
  const top = excess[0];
  return <div className="sakala-stage-enter space-y-3 rounded-xl border border-amber/25 bg-amber-50/60 p-4">
    <div className="flex items-start gap-2.5">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold leading-5 text-ink-900"><span className="tabular-nums">{excess.reduce((s, e) => s + e.excessJp, 0)}</span> JP kelebihan dari target</p>
        <p className="mt-1 text-[12px] leading-5 text-ink-500">
          {top.subjectName} terjadwal {top.scheduledJp} JP, padahal target hanya {top.targetJp} JP.
          {excess.length > 1 && ` ${excess.length - 1} mapel lain juga kelebihan — buka Jadwal untuk detail lengkap.`}
        </p>
      </div>
    </div>
    <div className="space-y-1.5">
      {top.schedules.map((s) => {
        const isConfirming = confirmId === s.id;
        return <div key={s.id} className="rounded-lg bg-surface px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-medium text-ink-800">{s.day.charAt(0).toUpperCase() + s.day.slice(1)} · JP {s.periodStart}{s.periodEnd !== s.periodStart ? `–${s.periodEnd}` : ""}</span>
            {!isConfirming && <button type="button" onClick={() => setConfirmId(s.id)} disabled={isPending} className="text-[11px] font-semibold text-amber hover:underline disabled:opacity-50">Kurangi</button>}
          </div>
          {/* §19 Risiko sedang — tampilkan dampak sebelum tindakan, bukan hapus sekali klik. */}
          {isConfirming && <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-2.5 py-2">
            <span className="text-[11px] text-ink-600">Slot ini akan dikosongkan dari jadwal.</span>
            <span className="flex shrink-0 gap-2">
              <button type="button" onClick={() => setConfirmId(null)} disabled={isPending} className="text-[11px] font-medium text-ink-500 hover:text-ink-700">Batal</button>
              <button type="button" onClick={() => onKurangi(s.id)} disabled={isPending} className="text-[11px] font-semibold text-rose hover:underline disabled:opacity-50">{isPending && pendingId === s.id ? "Mengurangi…" : "Ya, kurangi"}</button>
            </span>
          </div>}
        </div>;
      })}
    </div>
    {error && <p className="text-[11.5px] text-rose">{error}</p>}
  </div>;
}

function MissingTeacherAlert({ subjects, onTetapkan, isPending, pendingKey, error }: {
  subjects: AiCopilotClassStatus["subjectDeficits"];
  onTetapkan: (subjectId: string, guruId: string, jpPerMinggu: number) => void;
  isPending: boolean;
  pendingKey: string | null;
  error: string | null;
}) {
  const top = subjects[0];
  return <div className="sakala-stage-enter space-y-3 rounded-xl border border-border bg-surface-muted/60 p-4">
    <div className="flex items-start gap-2.5">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold leading-5 text-ink-900"><span className="tabular-nums">{subjects.reduce((s, d) => s + d.belumSiapJp, 0)}</span> JP belum ada guru</p>
        <p className="mt-1 text-[12px] leading-5 text-ink-500">
          {top.subjectName} butuh {top.belumSiapJp} JP guru — belum ada Pembagian Mengajar untuk mapel ini di kelas ini.
          {subjects.length > 1 && ` ${subjects.length - 1} mapel lain juga belum ada guru.`}
          {" "}Ini tidak bisa dijadwalkan sampai gurunya ditentukan lebih dulu.
        </p>
      </div>
    </div>
    {/* AI mengusulkan guru yang SUDAH mengajar mapel ini di kelas lain — bukan
        tebakan buta. Kalau tidak ada satu pun, jujur bilang begitu, bukan
        mengarang usulan (§36). Operator tetap yang menyetujui secara eksplisit. */}
    {top.suggestedTeachers.length > 0 ? <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-[.1em] text-ink-400">Usulan — sudah mengajar {top.subjectName} di kelas lain</p>
      {top.suggestedTeachers.map((t) => {
        const key = `${top.subjectId}:${t.id}`;
        return <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2">
          <span className="text-[12px] font-medium text-ink-800">{t.name}</span>
          <button type="button" onClick={() => onTetapkan(top.subjectId, t.id, top.belumSiapJp)} disabled={isPending} className="text-[11px] font-semibold text-violet hover:underline disabled:opacity-50">{isPending && pendingKey === key ? "Menetapkan…" : `Tetapkan ${top.belumSiapJp} JP`}</button>
        </div>;
      })}
    </div> : <p className="text-[11.5px] text-ink-500">Belum ada guru lain yang mengajar {top.subjectName} untuk diusulkan.</p>}
    {error && <p className="text-[11.5px] text-rose">{error}</p>}
    <Link href="/pembagian-mengajar" className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-violet hover:underline">Atau pilih guru manual di Pembagian Mengajar →</Link>
  </div>;
}

export default function RecommendationFlow({
  classStatus,
  subjectNames,
  teacherNames,
  onCandidatesSaved,
}: {
  classStatus: AiCopilotClassStatus;
  subjectNames: Record<string, string>;
  teacherNames: Record<string, string>;
  onCandidatesSaved: () => Promise<void>;
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
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [rolledBack, setRolledBack] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [kurangiPendingId, setKurangiPendingId] = useState<string | null>(null);
  const [kurangiError, setKurangiError] = useState<string | null>(null);
  const [tetapkanPending, setTetapkanPending] = useState<string | null>(null);
  const [tetapkanError, setTetapkanError] = useState<string | null>(null);
  // §16/§38-39 Fase 3 — multi-select approval: operator boleh pilih sebagian
  // perubahan, bukan cuma semua-atau-tidak. Key = `${requirementId}-${index}`
  // (requirementId bisa berulang kalau 1 requirement butuh >1 slot).
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  function candidateKey(c: { requirementId: string }, i: number) {
    return `${c.requirementId}-${i}`;
  }

  function tetapkanGuru(subjectId: string, guruId: string, jpPerMinggu: number) {
    const key = `${subjectId}:${guruId}`;
    setTetapkanError(null);
    setTetapkanPending(key);
    startTransition(async () => {
      const result = await tetapkanGuruAction(classStatus.id, subjectId, guruId, jpPerMinggu);
      if (!result.ok) { setTetapkanPending(null); setTetapkanError(result.error); return; }
      await onCandidatesSaved(); // Read-Back — tunggu data resmi terbaca ulang sebelum melepas status pending.
      setTetapkanPending(null);
    });
  }

  function kurangi(assignmentId: string) {
    setKurangiError(null);
    setKurangiPendingId(assignmentId);
    startTransition(async () => {
      const result = await kurangiJpAction(assignmentId);
      if (!result.ok) { setKurangiPendingId(null); setKurangiError(result.error); return; }
      await onCandidatesSaved();
      setKurangiPendingId(null);
    });
  }

  const plan = variant === "alt" && altPlan ? altPlan : primaryPlan;
  const deficits = classStatus.subjectDeficits;
  const excess = classStatus.subjectExcess;

  // §39 Success State — konfirmasi positif dengan data yang benar-benar ada
  // (targetJp/scheduledJp), TIDAK menambah metrik seperti 'slot terisi' atau
  // 'bentrok' karena classStatus tidak menyediakan data itu (§36: jangan mengarang).
  // §14/§19 — kalau ada kelebihan JP, itu bukan 'sudah sesuai' — tampilkan
  // ExcessAlert dengan tindakan 'Kurangi', bukan Success State yang membohongi.
  if (deficits.length === 0) {
    if (excess.length > 0) return <ExcessAlert excess={excess} onKurangi={kurangi} isPending={isPending} pendingId={kurangiPendingId} error={kurangiError} />;
    return <div className="sakala-stage-enter space-y-3">
      <div className="flex items-center gap-2 text-emerald"><CheckCircle2 size={16} /><p className="text-[13.5px] font-semibold">Sudah sesuai</p></div>
      <p className="text-[12px] leading-5 text-ink-500">Kelas {classStatus.label} sudah memiliki {classStatus.scheduledJp} dari {classStatus.targetJp} JP. Tidak ada masalah JP yang saya temukan untuk kelas ini saat ini.</p>
      <CrossFeatureLinks />
    </div>;
  }

  const totalKurang = deficits.reduce((s: number, d: { belumTerjadwalJp: number }) => s + d.belumTerjadwalJp, 0);
  // §14 Fase 1/2 — Belum Siap (belum ada guru) dan Belum Terjadwal (sudah ada
  // guru, tinggal dicari slot) BUKAN masalah yang sama dan BUKAN solusi yang
  // sama. Planner (lihatSolusi) hanya bisa menjadwalkan yang sudah ada guru —
  // memaksa tampil sebagai satu angka gabungan akan membuat "Solusi" diam-diam
  // tidak pernah mencapai jumlah yang dijanjikan "Temuan", tanpa penjelasan.
  const missingTeacher = deficits.filter((d) => d.belumSiapJp > 0);
  const readyToSchedule = deficits.filter((d) => d.belumTerjadwalJp > 0);
  const topDeficit = readyToSchedule[0];

  // Kalau SEMUA kekurangan cuma soal guru belum ditentukan, planner tidak bisa
  // berbuat apa-apa — jangan tampilkan thread Temuan->Solusi->Preview->Diterapkan
  // yang kosong/tidak relevan. Cukup alert Tetapkan Guru (dan Excess kalau ada).
  if (readyToSchedule.length === 0) {
    return <div className="space-y-4">
      {missingTeacher.length > 0 && <MissingTeacherAlert subjects={missingTeacher} onTetapkan={tetapkanGuru} isPending={tetapkanPending !== null} pendingKey={tetapkanPending} error={tetapkanError} />}
      {excess.length > 0 && <ExcessAlert excess={excess} onKurangi={kurangi} isPending={isPending} pendingId={kurangiPendingId} error={kurangiError} />}
    </div>;
  }

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
      const topAlt = readyToSchedule.length > 1 ? readyToSchedule.reduce((max, d) => (d.belumTerjadwalJp > max.belumTerjadwalJp ? d : max), readyToSchedule[0]) : null;
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
    const selected = plan.result.candidates.filter((c, i) => selectedKeys.has(candidateKey(c, i)));
    if (selected.length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await saveAiCandidatesAction(selected.map((c) => c.draft));
      if (!result.ok) { setError(result.error); return; }
      // §60-63 Read-Back — tunggu data resmi terbaca ulang SEBELUM pindah ke
      // step "done", supaya "Sudah diperbarui" bukan klaim dari respons tulis
      // semata (insert sudah aman lewat .select().single(), tapi tetap
      // dikonfirmasi ulang lewat context, konsisten dengan pola yang sama
      // dipakai kurangi()/tetapkanGuru()).
      await onCandidatesSaved();
      setSavedCount(result.data.savedCount);
      setSkippedCount(result.data.skippedCount);
      setSavedIds(result.data.savedIds);
      setRolledBack(false);
      setStep("done");
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

  // §25 Rollback — hapus candidate yang barusan disimpan. Risiko rendah (belum
  // menyentuh jadwal committed), jadi langsung tanpa konfirmasi tambahan.
  function kembalikan() {
    if (savedIds.length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await rollbackAiCandidatesAction(savedIds);
      if (!result.ok) { setError(result.error); return; }
      await onCandidatesSaved(); // Read-Back — konsisten dengan terapkan()/kurangi()/tetapkanGuru().
      setRolledBack(true);
      setSavedIds([]);
    });
  }

  const stageStatus = (s: FlowStep): "done" | "active" | "upcoming" => {
    const i = STAGE_ORDER.indexOf(s);
    const cur = STAGE_ORDER.indexOf(step);
    return i < cur ? "done" : i === cur ? "active" : "upcoming";
  };

  const targets = plan?.interpretedTargets ?? [];
  const sisaDeficit = deficits.filter((d) => !plan?.interpretedTargets?.some((t) => t.subjectId === d.subjectId));

  return <div className="space-y-4">
    {missingTeacher.length > 0 && <MissingTeacherAlert subjects={missingTeacher} onTetapkan={tetapkanGuru} isPending={tetapkanPending !== null} pendingKey={tetapkanPending} error={tetapkanError} />}
    {excess.length > 0 && <ExcessAlert excess={excess} onKurangi={kurangi} isPending={isPending} pendingId={kurangiPendingId} error={kurangiError} />}
    <div className="space-y-0">
    {/* ── Tahap 1: Temuan (§08-10) ── */}
    <Stage status={stageStatus("finding")} title={STAGE_TITLE.finding} isLast={false} onReopen={step !== "finding" ? batal : undefined}>
      {stageStatus("finding") === "active" ? (
        <div className="sakala-stage-enter space-y-3">
          {readyToSchedule.length > 0 && <>
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-5 text-ink-900"><span className="tabular-nums">{totalKurang}</span> JP sudah ada guru, tinggal dijadwalkan</p>
                <p className="mt-1 text-[12px] leading-5 text-ink-500">
                  Kelas {classStatus.label} baru memiliki {classStatus.scheduledJp} dari {classStatus.targetJp} JP.
                  {topDeficit && ` ${topDeficit.subjectName} kekurangan ${topDeficit.belumTerjadwalJp} JP di jadwal`}
                  {readyToSchedule.length > 1 && `, dan ${readyToSchedule.length - 1} mapel lain juga masih kurang.`}
                  {readyToSchedule.length === 1 && "."}
                </p>
              </div>
            </div>
            {error && step === "finding" && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11.5px] text-rose">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="accent" onClick={() => lihatSolusi("complete_remaining_jp")} disabled={isPending} loading={isPending}>{isPending ? "Memeriksa solusi…" : "Lihat solusi"}</Button>
              <Button variant="secondary" onClick={() => lihatSolusi("fill_empty_slots")} disabled={isPending}>Isi slot kosong</Button>
              <Button variant="secondary" onClick={() => lihatSolusi("schedule_full_week")} disabled={isPending}>Susun semua mapel</Button>
            </div>
          </>}
          <CrossFeatureLinks />
        </div>
      ) : (
        <p className="text-[12px] text-ink-500"><span className="font-medium text-ink-700">{totalKurang} JP belum terpenuhi</span> · {classStatus.label}</p>
      )}
    </Stage>

    {/* ── Tahap 2: Solusi (§15, §23, §30) ── */}
    <Stage status={stageStatus("solution")} title={STAGE_TITLE.solution} isLast={false} onReopen={step === "preview" || step === "done" ? () => setStep("solution") : undefined}>
      {stageStatus("solution") === "upcoming" && <p className="text-[11.5px] text-ink-300">Menunggu tahap sebelumnya.</p>}
      {stageStatus("solution") === "done" && plan && <p className="text-[12px] text-ink-500"><span className="font-medium text-ink-700">{plan.result.candidates.length} slot</span> · {variant === "alt" ? `fokus ${altFocusSubject}` : INTENT_LABEL[intent]}</p>}
      {stageStatus("solution") === "active" && plan && <div className="sakala-stage-enter space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[14px] font-semibold text-ink-900">{INTENT_LABEL[intent]}</p>
          <button type="button" onClick={() => setWhyOpen((v) => !v)} aria-expanded={whyOpen} className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${whyOpen ? "border-violet/40 bg-violet-50 text-violet" : "border-border text-ink-500 hover:border-violet/30 hover:text-violet"}`}><HelpCircle size={11} />Mengapa?</button>
        </div>

        {/* §30 Trust — dasar rekomendasi, data nyata dari sumber yang sama dengan Top Summary. */}
        {whyOpen && <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-muted p-3 text-[11px] sm:grid-cols-4">
          <div><p className="text-ink-400">Target JP</p><p className="mt-0.5 font-semibold tabular-nums text-ink-800">{classStatus.targetJp}</p></div>
          <div><p className="text-ink-400">JP saat ini</p><p className="mt-0.5 font-semibold tabular-nums text-ink-800">{classStatus.scheduledJp}</p></div>
          <div><p className="text-ink-400">Slot ditemukan</p><p className="mt-0.5 font-semibold tabular-nums text-ink-800">{plan.result.candidates.length}</p></div>
          <div><p className="text-ink-400">Mapel terkait</p><p className="mt-0.5 font-semibold tabular-nums text-ink-800">{targets.length || deficits.length}</p></div>
          <p className="col-span-2 mt-1 text-ink-400 sm:col-span-4">Data diperiksa: Target JP · Mata Pelajaran · Pembagian Mengajar · Jadwal committed.</p>
        </div>}

        {/* §23 Alternative Solutions */}
        {altPlan && <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setVariant("primary")} className={`rounded-xl border p-3 text-left transition-colors ${variant === "primary" ? "border-violet/40 bg-violet-50" : "border-border bg-surface hover:border-violet/20"}`}>
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-violet">★ Disarankan</p>
            <p className="mt-1 text-[12px] font-semibold text-ink-900">Lengkapi semua mapel yang kurang</p>
            <p className="mt-0.5 text-[11px] text-ink-500">{primaryPlan?.result.candidates.length ?? 0} slot · {readyToSchedule.length} mapel sekaligus</p>
          </button>
          <button type="button" onClick={() => setVariant("alt")} className={`rounded-xl border p-3 text-left transition-colors ${variant === "alt" ? "border-violet/40 bg-violet-50" : "border-border bg-surface hover:border-violet/20"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Alternatif</p>
            <p className="mt-1 text-[12px] font-semibold text-ink-900">Fokus {altFocusSubject} dulu</p>
            <p className="mt-0.5 text-[11px] text-ink-500">{altPlan.result.candidates.length} slot · bertahap, sisanya menyusul lain kali</p>
          </button>
        </div>}

        <p className="text-[12px] leading-5 text-ink-500">{plan.explanation}</p>

        {/* §18 — Solution Card sebagai hero component: bukan row database, tapi
            hasil intelligence yang terasa "sudah diperiksa". Checkmark di sini
            BUKAN dekorasi — solver (solveWeeklySchedule) memang CSP-based yang
            mempertimbangkan existing assignment saat generate (guru tersedia,
            tidak bentrok), dan hanya balikin batch candidate lengkap kalau JP
            targetnya tercapai penuh ("Exact-JP invariant") — jadi klaimnya jujur. */}
        {plan.result.candidates.length > 0 && (() => {
          const hero = plan.result.candidates[0];
          const rest = plan.result.candidates.slice(1);
          return <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[.1em] text-ink-400">Solusi yang disarankan</p>
            <div className="rounded-xl border border-violet/25 bg-surface p-3.5">
              <p className="text-[13.5px] font-semibold text-ink-900">{subjectNames[hero.draft.subjectId] ?? hero.draft.subjectId}</p>
              <p className="text-[11.5px] text-ink-500">{classStatus.label}</p>
              <p className="mt-2 text-[12px] text-ink-700">{hero.draft.day.charAt(0).toUpperCase() + hero.draft.day.slice(1)} · JP {hero.draft.periodStart}{hero.draft.periodEnd !== hero.draft.periodStart ? `–${hero.draft.periodEnd}` : ""}</p>
              <p className="text-[12px] text-ink-500">{teacherNames[hero.draft.teacherId] ?? hero.draft.teacherId}</p>
              <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-2.5 text-[10.5px] text-emerald">
                <span className="flex items-center gap-1"><CheckCircle2 size={11} />Guru tersedia</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={11} />Tidak bentrok</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={11} />Sesuai target JP</span>
              </div>
            </div>
            {rest.length > 0 && <div className="space-y-1">
              {rest.slice(0, 4).map((c, i) => <div key={`${c.requirementId}-${i}`} className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-1.5 text-[11.5px]">
                <span className="min-w-0 truncate text-ink-700">{subjectNames[c.draft.subjectId] ?? c.draft.subjectId}</span>
                <span className="shrink-0 text-ink-400">{c.draft.day} · JP {c.draft.periodStart}</span>
              </div>)}
              {rest.length > 4 && <p className="px-1 text-[10.5px] text-ink-400">+{rest.length - 4} slot lain di langkah Preview.</p>}
            </div>}
          </div>;
        })()}

        {/* Display numeral — angka JP adalah inti emosional fitur ini. */}
        <div className="flex items-center justify-center gap-4 rounded-xl border border-border bg-surface-muted/60 px-4 py-3.5">
          <span className="text-[26px] font-light leading-none tabular-nums text-ink-400">{classStatus.scheduledJp}</span>
          <ArrowRight size={14} className="shrink-0 text-violet" />
          <span className="text-[26px] font-semibold leading-none tabular-nums text-ink-900">{classStatus.scheduledJp + plan.result.candidates.length}</span>
          <span className="text-[11px] font-medium text-ink-400">JP</span>
        </div>

        {plan.result.candidates.length === 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber">Belum ada slot valid yang ditemukan untuk solusi ini. Coba pilihan lain, atau atur jadwal secara manual.</p>}
        {plan.needsClarification && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber">{plan.clarification}</p>}
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11.5px] text-rose">{error}</p>}

        <div className="flex gap-2">
          <Button variant="accent" onClick={() => { setSelectedKeys(new Set(plan.result.candidates.map((c, i) => candidateKey(c, i)))); setStep("preview"); }} disabled={plan.result.candidates.length === 0}>Tinjau perubahan</Button>
          <Button variant="secondary" onClick={batal}>Batal</Button>
        </div>
      </div>}
    </Stage>

    {/* ── Tahap 3: Preview (§17-18) ── */}
    <Stage status={stageStatus("preview")} title={STAGE_TITLE.preview} isLast={false} onReopen={step === "done" ? () => setStep("preview") : undefined}>
      {stageStatus("preview") === "upcoming" && <p className="text-[11.5px] text-ink-300">Menunggu tahap sebelumnya.</p>}
      {stageStatus("preview") === "done" && plan && <p className="text-[12px] text-ink-500"><span className="font-medium text-ink-700">{plan.result.candidates.length} perubahan</span> ditinjau</p>}
      {stageStatus("preview") === "active" && plan && (() => {
        const allKeys = plan.result.candidates.map((c, i) => candidateKey(c, i));
        const selectedCandidates = plan.result.candidates.filter((c, i) => selectedKeys.has(candidateKey(c, i)));
        const allSelected = selectedKeys.size === allKeys.length && allKeys.length > 0;
        return <div className="sakala-stage-enter space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[14px] font-semibold text-ink-900">{selectedCandidates.length} dari {plan.result.candidates.length} perubahan dipilih</p>
            <button type="button" onClick={() => setSelectedKeys(allSelected ? new Set() : new Set(allKeys))} className="text-[11px] font-semibold text-violet hover:underline">{allSelected ? "Kosongkan" : "Pilih semua"}</button>
          </div>

          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {plan.result.candidates.map((c, i) => {
              const key = candidateKey(c, i);
              const checked = selectedKeys.has(key);
              return <label key={key} className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] transition-colors ${checked ? "bg-surface-muted" : "bg-surface-muted/40 opacity-60"}`}>
                <input type="checkbox" checked={checked} onChange={() => setSelectedKeys((prev) => { const next = new Set(prev); if (checked) next.delete(key); else next.add(key); return next; })} className="h-3.5 w-3.5 shrink-0 accent-violet" />
                <span className="min-w-0 flex-1 truncate font-medium text-ink-800">{subjectNames[c.draft.subjectId] ?? c.draft.subjectId}</span>
                <span className="shrink-0 text-ink-400">{c.draft.day} · JP {c.draft.periodStart}{c.draft.periodEnd !== c.draft.periodStart ? `–${c.draft.periodEnd}` : ""}</span>
                <span className="shrink-0 truncate text-ink-500">{teacherNames[c.draft.teacherId] ?? c.draft.teacherId}</span>
              </label>;
            })}
          </div>

          <div className="flex items-center justify-center gap-4 rounded-xl border border-border bg-surface-muted/60 px-4 py-3.5">
            <span className="text-[15px] font-medium tabular-nums text-ink-400">{classStatus.scheduledJp} / {classStatus.targetJp}</span>
            <ArrowRight size={14} className="shrink-0 text-violet" />
            <span className="flex items-baseline gap-1 text-[26px] font-semibold leading-none tabular-nums text-ink-900">{classStatus.scheduledJp + selectedCandidates.length}<span className="text-[13px] font-medium text-ink-400">/{classStatus.targetJp} JP</span></span>
            {classStatus.scheduledJp + selectedCandidates.length >= classStatus.targetJp && <CheckCircle2 size={16} className="text-emerald" />}
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11.5px] text-rose">{error}</p>}
          <p className="text-[11px] leading-5 text-ink-400">Belum ada perubahan yang diterapkan. Menekan tombol di bawah akan menyimpan yang dipilih sebagai <em>candidate</em> — jadwal committed baru berubah setelah ditinjau dan diterapkan eksplisit di Jadwal Cerdas.</p>

          <div className="flex flex-wrap gap-2">
            <Button variant="accent" onClick={terapkan} disabled={isPending || selectedCandidates.length === 0} loading={isPending}><CheckCircle2 className="mr-1.5 h-4 w-4" />{isPending ? "Menerapkan…" : `Terapkan ${selectedCandidates.length} perubahan`}</Button>
            <Button variant="secondary" onClick={() => setStep("solution")} disabled={isPending}>Kembali</Button>
            <Button variant="ghost" onClick={batal} disabled={isPending}>Batal</Button>
          </div>
        </div>;
      })()}
    </Stage>

    {/* ── Tahap 4: Diterapkan (§20-22) ── */}
    <Stage status={stageStatus("done")} title={STAGE_TITLE.done} isLast>
      {stageStatus("done") === "upcoming" && <p className="text-[11.5px] text-ink-300">Menunggu tahap sebelumnya.</p>}
      {stageStatus("done") === "active" && <div className="sakala-stage-enter space-y-3">
        {rolledBack ? (
          <>
            <div className="flex items-center gap-2 text-ink-600"><Circle size={14} className="text-ink-300" /><p className="text-[13.5px] font-semibold">Dikembalikan</p></div>
            <p className="text-[12px] leading-5 text-ink-500">{savedCount} candidate yang tadi disimpan sudah dihapus lagi. Tidak ada yang berubah pada jadwal committed.</p>
          </>
        ) : <>
          <div className="flex items-center gap-2 text-emerald"><CheckCircle2 size={16} /><p className="text-[13.5px] font-semibold">Sudah diperbarui</p></div>
          <ExecutionRow label="Candidate jadwal disimpan" done />
          <ExecutionRow label="Jadwal committed diperbarui" done={false} note="menunggu ditinjau di Jadwal Cerdas" />

          <div className="space-y-2 rounded-lg bg-surface-muted p-3 text-[12.5px] text-ink-700">
            <p><strong>{savedCount}</strong> candidate tersimpan{skippedCount > 0 && <span className="text-amber"> · {skippedCount} dilewati karena conflict</span>}.
            Lanjutkan ke <Link href="/jadwal-cerdas" className="font-semibold text-violet hover:underline">Jadwal Cerdas</Link> untuk meninjau dan menerapkan ke jadwal resmi.</p>
            {error && <p className="text-[11.5px] text-rose">{error}</p>}
            <button type="button" onClick={kembalikan} disabled={isPending} className="text-[11px] font-semibold text-ink-500 underline decoration-dotted hover:text-rose disabled:opacity-50">{isPending ? "Mengembalikan…" : "Kembalikan"}</button>
          </div>
        </>}

        {sisaDeficit.length > 0 ? <div className="flex items-start gap-2.5 border-t border-border/60 pt-3">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-ink-900">Saya menemukan {sisaDeficit.length} hal lagi</p>
            <p className="mt-0.5 text-[11.5px] leading-5 text-ink-500">{sisaDeficit[0].subjectName} masih kekurangan {sisaDeficit[0].remainingJp} JP.</p>
            <Button variant="accent" size="sm" className="mt-2" onClick={() => { setStep("finding"); setPrimaryPlan(null); setAltPlan(null); setVariant("primary"); setSavedCount(null); setRolledBack(false); }}>Lihat solusi</Button>
          </div>
        </div> : <p className="border-t border-border/60 pt-3 text-[12px] text-ink-500">Tidak ada masalah JP lain yang saya temukan untuk kelas ini saat ini.</p>}
      </div>}
    </Stage>
    </div>
  </div>;
}

function ExecutionRow({ label, done, note }: { label: string; done: boolean; note?: string }) {
  return <div className="flex items-center gap-2 text-[12px]">
    {done ? <CheckCircle2 size={14} className="shrink-0 text-emerald" /> : <Circle size={14} className="shrink-0 text-ink-300" />}
    <span className={done ? "text-ink-700" : "text-ink-400"}>{label}</span>
    {note && <span className="text-ink-300">— {note}</span>}
  </div>;
}
