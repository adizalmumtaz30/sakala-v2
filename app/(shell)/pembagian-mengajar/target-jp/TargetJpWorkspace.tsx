"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import type { TargetJpView, TargetJpRow, TargetJpStatus } from "@/lib/application/targetJp.usecases";
import { formatHari } from "@/lib/domain/jamPelajaran";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";
import TargetJpImportPanel from "./TargetJpImportPanel";

interface Props {
  activeContextLabel: string;
  view: TargetJpView;
  curriculumAvailable: boolean;
}

// Kontrak §53-54 — bahasa operator, bukan istilah teknis.
const STATUS_LABEL: Record<TargetJpStatus, string> = {
  belum_siap: "Guru Belum Ditentukan",
  siap_belum_terjadwal: "Siap, Belum Terjadwal",
  sebagian_terjadwal: "Sebagian Terjadwal",
  lengkap: "Lengkap Terjadwal",
};
const STATUS_TONE: Record<TargetJpStatus, "neutral" | "warning" | "success" | "danger"> = {
  belum_siap: "danger",
  siap_belum_terjadwal: "warning",
  sebagian_terjadwal: "warning",
  lengkap: "success",
};
const STATUS_FILTERS: (TargetJpStatus | "semua")[] = ["semua", "belum_siap", "siap_belum_terjadwal", "sebagian_terjadwal", "lengkap"];

