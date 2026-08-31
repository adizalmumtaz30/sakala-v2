"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Gauge,
  Lightbulb,
  Target,
  Users,
} from "lucide-react";
import type { AnalitikView } from "@/lib/application/analitik.usecases";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import ReportExportBar from "@/components/ui/ReportExportBar";

interface Props {
  activeContextLabel: string;
  schoolName?: string;
  view: AnalitikView;
}

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  belum_siap: "danger",
  siap_belum_terjadwal: "warning",
  sebagian_terjadwal: "warning",
  lengkap: "success",
};

const TEACHER_ACCENTS = [
  "bg-brand-50 text-brand-700",
  "bg-cyan-50 text-cyan",
  "bg-violet-50 text-violet",
  "bg-emerald-50 text-emerald",
  "bg-amber-50 text-amber",
  "bg-rose-50 text-rose",
];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
}: {
  icon: typeof BarChart3;
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Icon size={17} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">{eyebrow}</p>
          <h2 className="mt-0.5 text-[14px] font-semibold text-ink-900">{title}</h2>
          <p className="mt-0.5 text-[11.5px] leading-5 text-ink-500">{description}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default function AnalitikWorkspace({ activeContextLabel, schoolName, view }: Props) {
  const maxJam = Math.max(1, ...view.bebanGuru.map((g) => g.totalJamCommitted));
  const maxJpCount = Math.max(1, ...view.jpBreakdown.map((b) => b.count));
  const totalScheduledJp = view.bebanGuru.reduce((sum, guru) => sum + guru.totalJamCommitted, 0);
  const totalConflicts = view.konflikAktif.length;
  const completedJp = view.jpBreakdown.find((item) => item.status === "lengkap")?.count ?? 0;
  const completionRate = view.totalKombinasiAktif > 0
    ? Math.round((completedJp / view.totalKombinasiAktif) * 100)
    : 0;
  const busiestTeacher = [...view.bebanGuru].sort((a, b) => b.totalJamCommitted - a.totalJamCommitted)[0];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pt-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-[10.5px] font-medium text-ink-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald" aria-hidden="true" />
            Konteks aktif · {activeContextLabel}
          </div>
          <h1 className="text-[24px] font-bold tracking-[-0.025em] text-ink-900">Analitik</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-ink-500">
            Ringkasan kondisi jadwal untuk membantu Anda melihat beban, kecukupan JP, dan area yang perlu ditindaklanjuti.
          </p>
        </div>
        <Link
          href="/jadwal-cerdas"
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-[12px] font-semibold text-ink-700 transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-px hover:border-border-strong hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Buka Jadwal Cerdas <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </header>

      <section aria-label="Ringkasan analitik" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="card-hover p-4">
          <div className="flex items-center justify-between">
            <span className="text-ink-400"><Gauge size={17} aria-hidden="true" /></span>
            <Badge tone={completionRate >= 90 ? "success" : completionRate >= 60 ? "warning" : "neutral"}>JP terpenuhi</Badge>
          </div>
          <p className="mt-4 tabular-nums text-[25px] font-bold tracking-[-0.03em] text-ink-900">{completionRate}%</p>
          <p className="mt-0.5 text-[11.5px] text-ink-500">Kombinasi sesuai target</p>
        </Card>

        <Card className="card-hover p-4">
          <div className="flex items-center justify-between">
            <span className="text-ink-400"><Users size={17} aria-hidden="true" /></span>
            <Badge tone="info">Guru</Badge>
          </div>
          <p className="mt-4 tabular-nums text-[25px] font-bold tracking-[-0.03em] text-ink-900">{view.bebanGuru.length}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-500">Guru dengan jadwal committed</p>
        </Card>

        <Card className="card-hover p-4">
          <div className="flex items-center justify-between">
            <span className="text-ink-400"><Target size={17} aria-hidden="true" /></span>
            <Badge tone="info">Committed</Badge>
          </div>
          <p className="mt-4 tabular-nums text-[25px] font-bold tracking-[-0.03em] text-ink-900">{totalScheduledJp}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-500">Total JP terjadwal</p>
        </Card>

        <Card className="card-hover p-4">
          <div className="flex items-center justify-between">
            <span className={totalConflicts > 0 ? "text-amber" : "text-emerald"}>
              {totalConflicts > 0 ? <AlertTriangle size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
            </span>
            <Badge tone={totalConflicts > 0 ? "warning" : "success"}>{totalConflicts > 0 ? "Perlu perhatian" : "Aman"}</Badge>
          </div>
          <p className="mt-4 tabular-nums text-[25px] font-bold tracking-[-0.03em] text-ink-900">{totalConflicts}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-500">Konflik JP aktif</p>
        </Card>
      </section>

      <Card className="overflow-hidden border-brand-100 bg-brand-50/40 p-0">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Lightbulb size={19} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700">Insight</p>
            <h2 className="mt-1 text-[15px] font-semibold text-ink-900">
              {totalConflicts > 0
                ? `${totalConflicts} kombinasi perlu ditinjau sebelum jadwal dianggap rapi.`
                : completionRate >= 90
                  ? "Distribusi JP berada pada kondisi sehat untuk konteks aktif."
                  : "Sebagian target JP masih membutuhkan penjadwalan lebih lanjut."}
            </h2>
            <p className="mt-1.5 text-[12px] leading-5 text-ink-500">
              {busiestTeacher
                ? `${busiestTeacher.guruNama} saat ini memegang beban tertinggi dengan ${busiestTeacher.totalJamCommitted} JP committed. Gunakan data ini untuk memeriksa keseimbangan distribusi.`
                : "Belum ada data beban guru yang dapat dianalisis."}
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-border bg-surface px-3 py-2 text-left sm:min-w-[150px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">Rekomendasi</p>
            <p className="mt-1 text-[11.5px] font-medium leading-4 text-ink-700">
              {totalConflicts > 0 ? "Tinjau konflik JP aktif" : "Lanjutkan pemeriksaan jadwal"}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="p-0">
          <SectionHeader
            icon={BarChart3}
            eyebrow="Workload"
            title="Distribusi Beban Mengajar"
            description="Total JP committed per guru. Warna identitas membantu membaca baris dengan cepat tanpa bergantung pada warna sebagai satu-satunya informasi."
            action={
              <ReportExportBar
                compact
                title="Distribusi Beban Mengajar"
                context={activeContextLabel}
                schoolName={schoolName}
                periodLabel={activeContextLabel}
                filterLabel="Distribusi beban mengajar per guru"
                summary={[
                  { label: "Total Guru", value: view.bebanGuru.length },
                  { label: "Total JP Committed", value: totalScheduledJp },
                  { label: "Guru Beban Tertinggi", value: busiestTeacher ? `${busiestTeacher.guruNama} (${busiestTeacher.totalJamCommitted} JP)` : "-" },
                ]}
                columns={[
                  { key: "guru", label: "Guru" },
                  { key: "jp", label: "JP Committed" },
                  { key: "kelas", label: "Jumlah Kelas" },
                  { key: "persentase", label: "Persentase Relatif" },
                ]}
                rows={view.bebanGuru.map((g) => ({ guru: g.guruNama, jp: g.totalJamCommitted, kelas: g.jumlahKombinasi, persentase: `${Math.round((g.totalJamCommitted / maxJam) * 100)}%` }))}
              />
            }
          />
          {view.bebanGuru.length === 0 ? (
            <div className="px-5 pb-4">
              <EmptyState title="Belum ada jadwal committed" description="Distribusi beban muncul setelah ada assignment berstatus committed." />
            </div>
          ) : (
            <ul className="px-5 pb-4 pt-3" aria-label="Distribusi beban guru">
              {view.bebanGuru.map((g, index) => {
                const percentage = Math.round((g.totalJamCommitted / maxJam) * 100);
                const accent = TEACHER_ACCENTS[index % TEACHER_ACCENTS.length];
                return (
                  <li key={g.guruId} className="group border-b border-border py-3 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${accent}`} aria-hidden="true">
                        {initials(g.guruNama)}
                      </div>
                      <div className="min-w-0 w-36 shrink-0">
                        <p className="truncate text-[12.5px] font-semibold text-ink-900">{g.guruNama}</p>
                        <p className="tabular-nums text-[10.5px] text-ink-400">{g.jumlahKombinasi} kelas · {percentage}% relatif</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="h-2 overflow-hidden rounded-full bg-surface-muted"
                          role="progressbar"
                          aria-label={`Beban ${g.guruNama}`}
                          aria-valuemin={0}
                          aria-valuemax={maxJam}
                          aria-valuenow={g.totalJamCommitted}
                        >
                          <div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${Math.max(4, percentage)}%` }} />
                        </div>
                      </div>
                      <span className="w-16 shrink-0 text-right tabular-nums text-[12px] font-semibold text-ink-700">{g.totalJamCommitted} JP</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-0">
          <SectionHeader
            icon={Gauge}
            eyebrow="Target health"
            title="Status JP per Kombinasi"
            description={`${view.totalKombinasiAktif} kombinasi Guru + Mapel + Kelas pada konteks aktif.`}
            action={
              <ReportExportBar
                compact
                title="Status JP per Kombinasi"
                context={activeContextLabel}
                schoolName={schoolName}
                periodLabel={activeContextLabel}
                filterLabel="Status JP per kombinasi Guru + Mapel + Kelas"
                summary={[
                  { label: "Total Kombinasi Aktif", value: view.totalKombinasiAktif },
                  { label: "JP Terpenuhi", value: `${completionRate}%` },
                ]}
                columns={[
                  { key: "status", label: "Status" },
                  { key: "jumlah", label: "Jumlah Kombinasi" },
                  { key: "persentase", label: "Persentase dari Total" },
                ]}
                rows={view.jpBreakdown.map((b) => ({ status: b.label, jumlah: b.count, persentase: `${view.totalKombinasiAktif ? Math.round((b.count / view.totalKombinasiAktif) * 100) : 0}%` }))}
              />
            }
          />
          <div className="px-5 pb-5 pt-4">
            <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-surface-muted" aria-label="Distribusi status JP">
              {view.jpBreakdown.map((b) => (
                <div
                  key={b.status}
                  className={b.status === "lengkap" ? "bg-emerald" : b.status === "belum_siap" ? "bg-rose" : "bg-amber"}
                  style={{ width: `${view.totalKombinasiAktif ? (b.count / view.totalKombinasiAktif) * 100 : 0}%` }}
                  title={`${b.label}: ${b.count}`}
                />
              ))}
            </div>
            <ul className="divide-y divide-border">
              {view.jpBreakdown.map((b) => {
                const percentage = Math.round((b.count / maxJpCount) * 100);
                return (
                  <li key={b.status} className="flex items-center gap-3 py-3">
                    <Badge tone={STATUS_TONE[b.status]}>{b.label}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className={b.status === "lengkap" ? "h-full rounded-full bg-emerald" : b.status === "belum_siap" ? "h-full rounded-full bg-rose" : "h-full rounded-full bg-amber"}
                          style={{ width: `${b.count === 0 ? 0 : Math.max(4, percentage)}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-8 shrink-0 text-right tabular-nums text-[12px] font-semibold text-ink-700">{b.count}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-ink-400">
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald" /> Sesuai target</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber" /> Perlu dilengkapi</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rose" /> Melebihi target</span>
            </div>
          </div>
        </Card>
      </div>

      <Card id="konflik-jp-aktif" className="scroll-mt-24 p-0">
        <SectionHeader
          icon={AlertTriangle}
          eyebrow="Exceptions"
          title="Konflik JP Aktif"
          description="Prioritaskan kombinasi yang belum lengkap atau melebihi target. Ini adalah daftar pengecualian, bukan daftar semua data."
          action={
            <ReportExportBar
              compact
              title="Konflik JP Aktif"
              context={activeContextLabel}
              schoolName={schoolName}
              periodLabel={activeContextLabel}
              filterLabel="Konflik JP aktif — belum lengkap atau melebihi target"
              summary={[{ label: "Total Konflik Aktif", value: totalConflicts }]}
              columns={[
                { key: "guru", label: "Guru" },
                { key: "mapel", label: "Mata Pelajaran" },
                { key: "kelas", label: "Kelas" },
                { key: "terjadwal", label: "JP Terjadwal" },
                { key: "target", label: "Target JP" },
                { key: "selisih", label: "Selisih" },
                { key: "status", label: "Status" },
              ]}
              rows={view.konflikAktif.map((k) => ({ mapel: k.mataPelajaranNama, kelas: k.kelasLabel, terjadwal: k.targetJp - k.belumSiapJp, target: k.targetJp, selisih: `-${k.belumSiapJp}`, status: "Guru Belum Ditentukan" }))}
            />
          }
        />
        {view.konflikAktif.length === 0 ? (
          <div className="px-5 pb-4">
            <EmptyState title="Tidak ada konflik JP" description="Semua kombinasi Target JP resmi sudah punya guru." />
          </div>
        ) : (
          <ul className="px-5 pb-4 pt-3" aria-label="Konflik JP aktif">
            {view.konflikAktif.map((k) => (
              <li key={k.id} className="flex flex-col gap-3 border-b border-border py-3.5 last:border-0 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink-900">{k.mataPelajaranNama}</p>
                  <p className="truncate text-[11.5px] text-ink-400">{k.kelasLabel}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums text-[12px] font-semibold text-ink-700">
                    {k.targetJp - k.belumSiapJp}/{k.targetJp} JP
                    <span className="ml-1 text-rose">(-{k.belumSiapJp})</span>
                  </span>
                  <Badge tone={STATUS_TONE[k.status]}>Guru Belum Ditentukan</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
