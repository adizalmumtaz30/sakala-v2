"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import type { TargetJpView, TargetJpRow } from "@/lib/application/targetJp.usecases";
import type { JpSummaryStatus } from "@/lib/domain/pembagianMengajar";
import { formatHari } from "@/lib/domain/jamPelajaran";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";

interface Props {
  activeContextLabel: string;
  view: TargetJpView;
}

// Bagian 29: state resmi — istilah ini yang harus tampil ke user, bukan
// nama internal JpSummaryStatus (kosong/sebagian/penuh/lebih).
const STATUS_LABEL: Record<JpSummaryStatus, string> = {
  kosong: "Belum Mulai",
  sebagian: "Belum Lengkap",
  penuh: "Lengkap",
  lebih: "Melebihi Target",
};
const STATUS_TONE: Record<JpSummaryStatus, "neutral" | "warning" | "success" | "danger"> = {
  kosong: "neutral",
  sebagian: "warning",
  penuh: "success",
  lebih: "danger",
};
const STATUS_FILTERS: (JpSummaryStatus | "semua")[] = ["semua", "kosong", "sebagian", "penuh", "lebih"];

export default function TargetJpWorkspace({ activeContextLabel, view }: Props) {
  const [filter, setFilter] = useState<JpSummaryStatus | "semua">("semua");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredRows = filter === "semua" ? view.rows : view.rows.filter((r) => r.status === filter);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 pt-6">
      <div>
        <Link href="/pembagian-mengajar" className="mb-2 flex items-center gap-1 text-[12.5px] text-ink-400 hover:text-ink-700">
          <ArrowLeft size={13} /> Pembagian Mengajar
        </Link>
        <h1 className="text-[20px] font-bold text-ink-900">Target JP</h1>
        <p className="text-[13px] text-ink-500">
          Kelengkapan jadwal per kombinasi Guru+Mapel+Kelas — konteks aktif:{" "}
          <span className="font-medium text-ink-700">{activeContextLabel}</span>
        </p>
      </div>

      {/* Key Metrics (Bagian 29): target JP, scheduled JP, difference, completion percentage — level keseluruhan */}
      <Card>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <p className="text-[11.5px] text-ink-400">Completion</p>
            <p className="text-[24px] font-bold text-ink-900">{view.overallCompletionPercent}%</p>
          </div>
          <div>
            <p className="text-[11.5px] text-ink-400">Target JP</p>
            <p className="text-[16px] font-semibold text-ink-900">{view.overallTargetJp}</p>
          </div>
          <div>
            <p className="text-[11.5px] text-ink-400">Terjadwal</p>
            <p className="text-[16px] font-semibold text-ink-900">{view.overallScheduledJp}</p>
          </div>
          <div>
            <p className="text-[11.5px] text-ink-400">Selisih</p>
            <p className={`text-[16px] font-semibold ${view.overallTargetJp - view.overallScheduledJp > 0 ? "text-amber" : "text-ink-900"}`}>
              {view.overallTargetJp - view.overallScheduledJp}
            </p>
          </div>
        </div>
      </Card>

      {/* Per-subject rollup (Bagian 29: "per-subject target; per-subject actual") */}
      {view.subjectRollups.length > 0 && (
        <Card className="p-0">
          <p className="px-5 pt-4 text-[12.5px] font-semibold text-ink-700">Per Mata Pelajaran</p>
          <ul>
            {view.subjectRollups.map((s) => (
              <li key={s.mataPelajaranId} className="flex items-center gap-3 border-b border-border px-5 py-2.5 last:border-0">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.mataPelajaranWarna ?? "#C6CAD3" }} aria-hidden="true" />
                <span className="flex-1 text-[13px] text-ink-900">{s.mataPelajaranNama}</span>
                <span className="text-[12px] text-ink-400">
                  {s.scheduledJp}/{s.targetJp} JP
                </span>
                <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Filter by state */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              filter === f ? "bg-brand-600 text-white" : "bg-surface-muted text-ink-500 hover:bg-surface-muted/70"
            }`}
          >
            {f === "semua" ? "Semua" : STATUS_LABEL[f]}
            {f !== "semua" && ` (${view.rows.filter((r) => r.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Per-combination detail — klik untuk expose affected schedule (Bagian 29) */}
      <Card className="p-0">
        {filteredRows.length === 0 ? (
          <EmptyState
            title={view.rows.length === 0 ? "Belum ada Pembagian Mengajar aktif" : "Tidak ada yang cocok filter ini"}
            description={view.rows.length === 0 ? "Tambahkan dulu di halaman Pembagian Mengajar." : undefined}
          />
        ) : (
          <ul>
            {filteredRows.map((row) => (
              <TargetJpRowItem key={row.id} row={row} expanded={expandedId === row.id} onToggle={() => setExpandedId((cur) => (cur === row.id ? null : row.id))} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function TargetJpRowItem({ row, expanded, onToggle }: { row: TargetJpRow; expanded: boolean; onToggle: () => void }) {
  return (
    <li className="border-b border-border last:border-0">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left hover:bg-surface-muted/60">
        {expanded ? <ChevronDown size={14} className="shrink-0 text-ink-300" /> : <ChevronRight size={14} className="shrink-0 text-ink-300" />}
        <div className="min-w-[160px] flex-1">
          <p className="text-[13.5px] font-medium text-ink-900">{row.guruNama}</p>
          <p className="text-[12px] text-ink-400">
            {row.mataPelajaranNama} · {row.kelasLabel}
          </p>
        </div>
        <span className="text-[12px] text-ink-400">
          {row.scheduledJp}/{row.targetJp} JP{" "}
          {row.difference !== 0 && <span className={row.difference > 0 ? "text-amber" : "text-rose"}>({row.difference > 0 ? "-" : "+"}{Math.abs(row.difference)})</span>}
        </span>
        <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
      </button>

      {expanded && (
        <div className="border-t border-dashed border-border bg-surface-muted/40 px-5 py-3 pl-11">
          {row.schedules.length === 0 ? (
            <p className="text-[12px] text-ink-400">Belum ada jadwal (draft/candidate/committed) untuk kombinasi ini.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {row.schedules.map((s, i) => (
                <span key={i} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11.5px] text-ink-700">
                  {formatHari(s.day)} · Jam {s.periodStart === s.periodEnd ? s.periodStart : `${s.periodStart}-${s.periodEnd}`}
                  <span className="ml-1 text-ink-400">({s.status})</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
