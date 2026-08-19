import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  DoorOpen,
  School,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getDashboardSummary,
  type DashboardJpInsight,
  type DashboardKeyMetrics,
  type DashboardWorkloadEntry,
} from "@/lib/application/dashboard.usecases";
import {
  getDashboardIntelligence,
  type DashboardActivityEntry,
  type DashboardAgendaEntry,
  type DashboardHeatmapDay,
} from "@/lib/application/dashboard.intelligence";
import { formatContextLabel } from "@/lib/domain/academicContext";
import { Card, Badge, EmptyState, ErrorState } from "@/components/ui/primitives";

export default async function DashboardPage() {
  try {
    const supabase = await createClient();
    const summary = await getDashboardSummary(supabase);
    const schoolName = summary.schoolProfile?.namaSekolah ?? "Sekolah";
    const intelligence = summary.activeContext
      ? await getDashboardIntelligence(
          supabase,
          summary.activeContext.id,
          await getSafeList(supabase, "guru"),
          await getSafeList(supabase, "mata_pelajaran"),
          await getSafeList(supabase, "kelas"),
          await getSafeList(supabase, "ruangan"),
        )
      : { heatmap: [], upcomingAgenda: [], recentActivity: [] };

    return (
      <div className="mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-[1440px] flex-col gap-4 px-1 pb-4 pt-4 xl:gap-5">
        <DashboardHeader schoolName={schoolName} context={summary.activeContext ? formatContextLabel(summary.activeContext) : null} />
        {!summary.activeContext ? (
          <Card className="flex-1">
            <EmptyState
              title="Belum ada konteks akademik aktif"
              description="Aktifkan satu Tahun Pelajaran/Semester di Akademik supaya Dashboard menampilkan ringkasan jadwal dan JP."
              action={<Link href="/akademik" className="mt-1 text-[12.5px] font-semibold text-brand-600 hover:text-brand-700">Buka Akademik →</Link>}
            />
          </Card>
        ) : (
          <>
            <KeyMetrics metrics={summary.metrics} />
            <div className="grid min-h-0 gap-4 lg:grid-cols-[1.18fr_.82fr]">
              <HeatmapCard days={intelligence.heatmap} />
              <AgendaCard entries={intelligence.upcomingAgenda} />
            </div>
            <div className="grid min-h-0 gap-4 lg:grid-cols-[.88fr_1.12fr_1fr]">
              <JpInsightCard insight={summary.jpInsight} />
              <WorkloadCard entries={summary.workloadTop} />
              <ActivityCard entries={intelligence.recentActivity} />
            </div>
          </>
        )}
      </div>
    );
  } catch {
    return <div className="mx-auto max-w-3xl px-4 pt-10"><ErrorState message="Gagal memuat ringkasan Dashboard dari Supabase. Cek koneksi dan environment variable kamu." /></div>;
  }
}

function DashboardHeader({ schoolName, context }: { schoolName: string; context: string | null }) {
  return (
    <header className="flex items-end justify-between gap-4 px-1">
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
          {context ?? "Konteks akademik belum aktif"}
        </div>
        <h1 className="text-[26px] font-semibold leading-none tracking-[-0.025em] text-ink-900 sm:text-[28px]">Dashboard</h1>
        <p className="mt-2 text-[12.5px] text-ink-500">Gambaran singkat kondisi akademik <span className="font-medium text-ink-700">{schoolName}</span>.</p>
      </div>
      <Link href="/analitik" className="group hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-[11.5px] font-semibold text-ink-600 shadow-soft transition-all hover:-translate-y-px hover:border-brand-600/30 hover:text-brand-700 sm:flex">
        Lihat Analitik <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </header>
  );
}

const METRIC_TONE: Record<string, { chip: string; icon: string }> = {
  brand: { chip: "bg-brand-50", icon: "text-brand-600" },
  violet: { chip: "bg-violet-50", icon: "text-violet" },
  cyan: { chip: "bg-cyan-50", icon: "text-cyan" },
  amber: { chip: "bg-amber-50", icon: "text-amber" },
  emerald: { chip: "bg-emerald-50", icon: "text-emerald" },
};

