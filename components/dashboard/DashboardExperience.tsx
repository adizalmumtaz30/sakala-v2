"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, ArrowRight, Bell, BookOpen, CalendarCheck2, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, DoorOpen, Info, AlertTriangle, Layers, Lightbulb, Plus, Sparkles, ShieldCheck, Upload, MoreHorizontal, Search, Users, X } from "lucide-react";
import type { ReactNode } from "react";
import type { DashboardKeyMetrics, DashboardJpInsight, DashboardWorkloadEntry } from "@/lib/application/dashboard.usecases";
import type { DashboardActivityEntry, DashboardAgendaEntry, DashboardHeatmapDay, DashboardHeatmapGridDay, DashboardBebanDistribution, DashboardWorkloadFullEntry } from "@/lib/application/dashboard.intelligence";
import type { NotificationEntry } from "@/lib/application/notifications.usecases";
import type { HariSekolah } from "@/lib/domain/jamPelajaran";

import PremiumAvatar from "@/components/ui/Avatar";

type GuruLite = { id: string; namaGuru: string; kodeGuru?: string; jenisKelamin?: "L" | "P" };
type AvatarSize = "xs" | "sm" | "md" | "lg";
type JtmMode = "hari" | "minggu" | "bulan" | "semester";

function Avatar({ name, size = "md", kodeGuru, jenisKelamin }: { name?: string | null; size?: AvatarSize; kodeGuru?: string; jenisKelamin?: "L" | "P" }) {
  const safeName = (name ?? "Guru").trim() || "Guru";
  if (kodeGuru && jenisKelamin) return <PremiumAvatar name={safeName} size={size === "xs" ? "sm" : size} jenisKelamin={jenisKelamin} kodeGuru={kodeGuru} />;
  const initials = safeName.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "G";
  const cls: Record<AvatarSize, string> = { xs: "h-5 w-5 text-[7px]", sm: "h-6 w-6 text-[8px]", md: "h-7 w-7 text-[9px]", lg: "h-8 w-8 text-[10px]" };
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full border border-brand-600/10 bg-brand-50 font-bold text-brand-700 ${cls[size]}`}>{initials}</span>;
}

function Section({ title, description, href, children, icon, badge, className }: { title: string; description?: string; href?: string; children: ReactNode; icon?: ReactNode; badge?: ReactNode; className?: string }) {
  return <section className={`rounded-[18px] border border-border/70 bg-surface/95 p-4 shadow-[0_1px_2px_rgba(15,23,42,.03)] sm:p-[18px] ${className ?? ""}`}>
    <div className="mb-3.5 flex items-start justify-between gap-3">
      <div className="min-w-0"><div className="flex items-center gap-2"><span className="text-brand-600">{icon}</span><h2 className="text-[13px] font-semibold tracking-[-.01em] text-ink-900">{title}</h2>{badge}</div>{description && <p className="mt-1 text-[10px] leading-4 text-ink-400">{description}</p>}</div>
      {href && <Link href={href} className="group shrink-0 text-[10.5px] font-semibold text-brand-600">Lihat <ChevronRight size={12} className="inline transition-transform group-hover:translate-x-0.5" /></Link>}
    </div>
    {children}
  </section>;
}

const BEBAN_STYLE: Record<"ringan" | "normal" | "berat", { label: string; badge: string; dot: string }> = {
  ringan: { label: "Ringan", badge: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  normal: { label: "Normal", badge: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  berat: { label: "Berat", badge: "border-rose-200 bg-rose-50 text-rose-700", dot: "bg-rose-500" },
};

function KpiCard({ label, value, suffix, icon, href }: { label: string; value: number; suffix?: string; icon: ReactNode; href: string }) {
  return <Link href={href} className="group flex items-center gap-3 rounded-[16px] border border-border/70 bg-surface/95 px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,.03)] transition-all hover:-translate-y-0.5 hover:border-brand-600/25 hover:shadow-[0_8px_20px_rgba(15,23,42,.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
    <span className="min-w-0">
      <span className="flex items-baseline gap-1"><strong className="text-[19px] font-bold leading-none tabular-nums text-ink-900 group-hover:text-brand-700">{value}</strong>{suffix && <span className="text-[9.5px] font-medium text-ink-400">{suffix}</span>}</span>
      <span className="mt-1 block truncate text-[9.5px] font-medium text-ink-400">{label}</span>
    </span>
  </Link>;
}

function KpiRow({ metrics }: { metrics: DashboardKeyMetrics }) {
  return <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
    <KpiCard label="Guru Aktif" value={metrics.totalGuruAktif} icon={<Users size={16} />} href="/guru" />
    <KpiCard label="Kelas" value={metrics.totalKelas} icon={<Layers size={16} />} href="/kelas" />
    <KpiCard label="Mata Pelajaran" value={metrics.totalMataPelajaranAktif} icon={<BookOpen size={16} />} href="/mata-pelajaran" />
    <KpiCard label="Ruangan" value={metrics.totalRuangan} icon={<DoorOpen size={16} />} href="/ruangan" />
    <KpiCard label="Total JTM" value={metrics.totalJtm} suffix="JP/minggu" icon={<Clock3 size={16} />} href="/analitik" />
    <KpiCard label="Jadwal Aktif" value={metrics.totalJadwalCommitted} icon={<CalendarCheck2 size={16} />} href="/jadwal" />
  </div>;
}

function yTicks(max: number): number[] {
  // 5 tick bulat (0..max) — dibulatkan ke kelipatan rapi supaya label tidak pecahan aneh.
  const step = Math.max(1, Math.ceil(max / 4 / 5) * 5);
  return [0, step, step * 2, step * 3, step * 4];
}

function LineChart({ days }: { days: DashboardHeatmapDay[] }) {
  const rawMax = Math.max(...days.map((d) => d.total), 1);
  const ticks = yTicks(rawMax);
  const max = Math.max(ticks[ticks.length - 1], rawMax, 1);
  const width = 620, height = 145, padL = 30, padR = 12, padY = 14;
  const plotW = width - padL - padR;
  const points = days.map((d, i) => ({ x: days.length <= 1 ? padL + plotW / 2 : padL + (i * plotW) / Math.max(days.length - 1, 1), y: height - padY - (d.total / max) * (height - padY * 2), d }));
  const path = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return <div className="relative h-[164px] w-full overflow-hidden rounded-xl bg-surface-muted/45 px-1 pt-1">
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[142px] w-full" role="img" aria-label="Distribusi JP committed per hari">
      {ticks.map((t) => {
        const y = height - padY - (t / max) * (height - padY * 2);
        return <g key={t}>
          <path d={`M ${padL} ${y.toFixed(1)} H ${width - padR}`} stroke="currentColor" className="text-border/60" strokeWidth="1" strokeDasharray={t === 0 ? undefined : "2 3"} />
          <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-ink-400" fontSize="8.5">{t}</text>
        </g>;
      })}
      <path d={path} fill="none" stroke="currentColor" className="text-brand-600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map(({ x, y, d }) => <circle key={d.day} cx={x} cy={y} r="4.5" fill="currentColor" className="text-brand-600" />)}
    </svg>
    <div className="absolute inset-x-0 bottom-1 flex justify-between px-[30px] text-[9px] font-medium text-ink-400">{days.map((d) => <Link key={d.day} href={`/analitik?day=${encodeURIComponent(d.day)}`} className="rounded px-1 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">{d.label.slice(0, 3)}</Link>)}</div>
    <div className="absolute inset-y-0 right-0" style={{ left: 30 }} aria-label="Buka analitik per hari">
      <div className="grid h-full grid-cols-6">{days.map((d) => <Link key={d.day} href={`/analitik?day=${encodeURIComponent(d.day)}`} aria-label={`Buka analitik ${d.label}: ${d.total} JP`} title={`${d.label}: ${d.total} JP`} className="rounded-xl focus-visible:ring-2 focus-visible:ring-brand-500/40" />)}</div>
    </div>
    <div className="pointer-events-none absolute right-3 top-2 rounded-lg border border-border/70 bg-surface/95 px-2 py-1 text-[8.5px] text-ink-500 shadow-sm">Klik area hari untuk membuka Analitik</div>
  </div>;
}

const JTM_MODES: { key: JtmMode; label: string }[] = [{ key: "hari", label: "Hari" }, { key: "minggu", label: "Minggu" }, { key: "bulan", label: "Bulan" }, { key: "semester", label: "Semester" }];

function RekapJtm({ heatmap }: { heatmap: DashboardHeatmapDay[] }) {
  const [mode, setMode] = useState<JtmMode>("minggu");
  const totalMinggu = heatmap.reduce((s, d) => s + d.total, 0);
  const busiestDay = heatmap.reduce((best, d) => (d.total > (best?.total ?? -1) ? d : best), heatmap[0]);
  return <div>
    <div className="mb-2 flex items-end justify-between gap-2">
      <div><strong className="text-[24px] font-bold leading-none tabular-nums text-ink-900">{totalMinggu}</strong><span className="ml-1 text-[10px] font-medium text-ink-400">JP minggu ini</span>
        {busiestDay && busiestDay.total > 0 && <p className="mt-1 text-[9.5px] text-ink-400">Puncak: <span className="font-semibold text-ink-600">{busiestDay.label}</span> ({busiestDay.total} JP)</p>}
      </div>
    </div>
    <div className="mb-3 flex gap-1 rounded-lg bg-surface-muted/60 p-0.5 text-[9.5px] font-semibold">
      {JTM_MODES.map((m) => <button key={m.key} type="button" onClick={() => setMode(m.key)} className={`flex-1 rounded-md px-2 py-1 transition-colors ${mode === m.key ? "bg-surface text-brand-700 shadow-sm" : "text-ink-400 hover:text-ink-700"}`}>{m.label}</button>)}
    </div>
    {mode === "hari" && <LineChart days={heatmap} />}
    {mode === "minggu" && <div className="flex h-[164px] flex-col items-center justify-center rounded-xl bg-surface-muted/45"><strong className="text-[30px] font-bold leading-none tabular-nums text-ink-900">{totalMinggu}</strong><span className="mt-1.5 text-[10px] text-ink-400">Total JP committed minggu ini</span></div>}
    {(mode === "bulan" || mode === "semester") && <div className="flex h-[164px] flex-col items-center justify-center rounded-xl bg-surface-muted/45 px-6 text-center"><span className="text-[10.5px] font-medium text-ink-500">Data historis {mode === "bulan" ? "bulanan" : "semesteran"} belum tersedia.</span><span className="mt-1 text-[9px] text-ink-400">Akan terisi otomatis seiring histori jadwal committed bertambah dari minggu ke minggu.</span></div>}
  </div>;
}

function BebanDonut({ distribution }: { distribution: DashboardBebanDistribution }) {
  const total = Math.max(distribution.ringan + distribution.normal + distribution.berat, 1);
  const a = (distribution.ringan / total) * 360;
  const b = ((distribution.ringan + distribution.normal) / total) * 360;
  const bg = `conic-gradient(#10b981 0deg ${a}deg, #f59e0b ${a}deg ${b}deg, #f43f5e ${b}deg 360deg)`;
  const pct = (n: number) => Math.round((n / total) * 100);
  return <div className="flex items-center gap-5">
    <div className="relative h-28 w-28 shrink-0 rounded-full p-[11px] transition-transform hover:scale-[1.02]" style={{ background: bg }}>
      <Link href="/guru" aria-label="Buka Data Guru" className="flex h-full w-full items-center justify-center rounded-full bg-surface text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
        <span><strong className="block text-[23px] leading-none tabular-nums text-ink-900">{distribution.ringan + distribution.normal + distribution.berat}</strong><small className="mt-1 block text-[8px] text-ink-400">guru aktif</small></span>
      </Link>
    </div>
    <div className="min-w-0 flex-1 space-y-2 text-[10px]">
      <Link href="/guru" className="flex items-center justify-between gap-3 rounded px-1 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-brand-500/40"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Ringan <span className="text-ink-400">(≤ 20 JP)</span></span><span className="flex items-baseline gap-1 tabular-nums"><b>{distribution.ringan}</b><span className="text-[8.5px] text-ink-400">({pct(distribution.ringan)}%)</span></span></Link>
      <Link href="/guru" className="flex items-center justify-between gap-3 rounded px-1 hover:bg-amber-50 hover:text-amber-700 focus-visible:ring-2 focus-visible:ring-brand-500/40"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Normal <span className="text-ink-400">(21–32 JP)</span></span><span className="flex items-baseline gap-1 tabular-nums"><b>{distribution.normal}</b><span className="text-[8.5px] text-ink-400">({pct(distribution.normal)}%)</span></span></Link>
      <Link href="/guru" className="flex items-center justify-between gap-3 rounded px-1 hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-brand-500/40"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" />Berat <span className="text-ink-400">(≥ 33 JP)</span></span><span className="flex items-baseline gap-1 tabular-nums"><b>{distribution.berat}</b><span className="text-[8.5px] text-ink-400">({pct(distribution.berat)}%)</span></span></Link>
    </div>
  </div>;
}

function HeatmapGrid({ grid }: { grid: DashboardHeatmapGridDay[] }) {
  const rows = Math.max(...grid.map((d) => d.cells.length), 1);
  const LEVEL_BG: Record<0 | 1 | 2 | 3 | 4, string> = { 0: "bg-surface-muted", 1: "bg-brand-50", 2: "bg-brand-100", 3: "bg-brand-200", 4: "bg-brand-300" };
  return <div className="overflow-x-auto">
    <div className="grid min-w-[420px] gap-1.5" style={{ gridTemplateColumns: `repeat(${grid.length}, minmax(0,1fr))` }}>
      {grid.map((d) => <div key={d.day} className="text-center text-[8px] font-semibold text-ink-400">{d.label.slice(0, 3)}</div>)}
      {Array.from({ length: rows }).map((_, r) => grid.map((d) => {
        const cell = d.cells[r];
        if (!cell) return <div key={`${d.day}-${r}`} className="h-6 rounded-md" />;
        return <Link key={`${d.day}-${r}`} href={`/jadwal?day=${encodeURIComponent(d.day)}`} title={`${d.label} · Jam ke-${cell.periode} (${cell.time}) · ${cell.total} jadwal`} aria-label={`${d.label} jam ke-${cell.periode}: ${cell.total} jadwal`} className={`h-6 rounded-md ${LEVEL_BG[cell.level]} transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40`} />;
      }))}
    </div>
    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      {([["0", 0], ["1–2", 1], ["3–4", 2], ["5–6", 3], ["7+", 4]] as [string, 0 | 1 | 2 | 3 | 4][]).map(([label, level]) => <span key={level} className="flex items-center gap-1 text-[8.5px] text-ink-400"><span className={`h-2.5 w-2.5 rounded-sm ${LEVEL_BG[level]}`} />{label} jadwal</span>)}
    </div>
    <p className="mt-1.5 text-[9px] text-ink-400">Arahkan kursor ke sel untuk melihat detail jam &amp; jumlah jadwal.</p>
  </div>;
}

const DOW_TO_HARI: HariSekolah[] = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"]; // JS getDay(): 0=Minggu

function MiniCalendar({ heatmap }: { heatmap: DashboardHeatmapDay[] }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const scheduledDays = useMemo(() => new Set(heatmap.filter((d) => d.total > 0).map((d) => d.day)), [heatmap]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // 0=Senin
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const cells: { date: number | null; hari: HariSekolah | null }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ date: null, hari: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: d, hari: DOW_TO_HARI[new Date(year, month, d).getDay()] });

  return <div>
    <div className="mb-2.5 flex items-center justify-between">
      <span className="text-[11px] font-semibold capitalize text-ink-800">{monthLabel}</span>
      <div className="flex items-center gap-0.5">
        <button type="button" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Bulan sebelumnya" className="rounded-md p-1 text-ink-400 hover:bg-surface-muted hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"><ChevronLeft size={13} /></button>
        <button type="button" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Bulan berikutnya" className="rounded-md p-1 text-ink-400 hover:bg-surface-muted hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"><ChevronRight size={13} /></button>
      </div>
    </div>
    <div className="grid grid-cols-7 gap-y-1 text-center">
      {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => <span key={d} className="text-[8px] font-semibold text-ink-400">{d}</span>)}
      {cells.map((c, i) => {
        if (c.date === null) return <span key={`e-${i}`} />;
        const isToday = isCurrentMonth && c.date === today.getDate();
        const hasSchedule = c.hari && scheduledDays.has(c.hari);
        const isSchoolDay = c.hari !== "minggu";
        const base = "mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40";
        if (!isSchoolDay || !c.hari) return <span key={i} className={`${base} text-ink-300`}>{c.date}</span>;
        return <Link key={i} href={`/jadwal?day=${encodeURIComponent(c.hari)}`} title={hasSchedule ? "Ada jadwal committed" : "Belum ada jadwal committed"} className={`${base} relative ${isToday ? "bg-brand-600 font-bold text-white" : "text-ink-700 hover:bg-surface-muted"}`}>
          {c.date}
          {hasSchedule && !isToday && <span aria-hidden="true" className="absolute bottom-0.5 h-1 w-1 rounded-full bg-brand-600" />}
        </Link>;
      })}
    </div>
  </div>;
}

