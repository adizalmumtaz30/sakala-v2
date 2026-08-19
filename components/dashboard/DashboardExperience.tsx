"use client";

import Link from "next/link";
import { Activity, ArrowRight, CalendarDays, ChevronRight, Clock3, Lightbulb, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { DashboardKeyMetrics, DashboardJpInsight, DashboardWorkloadEntry } from "@/lib/application/dashboard.usecases";
import type { DashboardActivityEntry, DashboardAgendaEntry, DashboardHeatmapDay } from "@/lib/application/dashboard.intelligence";

type GuruLite = { id: string; namaGuru: string; jenisKelamin?: "L" | "P" };
type AvatarSize = "xs" | "sm" | "md" | "lg";

function Avatar({ name, size = "md" }: { name?: string | null; size?: AvatarSize }) {
  const safeName = (name ?? "Guru").trim() || "Guru";
  const initials = safeName.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "G";
  const cls: Record<AvatarSize, string> = { xs: "h-5 w-5 text-[7px]", sm: "h-6 w-6 text-[8px]", md: "h-7 w-7 text-[9px]", lg: "h-8 w-8 text-[10px]" };
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full border border-brand-600/10 bg-brand-50 font-bold text-brand-700 ${cls[size]}`}>{initials}</span>;
}

function Section({ title, description, href, children, icon }: { title: string; description?: string; href?: string; children: ReactNode; icon?: ReactNode }) {
  return <section className="rounded-[18px] border border-border/70 bg-surface/95 p-4 shadow-[0_1px_2px_rgba(15,23,42,.03)] sm:p-[18px]">
    <div className="mb-3.5 flex items-start justify-between gap-3">
      <div className="min-w-0"><div className="flex items-center gap-2"><span className="text-brand-600">{icon}</span><h2 className="text-[13px] font-semibold tracking-[-.01em] text-ink-900">{title}</h2></div>{description && <p className="mt-1 text-[10px] leading-4 text-ink-400">{description}</p>}</div>
      {href && <Link href={href} className="group shrink-0 text-[10.5px] font-semibold text-brand-600">Lihat <ChevronRight size={12} className="inline transition-transform group-hover:translate-x-0.5" /></Link>}
    </div>
    {children}
  </section>;
}

function LineChart({ days }: { days: DashboardHeatmapDay[] }) {
  const max = Math.max(...days.map((d) => d.total), 1);
  const width = 620, height = 145, pad = 18;
  const points = days.map((d, i) => ({ x: days.length <= 1 ? width / 2 : pad + (i * (width - pad * 2)) / Math.max(days.length - 1, 1), y: height - pad - (d.total / max) * (height - pad * 2), d }));
  const path = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return <div className="relative h-[164px] w-full overflow-hidden rounded-xl bg-surface-muted/45 px-1 pt-1">
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[142px] w-full" role="img" aria-label="Distribusi JP committed per hari">
      <path d={`M ${pad} ${height - pad} H ${width - pad}`} stroke="currentColor" className="text-border" strokeWidth="1" />
      <path d={path} fill="none" stroke="currentColor" className="text-brand-600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map(({ x, y, d }) => <circle key={d.day} cx={x} cy={y} r="4.5" fill="currentColor" className="text-brand-600" />)}
    </svg>
    <div className="absolute inset-x-4 bottom-1 flex justify-between text-[9px] font-medium text-ink-400">{days.map((d) => <Link key={d.day} href={`/analitik?day=${encodeURIComponent(d.day)}`} className="rounded px-1 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">{d.label.slice(0, 3)}</Link>)}</div>
    <div className="absolute inset-0 grid grid-cols-6" aria-label="Buka analitik per hari">{days.map((d) => <Link key={d.day} href={`/analitik?day=${encodeURIComponent(d.day)}`} aria-label={`Buka analitik ${d.label}: ${d.total} JP`} title={`${d.label}: ${d.total} JP`} className="rounded-xl focus-visible:ring-2 focus-visible:ring-brand-500/40" />)}</div>
    <div className="pointer-events-none absolute left-3 top-2 rounded-lg border border-border/70 bg-surface/95 px-2 py-1 text-[8.5px] text-ink-500 shadow-sm">Klik area hari untuk membuka Analitik</div>
  </div>;
}

function Donut({ insight }: { insight: DashboardJpInsight }) {
  const total = Math.max(insight.totalKombinasi, 1);
  const done = insight.countByStatus.penuh + insight.countByStatus.lebih;
  const partial = insight.countByStatus.sebagian;
  const empty = insight.countByStatus.kosong;
  const a = (done / total) * 360;
  const b = ((done + partial) / total) * 360;
  const bg = "conic-gradient(var(--brand-600) 0deg " + a + "deg, #f59e0b " + a + "deg " + b + "deg, #e5e7eb " + b + "deg 360deg)";
  return <div className="flex items-center gap-5">
    <div className="relative h-28 w-28 shrink-0 rounded-full p-[11px] transition-transform hover:scale-[1.02]" style={{ background: bg }}>
      <Link href="/pembagian-mengajar/target-jp?status=penuh" aria-label={`Buka Target JP terpenuhi ${insight.completionPercent}%`} className="flex h-full w-full items-center justify-center rounded-full bg-surface text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
        <span><strong className="block text-[23px] leading-none tabular-nums text-ink-900">{insight.completionPercent}%</strong><small className="mt-1 block text-[8px] text-ink-400">terpenuhi</small></span>
      </Link>
    </div>
    <div className="min-w-0 flex-1 space-y-2 text-[10px]">
      <Link href="/pembagian-mengajar/target-jp?status=penuh" className="flex justify-between gap-3 rounded px-1 hover:bg-brand-50 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500/40"><span>Terpenuhi</span><b className="tabular-nums">{done}</b></Link>
      <Link href="/pembagian-mengajar/target-jp?status=sebagian" className="flex justify-between gap-3 rounded px-1 hover:bg-amber-50 hover:text-amber-700 focus-visible:ring-2 focus-visible:ring-brand-500/40"><span>Belum lengkap</span><b className="tabular-nums">{partial}</b></Link>
      <Link href="/pembagian-mengajar/target-jp?status=kosong" className="flex justify-between gap-3 rounded px-1 hover:bg-slate-50 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-500/40"><span>Belum mulai</span><b className="tabular-nums">{empty}</b></Link>
    </div>
  </div>;
}

function Metric({ label, value, href }: { label: string; value: number; href: string }) {
  return <Link href={href} className="group min-w-[58px] border-l border-border/70 pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"><span className="block text-[17px] font-bold leading-none tabular-nums text-ink-900 group-hover:text-brand-600">{value}</span><span className="mt-1 block text-[9px] text-ink-400">{label}</span></Link>;
}

function Pulse({ metrics }: { metrics: DashboardKeyMetrics }) {
  return <div className="rounded-[20px] border border-brand-600/10 bg-[linear-gradient(135deg,rgba(37,99,235,.055),rgba(255,255,255,.9))] px-5 py-4 shadow-[0_8px_28px_rgba(15,23,42,.045)]">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-brand-600">Academic Pulse</p><div className="mt-1.5 flex items-baseline gap-2"><strong className="text-[34px] font-bold leading-none tracking-[-.035em] tabular-nums text-ink-900">{metrics.totalJadwalCommitted}</strong><span className="text-[11px] font-medium text-ink-500">JP committed</span></div><p className="mt-1 text-[10px] text-ink-400">Jadwal aktif sebagai sumber utama operasional.</p></div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4"><Metric label="Guru" value={metrics.totalGuruAktif} href="/guru" /><Metric label="Kelas" value={metrics.totalKelas} href="/kelas" /><Metric label="Ruangan" value={metrics.totalRuangan} href="/ruangan" /><Metric label="Pembagian" value={metrics.totalPembagianMengajarAktif} href="/pembagian-mengajar" /></div>
    </div>
  </div>;
}

export default function DashboardExperience({ schoolName, context, metrics, jpInsight, workload, heatmap, agenda, activity, guruList }: { schoolName: string; context: string | null; metrics: DashboardKeyMetrics; jpInsight: DashboardJpInsight; workload: DashboardWorkloadEntry[]; heatmap: DashboardHeatmapDay[]; agenda: DashboardAgendaEntry[]; activity: DashboardActivityEntry[]; guruList: GuruLite[] }) {
  const guruByName = new Map(guruList.map((g) => [g.namaGuru, g]));
  return <main className="mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-[1440px] flex-col gap-3 px-2 pb-4 pt-3 sm:px-3 lg:gap-3.5">
    <header className="flex items-end justify-between gap-4 px-1"><div className="min-w-0"><p className="mb-1 text-[9px] font-bold uppercase tracking-[.14em] text-brand-600">{context ?? "Konteks akademik belum aktif"}</p><h1 className="text-[25px] font-semibold leading-none tracking-[-.03em] text-ink-900">Dashboard</h1><p className="mt-1.5 text-[11px] text-ink-500">Kondisi akademik <span className="font-semibold text-ink-700">{schoolName}</span> dalam satu pandangan.</p></div><Link href="/analitik" className="hidden items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-[10px] font-semibold text-ink-600 shadow-sm hover:border-brand-600/25 hover:text-brand-700 sm:flex">Analitik <ArrowRight size={12} /></Link></header>
    <Pulse metrics={metrics} />
    <div className="grid min-h-0 gap-3 lg:grid-cols-[1.5fr_.72fr]"><Section title="Tren Jadwal" description="Distribusi JP committed per hari · klik titik/area untuk membuka analitik." href="/analitik" icon={<Activity size={14} />}><LineChart days={heatmap} /></Section><Section title="Target JP" description="Kesehatan pembagian mengajar." href="/pembagian-mengajar/target-jp" icon={<span className="text-[12px]">◔</span>}><Donut insight={jpInsight} /></Section></div>
    <div className="grid min-h-0 gap-3 lg:grid-cols-[1.08fr_.92fr_1fr]">
      <Section title="Kepadatan Jadwal" description="Puncak minggu ini." href="/jadwal" icon={<CalendarDays size={14} />}><div className="grid grid-cols-6 gap-2">{heatmap.map((d) => <Link key={d.day} href={`/jadwal?day=${encodeURIComponent(d.day)}`} aria-label={`Buka jadwal ${d.label}: ${d.total} JP`} className="group text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"><div className={`flex h-11 items-center justify-center rounded-xl border border-border/60 ${d.total === 0 ? "bg-surface-muted" : "bg-brand-50"} transition-all hover:-translate-y-0.5 hover:border-brand-600/25 hover:bg-brand-100`}><span className="text-[13px] font-bold tabular-nums text-ink-800">{d.total}</span></div><span className="mt-1 block text-[8px] font-semibold text-ink-400">{d.label.slice(0, 3)}</span></Link>)}</div></Section>
      <Section title="Insight" description="Sinyal yang layak diperhatikan." href="/analitik" icon={<Lightbulb size={14} />}><Link href="/analitik" className="group block rounded-xl bg-brand-50/60 p-3 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"><p className="text-[11px] font-semibold leading-4 text-ink-900">{workload[0]?.namaGuru ? `${workload[0].namaGuru} memiliki beban JP tertinggi.` : "Jadwal akademik siap dianalisis."}</p><p className="mt-1 text-[9.5px] leading-4 text-ink-500">Buka Analitik untuk melihat distribusi dan pola yang lebih lengkap.</p><span className="mt-2 inline-flex items-center gap-1 text-[9.5px] font-semibold text-brand-600">Analisis <ArrowRight size={11} /></span></Link></Section>
      <Section title="Aktivitas Terbaru" description="Perubahan terakhir pada konteks aktif." href="/riwayat" icon={<Clock3 size={14} />}><div className="space-y-2.5">{activity.slice(0, 4).map((a) => { const isGuru = a.entityType.toLowerCase().replace(/[- ]+/g, "_") === "guru"; const guru = isGuru && a.entityLabel ? guruByName.get(a.entityLabel) : undefined; return <Link key={a.id} href="/riwayat" className="group flex items-start gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">{isGuru ? <Avatar name={a.entityLabel} size="sm" /> : <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600/70" />}<div className="min-w-0"><p className="truncate text-[10px] font-medium text-ink-800 group-hover:text-brand-700">{a.action}</p><time className="text-[8.5px] text-ink-400">{new Date(a.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}</time></div></Link>; })}</div></Section>
    </div>
    <div className="grid min-h-0 gap-3 lg:grid-cols-[1.35fr_1fr]">
      <Section title="Agenda Mendatang" description="Jadwal terdekat dari konteks aktif." href="/jadwal" icon={<Clock3 size={14} />}><div className="grid gap-x-4 sm:grid-cols-2">{agenda.slice(0, 4).map((e) => { const teacher = e.teacher?.trim() || "Guru"; const className = e.className?.trim() || "Kelas"; const g = e.teacherId ? guruList.find((item) => item.id === e.teacherId) : guruByName.get(teacher); return <Link key={e.id} href={`/jadwal?assignment=${encodeURIComponent(e.id)}`} aria-label={`${e.subject} · ${teacher} · ${className}`} className="group flex items-center gap-2.5 border-b border-border/50 py-2 last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"><span className="w-[50px] shrink-0 text-[9px] font-bold tabular-nums text-brand-600">{e.time}</span><Avatar name={g?.namaGuru ?? teacher} size="md" /><span className="min-w-0 flex-1"><span className="block truncate text-[10.5px] font-semibold text-ink-900 group-hover:text-brand-700">{e.subject?.trim() || "Mata pelajaran"}</span><span className="block truncate text-[8.5px] text-ink-400">{className} · {teacher}{e.room ? ` · ${e.room}` : ""}</span></span><ChevronRight size={11} className="text-ink-300 group-hover:text-brand-600" /></Link>; })}</div></Section>
      <Section title="Beban Mengajar" description="Guru dengan JP tertinggi." href="/guru" icon={<Users size={14} />}><div className="space-y-2">{workload.slice(0, 4).map((e) => <Link key={e.guruId} href={`/guru?teacher=${encodeURIComponent(e.guruId)}`} aria-label={`${e.namaGuru}: ${e.totalJamMengajar} JP`} className="group flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"><Avatar name={e.namaGuru} size="md" /><span className="min-w-0 flex-1 truncate text-[10px] font-medium text-ink-800 group-hover:text-brand-700">{e.namaGuru}</span><span className="text-[10px] font-bold tabular-nums text-ink-800">{e.totalJamMengajar} JP</span></Link>)}</div></Section>
    </div>
  </main>;
}