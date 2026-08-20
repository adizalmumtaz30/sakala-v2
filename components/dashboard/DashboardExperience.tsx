"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Bell, CalendarDays, CheckCircle2,
  ChevronRight, Clock3, FileUp, Lightbulb, MoreHorizontal, ShieldCheck,
  Sparkles, Upload, UserPlus, Users, Wand2,
} from "lucide-react";
import type { DashboardKeyMetrics, DashboardJpInsight, DashboardWorkloadEntry } from "@/lib/application/dashboard.usecases";
import type { DashboardActivityEntry, DashboardAgendaEntry, DashboardHeatmapDay } from "@/lib/application/dashboard.intelligence";

type GuruLite = { id: string; namaGuru: string; jenisKelamin?: "L" | "P" };
type AvatarSize = "xs" | "sm" | "md" | "lg";

const panel = "rounded-[20px] border border-border/70 bg-surface shadow-[0_1px_2px_rgba(15,23,42,.025)]";
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35";

function Avatar({ name, size = "md" }: { name?: string | null; size?: AvatarSize }) {
  const safeName = (name ?? "Guru").trim() || "Guru";
  const initials = safeName.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "G";
  const cls: Record<AvatarSize, string> = { xs: "h-5 w-5 text-[7px]", sm: "h-6 w-6 text-[8px]", md: "h-7 w-7 text-[9px]", lg: "h-8 w-8 text-[10px]" };
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full border border-brand-600/10 bg-brand-50 font-bold text-brand-700 ${cls[size]}`}>{initials}</span>;
}

function Section({ title, description, href, children, icon }: { title: string; description?: string; href?: string; children: ReactNode; icon?: ReactNode }) {
  return <section className={`${panel} min-w-0 p-4 sm:p-[18px]`}>
    <div className="mb-3.5 flex items-start justify-between gap-3">
      <div className="min-w-0"><div className="flex items-center gap-2"><span className="text-brand-600">{icon}</span><h2 className="text-[13px] font-semibold tracking-[-.01em] text-ink-900">{title}</h2></div>{description && <p className="mt-1 text-[10px] leading-4 text-ink-400">{description}</p>}</div>
      {href && <Link href={href} className={`group shrink-0 text-[10.5px] font-semibold text-brand-600 ${focusRing}`}>Lihat <ChevronRight size={12} className="inline transition-transform duration-200 group-hover:translate-x-0.5" /></Link>}
    </div>
    {children}
  </section>;
}

function KpiCard({ label, value, meta, href, icon, tone = "brand" }: { label: string; value: number | string; meta: string; href: string; icon: ReactNode; tone?: "brand" | "emerald" | "amber" | "violet" }) {
  const toneClass = { brand: "bg-brand-50 text-brand-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", violet: "bg-violet-50 text-violet-700" }[tone];
  return <Link href={href} className={`group ${panel} flex min-w-0 items-center gap-3 p-3.5 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-brand-600/15 hover:shadow-[0_8px_24px_rgba(15,23,42,.055)] ${focusRing}`}>
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${toneClass}`}>{icon}</span>
    <span className="min-w-0 flex-1"><span className="block truncate text-[9.5px] font-medium text-ink-400">{label}</span><strong className="mt-0.5 block text-[22px] font-bold leading-none tracking-[-.025em] tabular-nums text-ink-900 group-hover:text-brand-700">{value}</strong><span className="mt-1 block truncate text-[8.5px] text-ink-400">{meta}</span></span>
  </Link>;
}