const NOTIF_TONE: Record<NotificationEntry["tone"], { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: "bg-brand-50 text-brand-600" },
  success: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600" },
  warning: { icon: AlertTriangle, cls: "bg-amber-50 text-amber" },
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.round(diffMs / 60000));
  if (min < 1) return "Baru saja";
  if (min < 60) return `${min}m lalu`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}j lalu`;
  return `${Math.round(hr / 24)}h lalu`;
}

function NotificationsPanel({ notifications }: { notifications: NotificationEntry[] }) {
  if (notifications.length === 0) return <p className="text-[10px] text-ink-400">Belum ada aktivitas untuk ditampilkan sebagai notifikasi.</p>;
  return <div className="space-y-3">
    {notifications.slice(0, 4).map((n) => {
      const tone = NOTIF_TONE[n.tone];
      const Icon = tone.icon;
      return <div key={n.id} className="flex items-start gap-2.5">
        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone.cls}`}><Icon size={13} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10.5px] font-semibold text-ink-800">{n.title}</p>
          {n.description && <p className="truncate text-[9.5px] text-ink-400">{n.description}</p>}
        </div>
        <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[8.5px] text-ink-400">
          {relativeTime(n.createdAt)}
          {n.unread && <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-label="Belum dibaca" />}
        </span>
      </div>;
    })}
  </div>;
}

