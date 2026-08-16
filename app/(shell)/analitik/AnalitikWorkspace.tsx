"use client";

import type { AnalitikView } from "@/lib/application/analitik.usecases";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";

interface Props {
  activeContextLabel: string;
  view: AnalitikView;
}

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  kosong: "neutral",
  sebagian: "warning",
  penuh: "success",
  lebih: "danger",
};

export default function AnalitikWorkspace({ activeContextLabel, view }: Props) {
  const maxJam = Math.max(1, ...view.bebanGuru.map((g) => g.totalJamCommitted));
  const maxJpCount = Math.max(1, ...view.jpBreakdown.map((b) => b.count));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 pt-6">
      <div>
        <h1 className="text-[20px] font-bold text-ink-900">Analitik</h1>
        <p className="text-[13px] text-ink-500">
          Snapshot kondisi jadwal saat ini — konteks aktif: <span className="font-medium text-ink-700">{activeContextLabel}</span>
        </p>
      </div>

      {/* Distribusi Beban Mengajar */}
      <Card className="p-0">
        <p className="px-5 pt-4 text-[12.5px] font-semibold text-ink-700">Distribusi Beban Mengajar</p>
        <p className="px-5 pb-1 text-[11.5px] text-ink-400">Total jam committed per guru, konteks aktif ini.</p>
        {view.bebanGuru.length === 0 ? (
          <div className="px-5 pb-4">
            <EmptyState title="Belum ada jadwal committed" description="Distribusi beban muncul setelah ada assignment berstatus committed." />
          </div>
        ) : (
          <ul className="px-5 pb-4">
            {view.bebanGuru.map((g) => (
              <li key={g.guruId} className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
                <span className="w-32 shrink-0 truncate text-[13px] text-ink-900">{g.guruNama}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${Math.max(4, Math.round((g.totalJamCommitted / maxJam) * 100))}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-[12px] text-ink-400">
                  {g.totalJamCommitted} JP · {g.jumlahKombinasi} kelas
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Analitik JP */}
      <Card className="p-0">
        <p className="px-5 pt-4 text-[12.5px] font-semibold text-ink-700">Status JP per Kombinasi</p>
        <p className="px-5 pb-1 text-[11.5px] text-ink-400">{view.totalKombinasiAktif} kombinasi Guru+Mapel+Kelas aktif.</p>
        <ul className="px-5 pb-4">
          {view.jpBreakdown.map((b) => (
            <li key={b.status} className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
              <Badge tone={STATUS_TONE[b.status]}>{b.label}</Badge>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-brand-600"
                  style={{ width: `${b.count === 0 ? 0 : Math.max(4, Math.round((b.count / maxJpCount) * 100))}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-[12px] text-ink-400">{b.count}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Analitik Konflik — JP_MISMATCH aktif (belum lengkap / melebihi target) */}
      <Card className="p-0">
        <p className="px-5 pt-4 text-[12.5px] font-semibold text-ink-700">Konflik JP Aktif</p>
        <p className="px-5 pb-1 text-[11.5px] text-ink-400">Kombinasi yang belum lengkap atau melebihi target JP saat ini.</p>
        {view.konflikAktif.length === 0 ? (
          <div className="px-5 pb-4">
            <EmptyState title="Tidak ada konflik JP" description="Semua kombinasi aktif sudah lengkap atau memang belum mulai dijadwalkan." />
          </div>
        ) : (
          <ul className="px-5 pb-4">
            {view.konflikAktif.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 border-b border-border py-2.5 last:border-0">
                <div className="min-w-[160px] flex-1">
                  <p className="text-[13.5px] font-medium text-ink-900">{k.guruNama}</p>
                  <p className="text-[12px] text-ink-400">
                    {k.mataPelajaranNama} · {k.kelasLabel}
                  </p>
                </div>
                <span className="text-[12px] text-ink-400">
                  {k.scheduledJp}/{k.targetJp} JP{" "}
                  <span className={k.difference > 0 ? "text-amber" : "text-rose"}>
                    ({k.difference > 0 ? "-" : "+"}
                    {Math.abs(k.difference)})
                  </span>
                </span>
                <Badge tone={STATUS_TONE[k.status]}>{k.status === "lebih" ? "Melebihi Target" : "Belum Lengkap"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