function LineChart({ days }: { days: DashboardHeatmapDay[] }) {
  const max = Math.max(...days.map((d) => d.total), 1);
  const width = 700, height = 190, padX = 20, padY = 22;
  const points = days.map((d, i) => ({ x: days.length <= 1 ? width / 2 : padX + (i * (width - padX * 2)) / Math.max(days.length - 1, 1), y: height - padY - (d.total / max) * (height - padY * 2), d }));
  const path = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return <div className="relative h-[205px] overflow-hidden rounded-[16px] bg-surface-muted/35 px-2 pt-2">
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[178px] w-full" role="img" aria-label="Distribusi JP committed per hari">
      {[0.25, 0.5, 0.75, 1].map((ratio) => <line key={ratio} x1={padX} x2={width - padX} y1={height - padY - ratio * (height - padY * 2)} y2={height - padY - ratio * (height - padY * 2)} stroke="currentColor" className="text-border/60" strokeWidth="1" />)}
      <path d={path} fill="none" stroke="currentColor" className="text-brand-600" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.map(({ x, y, d }) => <circle key={d.day} cx={x} cy={y} r="5" fill="currentColor" className="text-brand-600" />)}
    </svg>
    <div className="absolute inset-x-4 bottom-2 flex justify-between text-[9px] font-semibold text-ink-400">{days.map((d) => <Link key={d.day} href={`/analitik?day=${encodeURIComponent(d.day)}`} className={`rounded px-1.5 hover:text-brand-600 ${focusRing}`}>{d.label.slice(0, 3)}</Link>)}</div>
    <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-border/70 bg-surface/90 px-2 py-1 text-[8px] font-medium text-ink-400">JP committed</div>
  </div>;
}

function Donut({ insight }: { insight: DashboardJpInsight }) {
  const total = Math.max(insight.totalKombinasi, 1);
  const done = insight.countByStatus.penuh + insight.countByStatus.lebih;
  const partial = insight.countByStatus.sebagian;
  const empty = insight.countByStatus.kosong;
  const a = (done / total) * 360;
  const b = ((done + partial) / total) * 360;
  const bg = `conic-gradient(var(--brand-600) 0deg ${a}deg, #f59e0b ${a}deg ${b}deg, #e5e7eb ${b}deg 360deg)`;
  return <div className="flex items-center gap-5">
    <div className="relative h-[118px] w-[118px] shrink-0 rounded-full p-[11px] transition-transform duration-200 hover:scale-[1.015]" style={{ background: bg }}>
      <Link href="/pembagian-mengajar/target-jp?status=penuh" aria-label={`Target JP terpenuhi ${insight.completionPercent}%`} className={`flex h-full w-full items-center justify-center rounded-full bg-surface text-center ${focusRing}`}>
        <span><strong className="block text-[24px] leading-none tabular-nums text-ink-900">{insight.completionPercent}%</strong><small className="mt-1 block text-[8px] text-ink-400">terpenuhi</small></span>
      </Link>
    </div>
    <div className="min-w-0 flex-1 space-y-1.5 text-[10px]">
      {["penuh", "sebagian", "kosong"].map((status) => {
        const count = status === "penuh" ? done : status === "sebagian" ? partial : empty;
        return <Link key={status} href={`/pembagian-mengajar/target-jp?status=${status}`} className={`flex items-center justify-between gap-3 rounded-[10px] px-2 py-1.5 hover:bg-surface-muted ${focusRing}`}><span className="flex items-center gap-2 text-ink-500"><i className={`h-2 w-2 rounded-full ${status === "penuh" ? "bg-brand-600" : status === "sebagian" ? "bg-amber-500" : "bg-slate-300"}`} />{status === "penuh" ? "Terpenuhi" : status === "sebagian" ? "Belum lengkap" : "Belum mulai"}</span><b className="tabular-nums text-ink-800">{count}</b></Link>;
      })}
    </div>
  </div>;
}