function FloatingActionDock() {
  const [more, setMore] = useState(false);
  const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40";
  const actions: { label: string; href: string; icon: ReactNode }[] = [
    { label: "Tambah Guru", href: "/guru?new=1", icon: <Plus size={16} /> },
    { label: "Generate Jadwal", href: "/jadwal-cerdas", icon: <Sparkles size={16} /> },
    { label: "Validasi Jadwal", href: "/jadwal", icon: <ShieldCheck size={16} /> },
    { label: "Lihat Konflik", href: "/analitik#konflik-jp-aktif", icon: <AlertTriangle size={16} /> },
    { label: "Import Data", href: "/guru?import=1", icon: <Upload size={16} /> },
  ];
  const moreActions: { label: string; href: string; icon: ReactNode }[] = [
    { label: "Riwayat Perubahan", href: "/riwayat", icon: <Clock3 size={14} /> },
    { label: "Notifikasi", href: "/notifikasi", icon: <Info size={14} /> },
    { label: "Analitik", href: "/analitik", icon: <Activity size={14} /> },
    { label: "Pencarian Global", href: "/navigasi", icon: <Search size={14} /> },
  ];
  return <nav aria-label="Aksi cepat" className="pointer-events-none sticky bottom-4 z-10 mt-1 flex justify-center">
    <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/70 bg-surface/95 p-1.5 shadow-[0_10px_30px_rgba(15,23,42,.12)] backdrop-blur">
      {actions.map((a) => <Link key={a.href} href={a.href} className={`group flex flex-col items-center gap-1 rounded-full px-3 py-1.5 text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-700 ${focusRing}`}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-ink-600 group-hover:bg-brand-100 group-hover:text-brand-700">{a.icon}</span>
        <span className="whitespace-nowrap text-[8.5px] font-semibold">{a.label}</span>
      </Link>)}
      <div className="relative">
        <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} aria-haspopup="menu" aria-label="Lebih banyak aksi" className={`group flex flex-col items-center gap-1 rounded-full px-3 py-1.5 text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-700 ${focusRing}`}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-ink-600 group-hover:bg-brand-100 group-hover:text-brand-700">{more ? <X size={16} /> : <MoreHorizontal size={16} />}</span>
          <span className="whitespace-nowrap text-[8.5px] font-semibold">More</span>
        </button>
        {more && <div role="menu" className="absolute bottom-full right-0 mb-2 w-52 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
          {moreActions.map((a) => <Link key={a.href} href={a.href} role="menuitem" onClick={() => setMore(false)} className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12px] font-medium text-ink-700 hover:bg-surface-muted ${focusRing}`}><span className="text-brand-600">{a.icon}</span>{a.label}</Link>)}
        </div>}
      </div>
    </div>
  </nav>;
}

function greetingSalutation(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

export default function DashboardExperience({ schoolName, adminName, context, metrics, jpInsight, workload, heatmap, heatmapGrid, bebanDistribution, workloadFull, agenda, activity, guruList, notifications }: { schoolName: string; adminName: string | null; context: string | null; metrics: DashboardKeyMetrics; jpInsight: DashboardJpInsight; workload: DashboardWorkloadEntry[]; heatmap: DashboardHeatmapDay[]; heatmapGrid: DashboardHeatmapGridDay[]; bebanDistribution: DashboardBebanDistribution; workloadFull: DashboardWorkloadFullEntry[]; agenda: DashboardAgendaEntry[]; activity: DashboardActivityEntry[]; guruList: GuruLite[]; notifications: NotificationEntry[] }) {
  const guruByName = new Map(guruList.map((g) => [g.namaGuru, g]));
  const bebanTertinggi = workloadFull.slice(0, 4);
  const salutation = useMemo(() => greetingSalutation(), []);
  return <main className="mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-[1440px] flex-col gap-3 px-2 pb-4 pt-3 sm:px-3 lg:gap-3.5">
    <header className="flex items-end justify-between gap-4 px-1">
      <div className="min-w-0">
        <p className="mb-1 text-[9px] font-bold uppercase tracking-[.14em] text-brand-600">{context ?? "Konteks akademik belum aktif"}</p>
        <h1 className="text-[25px] font-semibold leading-none tracking-[-.03em] text-ink-900">{salutation}{adminName ? `, ${adminName.split(/\s+/)[0]}` : ""} 👋</h1>
        <p className="mt-1.5 text-[11px] text-ink-500">Ringkasan kondisi akademik <span className="font-semibold text-ink-700">{schoolName}</span> dan jadwal sekolah.</p>
      </div>
      <Link href="/analitik" className="hidden items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-[10px] font-semibold text-ink-600 shadow-sm hover:border-brand-600/25 hover:text-brand-700 sm:flex">Analitik <ArrowRight size={12} /></Link>
    </header>
    <KpiRow metrics={metrics} />
    <div className="grid min-h-0 items-start gap-3 lg:grid-cols-[1fr_320px]">
      {/* Kolom kiri utama */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="grid min-h-0 gap-3 lg:grid-cols-[1.5fr_.72fr]">
          <Section title="Rekap JTM" description="Jam Tatap Muka committed · klik titik/area untuk membuka analitik." href="/analitik" icon={<Activity size={14} />}><RekapJtm heatmap={heatmap} /></Section>
          <Section title="Distribusi Beban Guru" description="Ringan/Normal/Berat berdasarkan JP committed." href="/guru" icon={<Users size={14} />}><BebanDonut distribution={bebanDistribution} /></Section>
        </div>
        <div className="grid min-h-0 gap-3 lg:grid-cols-[1.2fr_1fr]">
          <Section title="Heatmap Jadwal" description="Kepadatan tiap jam pelajaran sepekan." href="/jadwal" icon={<Activity size={14} />}><HeatmapGrid grid={heatmapGrid} /></Section>
          <Section title="Beban Guru Tertinggi" description="Guru dengan JP committed tertinggi." href="/guru" icon={<Users size={14} />} badge={<span className="ml-1 inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[9px] font-bold text-ink-500">Top 5</span>}><div className="space-y-2">{bebanTertinggi.map((e) => { const style = BEBAN_STYLE[e.beban]; const g = guruList.find((item) => item.id === e.guruId); return <Link key={e.guruId} href={`/guru?teacher=${encodeURIComponent(e.guruId)}`} aria-label={`${e.namaGuru}: ${e.totalJamMengajar} JP, ${style.label}`} className="group flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"><Avatar name={e.namaGuru} size="md" kodeGuru={g?.kodeGuru} jenisKelamin={g?.jenisKelamin} /><span className="min-w-0 flex-1 truncate text-[10px] font-medium text-ink-800 group-hover:text-brand-700">{e.namaGuru}</span><span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${style.badge}`}>{style.label}</span><span className="text-[10px] font-bold tabular-nums text-ink-800">{e.totalJamMengajar} JP</span></Link>; })}{bebanTertinggi.length === 0 && <p className="text-[10px] text-ink-400">Belum ada guru aktif dengan jadwal committed.</p>}</div></Section>
        </div>
        <div className="grid min-h-0 gap-3 lg:grid-cols-2">
          <Section title="Aktivitas Terbaru" description="Perubahan terakhir pada konteks aktif." href="/riwayat" icon={<Clock3 size={14} />}><div className="space-y-2.5">{activity.slice(0, 4).map((a) => { const isGuru = a.entityType.toLowerCase().replace(/[- ]+/g, "_") === "guru"; const guru = isGuru && a.entityLabel ? guruByName.get(a.entityLabel) : undefined; return <Link key={a.id} href="/riwayat" className="group flex items-start gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">{isGuru ? <Avatar name={a.entityLabel} size="sm" kodeGuru={guru?.kodeGuru} jenisKelamin={guru?.jenisKelamin} /> : <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={12} aria-hidden="true" /></span>}<div className="min-w-0"><p className="truncate text-[10px] font-medium text-ink-800 group-hover:text-brand-700">{a.action}</p><time className="text-[8.5px] text-ink-400">{new Date(a.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}</time></div></Link>; })}</div></Section>
          <Section title="Insight" description="Sinyal yang layak diperhatikan." href="/analitik" icon={<Lightbulb size={14} />}><Link href="/analitik" className="group block rounded-xl bg-brand-50/60 p-3 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"><p className="text-[11px] font-semibold leading-4 text-ink-900">{bebanTertinggi[0]?.namaGuru ? `${bebanTertinggi[0].namaGuru} memiliki beban JP tertinggi.` : "Jadwal akademik siap dianalisis."}</p><p className="mt-1 text-[9.5px] leading-4 text-ink-500">Buka Analitik untuk melihat distribusi dan pola yang lebih lengkap.</p><span className="mt-2 inline-flex items-center gap-1 text-[9.5px] font-semibold text-brand-600">Analisis <ArrowRight size={11} /></span></Link></Section>
        </div>
      </div>
      {/* Kolom kanan dedicated — Kalender → Agenda → Notifikasi bertumpuk (golden reference item M) */}
      <div className="flex min-w-0 flex-col gap-3">
        <Section title="Mini Kalender" description="Bulan berjalan · titik menandai hari dengan jadwal committed." icon={<CalendarDays size={14} />}><MiniCalendar heatmap={heatmap} /></Section>
        <Section title="Agenda Mendatang" description="Jadwal terdekat dari konteks aktif." href="/jadwal" icon={<Clock3 size={14} />}><div className="space-y-1">{agenda.slice(0, 4).map((e) => { const teacher = e.teacher?.trim() || "Guru"; const className = e.className?.trim() || "Kelas"; const g = e.teacherId ? guruList.find((item) => item.id === e.teacherId) : guruByName.get(teacher); return <Link key={e.id} href={`/jadwal?assignment=${encodeURIComponent(e.id)}`} aria-label={`${e.subject} · ${teacher} · ${className}`} className="group flex items-center gap-2.5 border-b border-border/50 py-2 last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"><span className="w-[50px] shrink-0 text-[9px] font-bold tabular-nums text-brand-600">{e.time}</span><Avatar name={g?.namaGuru ?? teacher} size="md" kodeGuru={g?.kodeGuru} jenisKelamin={g?.jenisKelamin} /><span className="min-w-0 flex-1"><span className="block truncate text-[10.5px] font-semibold text-ink-900 group-hover:text-brand-700">{e.subject?.trim() || "Mata pelajaran"}</span><span className="block truncate text-[8.5px] text-ink-400">{className} · {teacher}{e.room ? ` · ${e.room}` : ""}</span></span><ChevronRight size={11} className="text-ink-300 group-hover:text-brand-600" /></Link>; })}{agenda.length === 0 && <p className="text-[10px] text-ink-400">Belum ada jadwal terdekat.</p>}</div></Section>
        <Section title="Notifikasi Terbaru" description="Aktivitas terbaru pada konteks aktif." href="/notifikasi" icon={<Bell size={14} />}><NotificationsPanel notifications={notifications} /></Section>
      </div>
    </div>
    <FloatingActionDock />
  </main>;
}
