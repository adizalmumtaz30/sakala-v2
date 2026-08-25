"use client";

import { useState } from "react";
import { CheckCircle2, Circle, X, XCircle } from "lucide-react";
import type { AiAction, AiActionOutcome } from "@/lib/domain/aiAction";
import { executeAiActionBatchAction } from "@/app/(shell)/ai/actions";

/**
 * AI Action Contract — dialog persetujuan multi-aksi.
 *
 * SAKALA MASTER RULE: operator harus bisa meninjau SEMUA aksi yang diusulkan
 * AI sekaligus — dikelompokkan per destination (Pembagian Mengajar / Jadwal),
 * bukan satu per satu tanpa gambaran utuh — lalu memilih menyetujui sebagian,
 * semua, atau tidak sama sekali. Setiap aksi tetap dieksekusi lewat fungsi
 * yang sudah punya read-back verification sendiri (lihat
 * executeAiActionBatchAction) — dialog ini hanya mengatur seleksi & urutan,
 * tidak menduplikasi logika tulis data.
 */
export default function MultiActionApprovalDialog({
  actions,
  onClose,
  onDone,
}: {
  actions: AiAction[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(actions.map((a) => a.actionId)));
  const [running, setRunning] = useState(false);
  const [outcomes, setOutcomes] = useState<AiActionOutcome[] | null>(null);

  const groups = new Map<string, AiAction[]>();
  for (const action of actions) {
    const list = groups.get(action.destination) ?? [];
    list.push(action);
    groups.set(action.destination, list);
  }

  function toggle(actionId: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(actionId)) next.delete(actionId);
      else next.add(actionId);
      return next;
    });
  }

  function toggleGroup(destination: string, groupActions: AiAction[]) {
    const allSelected = groupActions.every((a) => selected.has(a.actionId));
    setSelected((cur) => {
      const next = new Set(cur);
      for (const a of groupActions) {
        if (allSelected) next.delete(a.actionId);
        else next.add(a.actionId);
      }
      return next;
    });
  }

  async function apply() {
    const toRun = actions.filter((a) => selected.has(a.actionId));
    if (!toRun.length) return;
    setRunning(true);
    const result = await executeAiActionBatchAction(toRun);
    setOutcomes(result);
    setRunning(false);
    await onDone(); // Read-Back — RecommendationFlow membaca ulang classStatus dari data resmi.
  }

  const outcomeMap = new Map((outcomes ?? []).map((o) => [o.actionId, o]));
  const successCount = outcomes?.filter((o) => o.status === "success").length ?? 0;
  const failedCount = outcomes?.filter((o) => o.status === "failed").length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={outcomes ? undefined : onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.1em] text-violet">Tinjau & Setujui</p>
            <h2 className="mt-0.5 text-[15px] font-bold text-ink-900">{actions.length} aksi diusulkan AI</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1 text-ink-400 hover:bg-surface-muted hover:text-ink-700"><X size={16} /></button>
        </div>

        {!outcomes ? (
          <>
            <div className="mt-4 space-y-4">
              {[...groups.entries()].map(([destination, groupActions]) => {
                const allSelected = groupActions.every((a) => selected.has(a.actionId));
                return (
                  <div key={destination}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-[10.5px] font-bold uppercase tracking-[.08em] text-ink-400">{destination}</p>
                      <button type="button" onClick={() => toggleGroup(destination, groupActions)} className="text-[10.5px] font-semibold text-violet hover:underline">{allSelected ? "Batalkan semua" : "Pilih semua"}</button>
                    </div>
                    <div className="space-y-1.5">
                      {groupActions.map((action) => {
                        const isSelected = selected.has(action.actionId);
                        return (
                          <button key={action.actionId} type="button" onClick={() => toggle(action.actionId)} className={`flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${isSelected ? "border-violet/40 bg-violet-50/50" : "border-border bg-surface"}`}>
                            {isSelected ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-violet" /> : <Circle size={16} className="mt-0.5 shrink-0 text-ink-300" />}
                            <span className="min-w-0 flex-1">
                              <span className="block text-[12.5px] font-semibold text-ink-900">{action.context} · {action.proposedValue}</span>
                              <span className="mt-0.5 block text-[11px] text-ink-500">{action.reason}</span>
                              <span className="mt-0.5 block text-[10px] text-ink-400">Sekarang: {action.currentValue} · {action.evidence}</span>
                            </span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold ${action.riskLevel === "sedang" ? "bg-amber-50 text-amber" : "bg-emerald-50 text-emerald"}`}>{action.riskLevel === "sedang" ? "Risiko sedang" : "Risiko rendah"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-[11.5px] text-ink-500">{selected.size} dari {actions.length} dipilih</p>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} disabled={running} className="rounded-lg border border-border px-3.5 py-2 text-[12.5px] font-semibold text-ink-700 disabled:opacity-50">Batal</button>
                <button type="button" onClick={() => void apply()} disabled={running || selected.size === 0} className="rounded-lg bg-violet px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50">{running ? "Menerapkan…" : `Terapkan ${selected.size} aksi`}</button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Hasil — dibaca dari read-back tiap aksi, bukan asumsi semua berhasil karena tidak ada exception. */}
            <div className="mt-4 space-y-1.5">
              {actions.filter((a) => selected.has(a.actionId)).map((action) => {
                const outcome = outcomeMap.get(action.actionId);
                return (
                  <div key={action.actionId} className="flex items-start gap-2.5 rounded-xl border border-border p-3">
                    {outcome?.status === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-rose" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-ink-900">{action.context} · {action.proposedValue}</span>
                      <span className={`mt-0.5 block text-[11px] ${outcome?.status === "success" ? "text-ink-500" : "text-rose"}`}>{outcome?.message}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-[11.5px] text-ink-600">{successCount} berhasil{failedCount > 0 ? ` · ${failedCount} gagal` : ""}</p>
              <button type="button" onClick={onClose} className="rounded-lg bg-brand-600 px-4 py-2 text-[12.5px] font-bold text-white">Tutup</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