function MiniCalendar() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const calendar = useMemo(() => {
    const date = now ?? new Date(2026, 7, 20);
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const start = (first.getDay() + 6) % 7;
    return { date, days, start };
  }, [now]);
  const cells = Array.from({ length: 42 }, (_, i) => i - calendar.start + 1);
  const month = calendar.date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  return <div><div className="mb-3 flex items-center justify-between"><span className="text-[11px] font-semibold capitalize text-ink-800">{month}</span><Link href="/jadwal" className={`text-[9px] font-semibold text-brand-600 ${focusRing}`}>Jadwal</Link></div><div className="mb-1 grid grid-cols-7 text-center text-[7.5px] font-bold uppercase tracking-wide text-ink-400">{["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"].map((d) => <span key={d}>{d}</span>)}</div><div className="grid grid-cols-7 gap-y-1 text-center text-[9px] text-ink-600">{cells.map((day, i) => day > 0 && day <= calendar.days ? <span key={i} className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full ${day === calendar.date.getDate() ? "bg-brand-600 font-bold text-white shadow-sm" : "hover:bg-brand-50"}`}>{day}</span> : <span key={i} className="h-6" />)}</div></div>;
}

function ActivityList({ activity }: { activity: DashboardActivityEntry[] }) {
  return <div className="space-y-2.5">{activity.slice(0, 4).map((a) => <Link key={a.id} href="/riwayat" className={`group flex items-start gap-2.5 rounded-[11px] px-1 py-1 ${focusRing}`}><span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Activity size={11} /></span><span className="min-w-0"><span className="block truncate text-[9.5px] font-medium text-ink-800 group-hover:text-brand-700">{a.action}</span><time className="mt-0.5 block text-[8px] text-ink-400">{new Date(a.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}</time></span></Link>)}</div>;
}

function AgendaList({ agenda, guruList, academicPeriod }: { agenda: DashboardAgendaEntry[]; guruList: GuruLite[]; academicPeriod: string | null }) {
  const periodLabel = academicPeriod?.trim() || "Periode Akademik belum aktif";
  return <div className="space-y-1">{agenda.slice(0, 4).map((e) => {
    const teacher = e.teacher?.trim() || "Guru belum teridentifikasi";
    const g = e.teacherId ? guruList.find((item) => item.id === e.teacherId) : undefined;
    const subject = e.subject?.trim() || "Mata pelajaran belum teridentifikasi";
    const room = e.room?.trim();
    return <Link key={e.id} href={`/jadwal?assignment=${encodeURIComponent(e.id)}`} aria-label={`${subject} · ${teacher} · ${periodLabel}`} className={`group flex items-center gap-2 rounded-[11px] px-1.5 py-2 hover:bg-surface-muted ${focusRing}`}>
      <span className="w-[42px] shrink-0 text-[8.5px] font-bold tabular-nums text-brand-600">{e.time}</span>
      <Avatar name={g?.namaGuru ?? teacher} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[9.5px] font-semibold text-ink-900 group-hover:text-brand-700">{subject}</span>
        <span className="block truncate text-[7.8px] text-ink-400">{periodLabel}{room ? ` · ${room}` : ""}</span>
      </span>
    </Link>;
  })}</div>;
}

function ActionDock() {
  const actions = [
    ["Tambah Guru", "/guru", UserPlus],
    ["Generate Jadwal", "/jadwal-cerdas", Wand2],
    ["Validasi Jadwal", "/jadwal", ShieldCheck],
    ["Lihat Konflik", "/jadwal-cerdas", AlertTriangle],
    ["Import Data", "/navigasi", Upload],
  ] as const;
  return <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3"><nav aria-label="Aksi cepat Dashboard" className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-[18px] border border-border/80 bg-surface/95 p-1.5 shadow-[0_14px_38px_rgba(15,23,42,.14)] backdrop-blur-xl">{actions.map(([label, href, Icon]) => <Link key={label} href={href} title={label} className={`group flex shrink-0 items-center gap-1.5 rounded-[12px] px-2.5 py-2 text-[9px] font-semibold text-ink-600 transition-colors duration-200 hover:bg-brand-50 hover:text-brand-700 ${focusRing}`}><Icon size={13} /><span className="hidden sm:inline">{label}</span></Link>)}<Link href="/notifikasi" title="Notifikasi" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-brand-600 text-white shadow-sm transition-transform duration-200 hover:scale-[1.03] ${focusRing}`}><Bell size={14} /></Link><Link href="/analitik" title="More" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] text-ink-500 hover:bg-surface-muted ${focusRing}`}><MoreHorizontal size={15} /></Link></nav></div>;
}

export default function DashboardExperience({ schoolName, context, metrics, jpInsight, workload, heatmap, agenda, activity, guruList }: { schoolName: string; context: string | null; metrics: DashboardKeyMetrics; jpInsight: DashboardJpInsight; workload: DashboardWorkloadEntry[]; heatmap: DashboardHeatmapDay[]; agenda: DashboardAgendaEntry[]; activity: DashboardActivityEntry[]; guruList: GuruLite[] }) {
  const totalJtm = metrics.totalJadwalCommitted;
  const peak = heatmap.reduce((best, d) => d.total > best.total ? d : best, heatmap[0] ?? { day: "", label: "—", total: 0 });
  const average = heatmap.length ? Math.round(totalJtm / heatmap.length) : 0;
  const topTeacher = workload[0];
  return <>
    <main className="mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-[1480px] flex-col gap-4 px-3 pb-24 pt-4 sm:px-5 lg:gap-5 lg:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><p className="mb-1 text-[9px] font-bold uppercase tracking-[.16em] text-brand-600">{context ?? "Konteks akademik belum aktif"}</p><h1 className="text-[27px] font-semibold leading-none tracking-[-.035em] text-ink-900">Dashboard</h1><p className="mt-1.5 text-[11px] text-ink-500">Satu ruang kerja untuk membaca kondisi akademik <span className="font-semibold text-ink-700">{schoolName}</span>.</p></div><div className="flex items-center gap-2"><Link href="/notifikasi" className={`relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink-500 hover:text-brand-600 ${focusRing}`} aria-label="Notifikasi"><Bell size={15} />{activity.length > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand-600" />}</Link><Link href="/analitik" className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-[10px] font-semibold text-ink-600 shadow-sm hover:border-brand-600/20 hover:text-brand-700 ${focusRing}`}>Buka Analitik <ArrowRight size={12} /></Link></div></header>
      <section aria-label="Ringkasan utama" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Jadwal aktif" value={metrics.totalJadwalCommitted} meta="JP committed" href="/jadwal" icon={<CalendarDays size={17} />} />
        <KpiCard label="Guru aktif" value={metrics.totalGuruAktif} meta="tenaga pengajar" href="/guru" icon={<Users size={17} />} tone="emerald" />
        <KpiCard label="Kelas" value={metrics.totalKelas} meta="rombongan belajar" href="/kelas" icon={<Users size={17} />} tone="violet" />
        <KpiCard label="Ruangan" value={metrics.totalRuangan} meta="ruang terdata" href="/ruangan" icon={<ShieldCheck size={17} />} tone="amber" />
        <KpiCard label="Pembagian" value={metrics.totalPembagianMengajarAktif} meta="aktif" href="/pembagian-mengajar" icon={<Activity size={17} />} />
        <KpiCard label="Target JP" value={`${jpInsight.completionPercent}%`} meta="tingkat terpenuhi" href="/pembagian-mengajar/target-jp" icon={<CheckCircle2 size={17} />} tone="emerald" />
      </section>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_315px] xl:gap-5">
        <div className="min-w-0 space-y-4 lg:space-y-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,.8fr)]"><Section title="Distribusi Jadwal" description="Rekap JP committed per hari dalam konteks akademik aktif." href="/analitik" icon={<Activity size={14} />}><LineChart days={heatmap} /></Section><Section title="Target JP" description="Kesehatan pembagian mengajar." href="/pembagian-mengajar/target-jp" icon={<CheckCircle2 size={14} />}><Donut insight={jpInsight} /></Section></div>
          <div className="grid gap-4 md:grid-cols-3">
            <Section title="Rekap JTM" description="Jam tatap muka committed." href="/analitik" icon={<Clock3 size={14} />}><div className="flex items-end justify-between"><div><strong className="text-[31px] font-bold leading-none tracking-[-.03em] tabular-nums text-ink-900">{totalJtm}</strong><span className="ml-1.5 text-[10px] text-ink-400">JP</span></div><span className="rounded-full bg-brand-50 px-2 py-1 text-[8px] font-bold text-brand-700">Aktif</span></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-[12px] bg-surface-muted/70 p-2"><b className="block text-[13px] tabular-nums text-ink-800">{average}</b><span className="text-[8px] text-ink-400">rata-rata/hari</span></div><div className="rounded-[12px] bg-surface-muted/70 p-2"><b className="block text-[13px] tabular-nums text-ink-800">{peak.total}</b><span className="text-[8px] text-ink-400">puncak · {peak.label?.slice(0, 3)}</span></div></div></Section>
            <Section title="Beban Guru" description="Distribusi guru dengan JP tertinggi." href="/guru" icon={<Users size={14} />}><div className="space-y-2.5">{workload.slice(0, 3).map((e, i) => <Link key={e.guruId} href={`/guru?teacher=${encodeURIComponent(e.guruId)}`} className={`group flex items-center gap-2 ${focusRing}`}><span className="w-3 text-[8px] font-bold text-ink-400">0{i + 1}</span><Avatar name={e.namaGuru} size="sm" /><span className="min-w-0 flex-1 truncate text-[9.5px] font-medium text-ink-800 group-hover:text-brand-700">{e.namaGuru}</span><span className="text-[9px] font-bold tabular-nums text-ink-800">{e.totalJamMengajar}</span></Link>)}</div></Section>
            <Section title="Beban Tertinggi" description="Sinyal yang layak diperhatikan." href="/analitik" icon={<Lightbulb size={14} />}><div className="rounded-[13px] bg-brand-50/70 p-3"><p className="text-[10.5px] font-semibold leading-4 text-ink-900">{topTeacher?.namaGuru ? `${topTeacher.namaGuru} memiliki beban JP tertinggi.` : "Jadwal akademik siap dianalisis."}</p><p className="mt-1 text-[8.5px] leading-4 text-ink-500">{topTeacher ? `${topTeacher.totalJamMengajar} JP pada konteks aktif.` : "Belum ada data beban guru."}</p><Link href="/analitik" className={`mt-2 inline-flex items-center gap-1 text-[9px] font-semibold text-brand-600 ${focusRing}`}>Lihat analitik <ArrowRight size={10} /></Link></div></Section>
          </div>
        </div>
        <aside className="min-w-0 space-y-4 lg:space-y-5" aria-label="Informasi pendukung Dashboard"><Section title="Kalender" description="Navigasi cepat ke jadwal." icon={<CalendarDays size={14} />}><MiniCalendar /></Section><Section title="Agenda Hari Ini" description="Jadwal terdekat dari periode akademik aktif." href="/jadwal" icon={<Clock3 size={14} />}><AgendaList agenda={agenda} guruList={guruList} academicPeriod={context} /></Section><Section title="Notifikasi Terbaru" description="Sinyal dan perubahan terakhir." href="/notifikasi" icon={<Bell size={14} />}><ActivityList activity={activity} /></Section></aside>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><Section title="Aktivitas Terbaru" description="Jejak perubahan pada konteks akademik aktif." href="/riwayat" icon={<Activity size={14} />}><ActivityList activity={activity} /></Section><Section title="Aksi Utama" description="Masuk ke alur kerja yang paling sering digunakan." icon={<Sparkles size={14} />}><div className="grid grid-cols-2 gap-2"><Link href="/jadwal-cerdas" className={`flex items-center gap-2 rounded-[12px] border border-border bg-surface-muted/45 p-2.5 text-[9px] font-semibold text-ink-700 hover:border-brand-600/15 hover:text-brand-700 ${focusRing}`}><Wand2 size={13} />Generate Jadwal</Link><Link href="/guru" className={`flex items-center gap-2 rounded-[12px] border border-border bg-surface-muted/45 p-2.5 text-[9px] font-semibold text-ink-700 hover:border-brand-600/15 hover:text-brand-700 ${focusRing}`}><UserPlus size={13} />Tambah Guru</Link><Link href="/navigasi" className={`flex items-center gap-2 rounded-[12px] border border-border bg-surface-muted/45 p-2.5 text-[9px] font-semibold text-ink-700 hover:border-brand-600/15 hover:text-brand-700 ${focusRing}`}><FileUp size={13} />Import Data</Link><Link href="/analitik" className={`flex items-center gap-2 rounded-[12px] border border-border bg-surface-muted/45 p-2.5 text-[9px] font-semibold text-ink-700 hover:border-brand-600/15 hover:text-brand-700 ${focusRing}`}><Activity size={13} />Analitik</Link></div></Section></div>
    </main>
    <ActionDock />
  </>;
}