function KeyMetrics({ metrics }: { metrics: DashboardKeyMetrics }) {
  const items = [
    { label: "Guru Aktif", value: metrics.totalGuruAktif, href: "/guru", icon: <Users size={15} />, tone: "brand" },
    { label: "Mapel Aktif", value: metrics.totalMataPelajaranAktif, href: "/mata-pelajaran", icon: <BookOpen size={15} />, tone: "violet" },
    { label: "Kelas", value: metrics.totalKelas, href: "/kelas", icon: <School size={15} />, tone: "cyan" },
    { label: "Ruangan", value: metrics.totalRuangan, href: "/ruangan", icon: <DoorOpen size={15} />, tone: "amber" },
    { label: "Pembagian Aktif", value: metrics.totalPembagianMengajarAktif, href: "/pembagian-mengajar", icon: <ClipboardCheck size={15} />, tone: "emerald" },
    { label: "Jadwal Committed", value: metrics.totalJadwalCommitted, href: "/jadwal", icon: <CalendarCheck2 size={15} />, tone: "brand" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => {
        const tone = METRIC_TONE[item.tone];
        return (
          <Link key={item.label} href={item.href} className="group relative flex min-h-[76px] items-center gap-3 overflow-hidden rounded-card border border-border/80 bg-surface px-3.5 py-3 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-600/25 hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${tone.chip} ${tone.icon} transition-transform duration-200 group-hover:scale-105`}>{item.icon}</span>
            <span className="min-w-0">
              <span className="block text-[21px] font-bold leading-none tabular-nums tracking-[-0.02em] text-ink-900">{item.value}</span>
              <span className="mt-1 block truncate text-[10.5px] font-medium text-ink-500">{item.label}</span>
            </span>
            <ArrowRight size={12} className="absolute right-2.5 top-2.5 text-ink-300 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
          </Link>
        );
      })}
    </div>
  );
}