export default function TargetJpWorkspace({ activeContextLabel, view, curriculumAvailable }: Props) {
  const [filter, setFilter] = useState<TargetJpStatus | "semua">("semua");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showManage, setShowManage] = useState(false);

  const filteredRows = filter === "semua" ? view.rows : view.rows.filter((r) => r.status === filter);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 pt-6">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <Link href="/pembagian-mengajar" className="flex items-center gap-1 text-[12.5px] text-ink-400 hover:text-ink-700">
            <ArrowLeft size={13} /> Pembagian Mengajar
          </Link>
          <button
            type="button"
            onClick={() => setShowManage((v) => !v)}
            className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-surface-muted"
          >
            {showManage ? "Tutup Import / Edit Massal" : "Import / Edit Massal"}
          </button>
        </div>
        <h1 className="text-[20px] font-bold text-ink-900">Target JP</h1>
        <p className="text-[13px] text-ink-500">
          Kebutuhan resmi per Kelas+Mapel (dari Target JP hasil Generate Kurikulum) dibandingkan kesiapan guru dan jadwal — konteks aktif:{" "}
          <span className="font-medium text-ink-700">{activeContextLabel}</span>
        </p>
      </div>

      {showManage && <TargetJpImportPanel onSaved={() => setShowManage(false)} />}

      {view.overallTargetJp === 0 && curriculumAvailable && (
        <Card className="border-brand-600/30 bg-brand-50/40">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600/10 text-brand-700">
              <Sparkles size={16} />
            </div>
            <div className="flex-1">
              <p className="text-[13.5px] font-semibold text-ink-900">Belum ada Target JP untuk konteks aktif</p>
              <p className="mt-0.5 text-[12.5px] text-ink-600">
                Kurikulum resmi terverifikasi tersedia untuk konteks ini dan dapat dipakai untuk menyusun Target JP secara otomatis.
              </p>
              <Link
                href="/akademik/generate-kurikulum"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-700"
              >
                <Sparkles size={13} /> Generate dari Kurikulum
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Empat angka wajib beda (kontrak §7): Target, Siap, Terjadwal, Belum Siap. */}
      <Card>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <p className="text-[11.5px] text-ink-400">Target JP</p>
            <p className="text-[24px] font-bold text-ink-900">{view.overallTargetJp}</p>
          </div>
          <div>
            <p className="text-[11.5px] text-ink-400">Siap dijadwalkan</p>
            <p className="text-[16px] font-semibold text-ink-900">{view.overallSiapJp}</p>
          </div>
          <div>
            <p className="text-[11.5px] text-ink-400">Terjadwal</p>
            <p className="text-[16px] font-semibold text-ink-900">{view.overallTerjadwalJp}</p>
          </div>
          <div>
            <p className="text-[11.5px] text-ink-400">Guru Belum Ditentukan</p>
            <p className={`text-[16px] font-semibold ${view.overallBelumSiapJp > 0 ? "text-rose" : "text-ink-900"}`}>{view.overallBelumSiapJp} JP</p>
          </div>
        </div>
        {/* Kalimat status (kontrak §40-44) — bukan sekadar angka, dan tidak pernah klaim selesai kalau belum benar-benar selesai. */}
        <p className="mt-3 border-t border-border pt-3 text-[12.5px] leading-relaxed text-ink-600">
          {view.overallTargetJp === 0
            ? "Belum ada Target JP resmi untuk konteks ini. Isi lewat Generate Kurikulum terlebih dahulu."
            : view.overallBelumSiapJp > 0
              ? <>Target JP resmi <b>{view.overallTargetJp}</b>. <b>{view.overallSiapJp}</b> JP sudah punya guru dan siap dijadwalkan, <b className="text-rose">{view.overallBelumSiapJp} JP belum punya guru</b>.</>
              : view.overallBelumTerjadwalJp > 0
                ? <>Semua {view.overallTargetJp} JP sudah punya guru. <b>{view.overallTerjadwalJp}</b> JP sudah masuk jadwal, <b>{view.overallBelumTerjadwalJp} JP</b> masih menunggu slot.</>
                : <>🟢 {view.overallTargetJp}/{view.overallTargetJp} JP sudah terjadwal.</>}
        </p>
      </Card>

      {/* Per-subject rollup */}
      {view.subjectRollups.length > 0 && (
        <Card className="p-0">
          <p className="px-5 pt-4 text-[12.5px] font-semibold text-ink-700">Per Mata Pelajaran</p>
          <ul>
            {view.subjectRollups.map((s) => (
              <li key={s.mataPelajaranId} className="flex items-center gap-3 border-b border-border px-5 py-2.5 last:border-0">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.mataPelajaranWarna ?? "#C6CAD3" }} aria-hidden="true" />
                <span className="flex-1 text-[13px] text-ink-900">{s.mataPelajaranNama}</span>
                <span className="text-[12px] text-ink-400">
                  {s.terjadwalJp}/{s.targetJp} JP{s.belumSiapJp > 0 && <span className="text-rose"> ({s.belumSiapJp} belum ada guru)</span>}
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

      {/* Per Kelas+Mapel detail */}
      <Card className="p-0">
        {filteredRows.length === 0 ? (
          <EmptyState
            title={view.rows.length === 0 ? "Belum ada Target JP resmi" : "Tidak ada yang cocok filter ini"}
            description={view.rows.length === 0 ? "Isi Target JP lewat Generate Kurikulum terlebih dahulu." : undefined}
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
          <p className="text-[13.5px] font-medium text-ink-900">{row.mataPelajaranNama} · {row.kelasLabel}</p>
          <p className="text-[12px] text-ink-400">
            {row.guruAssignments.length === 0 ? "Guru belum ditentukan" : row.guruAssignments.map((g) => g.guruNama).join(", ")}
          </p>
        </div>
        <span className="text-[12px] text-ink-400">
          {row.terjadwalJp}/{row.targetJp} JP{" "}
          {row.belumSiapJp > 0 && <span className="text-rose">({row.belumSiapJp} belum ada guru)</span>}
        </span>
        <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
      </button>

      {expanded && (
        <div className="border-t border-dashed border-border bg-surface-muted/40 px-5 py-3 pl-11">
          <p className="text-[11.5px] text-ink-500">
            Target {row.targetJp} JP · Siap {row.siapJp} JP · Terjadwal {row.terjadwalJp} JP · Belum Siap {row.belumSiapJp} JP
          </p>
          {row.schedules.length === 0 ? (
            <p className="mt-2 text-[12px] text-ink-400">Belum ada jadwal (draft/candidate/committed) untuk kombinasi ini.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
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