function SectionHeading({ icon, title, description, href, action = "Lihat" }: { icon: React.ReactNode; title: string; description: string; href: string; action?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-brand-600">{icon}</span>
          <h2 className="text-[13.5px] font-semibold tracking-[-0.01em] text-ink-900">{title}</h2>
        </div>
        <p className="mt-1 text-[10.5px] leading-4 text-ink-400">{description}</p>
      </div>
      <Link href={href} className="group flex shrink-0 items-center gap-1 text-[10.5px] font-semibold text-brand-600 hover:text-brand-700">
        {action}<ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

function HeatmapCard({ days }: { days: DashboardHeatmapDay[] }) {
  const peak = Math.max(...days.map((d) => d.total), 0);
  return (
    <Card className="group relative overflow-hidden p-4 sm:p-5">
      <div className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-brand-50/70 blur-3xl" />
      <SectionHeading icon={<CalendarDays size={15} />} title="Kepadatan Jadwal" description="Distribusi JP committed sepanjang minggu." href="/jadwal" action="Buka Jadwal" />
      <div className="relative mt-5 grid grid-cols-6 gap-2.5 sm:gap-3">
        {days.map((day) => {
          const ratio = peak ? day.total / peak : 0;
          const level = day.total === 0 ? "bg-surface-muted" : ratio <= .25 ? "bg-brand-50" : ratio <= .5 ? "bg-brand-100" : ratio <= .75 ? "bg-brand-200" : "bg-brand-300";
          return (
            <div key={day.day} className="min-w-0 text-center">
              <div title={`${day.label}: ${day.total} JP`} className={`relative mx-auto flex h-[58px] items-center justify-center rounded-xl border border-border/70 ${level} transition-all duration-200 hover:-translate-y-1 hover:shadow-soft`}>
                <span className="text-[15px] font-bold tabular-nums text-ink-800">{day.total}</span>
              </div>
              <span className="mt-2 block truncate text-[10px] font-semibold text-ink-500">{day.label.slice(0, 3)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[10px] text-ink-400">
        <span>Rendah</span><span className="font-medium text-ink-500">Puncak {peak} JP</span><span>Tinggi</span>
      </div>
    </Card>
  );
}

function AgendaCard({ entries }: { entries: DashboardAgendaEntry[] }) {
  return (
    <Card className="p-4 sm:p-5">
      <SectionHeading icon={<Clock3 size={15} />} title="Agenda Mendatang" description="Jadwal terdekat dari konteks aktif." href="/jadwal" action="Lihat semua" />
      {entries.length === 0 ? (
        <p className="mt-5 rounded-xl bg-surface-muted px-4 py-5 text-[11.5px] text-ink-400">Belum ada agenda. Jadwal committed akan muncul di sini.</p>
      ) : (
        <div className="mt-3 divide-y divide-border/60">
          {entries.slice(0, 4).map((e) => (
            <Link key={e.id} href="/jadwal" className="group flex gap-3 py-2.5 first:pt-1 last:pb-0">
              <div className="w-[58px] shrink-0 border-r border-border/70 pr-2.5">
                <p className="text-[10px] font-bold text-brand-600">{e.dayLabel}</p>
                <p className="mt-0.5 text-[10px] tabular-nums text-ink-400">{e.time}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11.5px] font-semibold text-ink-900 group-hover:text-brand-700">{e.subject}</p>
                <p className="mt-0.5 truncate text-[10px] text-ink-500">{e.className} · {e.teacher}{e.room ? ` · ${e.room}` : ""}</p>
              </div>
              <ChevronRight size={13} className="mt-1 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

const JP_STATUS_LABEL: Record<string, string> = { kosong: "Belum mulai", sebagian: "Belum lengkap", penuh: "Lengkap", lebih: "Melebihi target" };
const JP_STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger"> = { kosong: "neutral", sebagian: "warning", penuh: "success", lebih: "danger" };

function JpInsightCard({ insight }: { insight: DashboardJpInsight }) {
  return (
    <Card className="p-4 sm:p-5">
      <SectionHeading icon={<ClipboardCheck size={15} />} title="Target JP" description="Kelengkapan pembagian mengajar." href="/pembagian-mengajar/target-jp" action="Detail" />
      {insight.totalKombinasi === 0 ? <p className="mt-4 text-[11.5px] text-ink-400">Belum ada Pembagian Mengajar aktif.</p> : <>
        <div className="mt-4 flex items-end gap-2"><span className="text-[27px] font-bold leading-none tabular-nums tracking-tight text-ink-900">{insight.completionPercent}%</span><span className="pb-0.5 text-[10px] text-ink-400">lengkap</span></div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.min(insight.completionPercent, 100)}%` }} /></div>
        <div className="mt-3 flex flex-wrap gap-1.5">{(Object.keys(insight.countByStatus) as (keyof typeof insight.countByStatus)[]).map((key) => <Badge key={key} tone={JP_STATUS_TONE[key]}>{JP_STATUS_LABEL[key]} · {insight.countByStatus[key]}</Badge>)}</div>
      </>}
    </Card>
  );
}

function WorkloadCard({ entries }: { entries: DashboardWorkloadEntry[] }) {
  const max = Math.max(...entries.map((e) => e.totalJamMengajar), 1);
  return (
    <Card className="p-4 sm:p-5">
      <SectionHeading icon={<Users size={15} />} title="Beban Mengajar" description="Guru dengan JP tertinggi minggu ini." href="/guru" action="Semua Guru" />
      {entries.length === 0 ? <p className="mt-4 text-[11.5px] text-ink-400">Belum ada jadwal committed untuk dihitung.</p> : <div className="mt-3 space-y-2.5">{entries.slice(0, 4).map((entry, i) => <div key={entry.guruId} className="flex items-center gap-2.5"><span className="w-3 text-[9px] font-mono text-ink-300">{i + 1}</span><div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-2"><span className="truncate text-[10.5px] font-medium text-ink-800">{entry.namaGuru}</span><span className="shrink-0 text-[10px] font-semibold tabular-nums text-ink-500">{entry.totalJamMengajar} JP</span></div><div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-brand-600/70" style={{ width: `${Math.max((entry.totalJamMengajar / max) * 100, 4)}%` }} /></div></div></div>)}</div>}
    </Card>
  );
}

function ActivityCard({ entries }: { entries: DashboardActivityEntry[] }) {
  return (
    <Card className="p-4 sm:p-5">
      <SectionHeading icon={<Activity size={15} />} title="Aktivitas Terbaru" description="Perubahan pada konteks akademik aktif." href="/riwayat" action="Riwayat" />
      {entries.length === 0 ? <p className="mt-4 text-[11.5px] text-ink-400">Belum ada aktivitas terbaru.</p> : <div className="mt-3 space-y-2">{entries.slice(0, 4).map((e) => <Link key={e.id} href="/riwayat" className="group flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-surface-muted"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Activity size={11} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[10.5px] font-medium text-ink-800 group-hover:text-brand-700">{e.action}</span><span className="block text-[9.5px] text-ink-400">{formatActivityTime(e.createdAt)}</span></span><ChevronRight size={11} className="shrink-0 text-ink-300" /></Link>)}</div>}
    </Card>
  );
}

async function getSafeList(supabase: any, kind: string) {
  const { listGuru } = await import("@/lib/application/guru.usecases");
  const { listMataPelajaran } = await import("@/lib/application/mata-pelajaran.usecases");
  const { listKelas } = await import("@/lib/application/kelas.usecases");
  const { listRuangan } = await import("@/lib/application/ruangan.usecases");
  if (kind === "guru") return listGuru(supabase);
  if (kind === "mata_pelajaran") return listMataPelajaran(supabase);
  if (kind === "kelas") return listKelas(supabase);
  return listRuangan(supabase);
}

function formatActivityTime(value: string) {
  const d = new Date(value);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(d);
}
