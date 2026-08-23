"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useRef } from "react";
import { Activity, ArrowRight, Bell, BookOpen, CalendarCheck2, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, DoorOpen, Info, AlertTriangle, Layers, Lightbulb, Plus, Sparkles, ShieldCheck, Upload, MoreHorizontal, Search, Users, X, Settings2, GripVertical, Minus, RotateCcw, BarChart3, LineChartIcon, PieChart } from "lucide-react";
import type { ReactNode } from "react";
import type { DashboardKeyMetrics, DashboardJpInsight, DashboardWorkloadEntry, DashboardMetricTrends, DashboardMetricSpark } from "@/lib/application/dashboard.usecases";
import type { DashboardActivityEntry, DashboardAgendaEntry, DashboardHeatmapDay, DashboardHeatmapGridDay, DashboardBebanDistribution, DashboardWorkloadFullEntry, DashboardRoomLite } from "@/lib/application/dashboard.intelligence";
import type { NotificationEntry } from "@/lib/application/notifications.usecases";
import type { HariSekolah } from "@/lib/domain/jamPelajaran";

import PremiumAvatar from "@/components/ui/Avatar";
import { useDashboardPrefs, SPAN_PRESETS, FONT_SIZE_ZOOM, FONT_FAMILY_STACK, FONT_SIZE_LABEL, FONT_FAMILY_LABEL, type DashboardWidgetId, type FontSize, type FontFamily } from "@/lib/ui/dashboardPrefs";

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
  ringan: { label: "Ringan", badge: "border-emerald/30 bg-emerald-50 text-emerald", dot: "bg-emerald" },
  normal: { label: "Normal", badge: "border-amber/30 bg-amber-50 text-amber", dot: "bg-amber" },
  berat: { label: "Berat", badge: "border-rose/30 bg-rose-50 text-rose", dot: "bg-rose" },
};

function MiniSpark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 100, h = 24, pad = 2;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => ({ x: pad + (i * (w - pad * 2)) / (values.length - 1), y: h - pad - ((v - min) / range) * (h - pad * 2) }));
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} className="h-6 w-full text-brand-500/70" preserveAspectRatio="none" aria-hidden="true">
    <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function useCountUp(target: number, durationMs = 500): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    if (from === target) return;
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return display;
}

function KpiCard({ label, value, suffix, icon, href, spark }: { label: string; value: number; suffix?: string; icon: ReactNode; href: string; spark?: DashboardMetricSpark }) {
  const animatedValue = useCountUp(value);
  return <Link href={href} className="group flex flex-col gap-2.5 rounded-[16px] border border-border/70 bg-surface/95 p-3.5 shadow-[0_1px_2px_rgba(15,23,42,.03)] transition-all hover:-translate-y-0.5 hover:border-brand-600/25 hover:shadow-[0_8px_20px_rgba(15,23,42,.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-transform duration-200 group-hover:scale-110">{icon}</span>
    <span className="min-w-0">
      <span className="flex items-baseline gap-1"><strong className="text-[16px] font-bold leading-none tabular-nums text-ink-900 group-hover:text-brand-700">{animatedValue}</strong>{suffix && <span className="text-[8.5px] font-medium text-ink-400">{suffix}</span>}</span>
      <span className="mt-1.5 block truncate text-[9px] font-medium text-ink-400">{label}</span>
      {spark && spark.trend !== null ? (
        <span className={`mt-0.5 block text-[8px] font-semibold ${spark.trend > 0 ? "text-emerald" : spark.trend < 0 ? "text-rose" : "text-ink-400"}`}>{spark.trend > 0 ? "↑" : spark.trend < 0 ? "↓" : "—"} {spark.trend !== 0 ? Math.abs(spark.trend) : "stabil"}{spark.trend !== 0 ? " dari data sebelumnya" : ""}</span>
      ) : <span className="mt-0.5 block text-[8px] font-medium text-ink-300">Histori terkumpul mulai hari ini</span>}
    </span>
    {spark && spark.values.length >= 2 && <MiniSpark values={spark.values} />}
  </Link>;
}

function KpiRow({ metrics, metricTrends }: { metrics: DashboardKeyMetrics; metricTrends: DashboardMetricTrends | null }) {
  return <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
    <KpiCard label="Guru Aktif" value={metrics.totalGuruAktif} icon={<Users size={16} />} href="/guru" spark={metricTrends?.totalGuruAktif} />
    <KpiCard label="Kelas" value={metrics.totalKelas} icon={<Layers size={16} />} href="/kelas" spark={metricTrends?.totalKelas} />
    <KpiCard label="Mata Pelajaran" value={metrics.totalMataPelajaranAktif} icon={<BookOpen size={16} />} href="/mata-pelajaran" spark={metricTrends?.totalMataPelajaranAktif} />
    <KpiCard label="Ruangan" value={metrics.totalRuangan} icon={<DoorOpen size={16} />} href="/ruangan" spark={metricTrends?.totalRuangan} />
    <KpiCard label="Total JTM" value={metrics.totalJtm} suffix="JP/minggu" icon={<Clock3 size={16} />} href="/analitik" spark={metricTrends?.totalJtm} />
    <KpiCard label="Jadwal Aktif" value={metrics.totalJadwalCommitted} icon={<CalendarCheck2 size={16} />} href="/jadwal" spark={metricTrends?.totalJadwalCommitted} />
  </div>;
}

function yTicks(max: number): number[] {
  // 5 tick bulat (0..max) — dibulatkan ke kelipatan rapi supaya label tidak pecahan aneh.
  const step = Math.max(1, Math.ceil(max / 4 / 5) * 5);
  return [0, step, step * 2, step * 3, step * 4];
}

function LineChart({ days }: { days: DashboardHeatmapDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const rawMax = Math.max(...days.map((d) => d.total), 1);
  const ticks = yTicks(rawMax);
  const max = Math.max(ticks[ticks.length - 1], rawMax, 1);
  const width = 620, height = 145, padL = 30, padR = 12, padY = 14;
  const plotW = width - padL - padR;
  const points = days.map((d, i) => ({ x: days.length <= 1 ? padL + plotW / 2 : padL + (i * plotW) / Math.max(days.length - 1, 1), y: height - padY - (d.total / max) * (height - padY * 2), d }));
  const path = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const active = hover !== null ? points[hover] : null;
  const prevTotal = hover !== null && hover > 0 ? points[hover - 1].d.total : null;
  const trendPct = active && prevTotal !== null && prevTotal > 0 ? Math.round(((active.d.total - prevTotal) / prevTotal) * 100) : null;
  return <div className="relative h-[164px] w-full overflow-visible rounded-xl bg-surface-muted/45 px-1 pt-1">
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-[142px] w-full overflow-visible" role="img" aria-label="Distribusi JP committed per hari">
      {ticks.map((t) => {
        const y = height - padY - (t / max) * (height - padY * 2);
        return <g key={t}>
          <path d={`M ${padL} ${y.toFixed(1)} H ${width - padR}`} stroke="currentColor" className="text-border/60" strokeWidth="1" strokeDasharray={t === 0 ? undefined : "2 3"} />
          <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-ink-400" fontSize="8.5">{t}</text>
        </g>;
      })}
      <path d={path} fill="none" stroke="currentColor" className="text-brand-600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map(({ x, y, d }, i) => <circle key={d.day} cx={x} cy={y} r={hover === i ? 6 : 4.5} fill="currentColor" className="text-brand-600 transition-all" />)}
      {active && <line x1={active.x} y1={active.y} x2={active.x} y2={height - padY} stroke="currentColor" className="text-brand-600/50" strokeWidth="1" strokeDasharray="3 3" />}
    </svg>
    <div className="absolute inset-x-0 bottom-1 flex justify-between px-[30px] text-[9px] font-medium text-ink-400">{days.map((d) => <Link key={d.day} href={`/analitik?day=${encodeURIComponent(d.day)}`} className="rounded px-1 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">{d.label.slice(0, 3)}</Link>)}</div>
    <div className="absolute inset-y-0 right-0" style={{ left: 30 }} aria-label="Buka analitik per hari">
      <div className="grid h-full grid-cols-6">{days.map((d, i) => <Link key={d.day} href={`/analitik?day=${encodeURIComponent(d.day)}`} aria-label={`Buka analitik ${d.label}: ${d.total} JP`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40" />)}</div>
    </div>
    {active && <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+9px)] rounded-lg border border-border bg-surface px-2.5 py-1.5 text-center shadow-lg" style={{ left: `${(active.x / width) * 100}%`, top: `${(active.y / height) * 100}%` }}>
      <p className="whitespace-nowrap text-[9px] font-semibold text-ink-700">{active.d.label}</p>
      <p className="whitespace-nowrap text-[13px] font-bold leading-tight tabular-nums text-ink-900">{active.d.total} JP</p>
      {trendPct !== null && <p className={`whitespace-nowrap text-[8.5px] font-semibold ${trendPct >= 0 ? "text-emerald" : "text-rose"}`}>{trendPct >= 0 ? "↑" : "↓"} {Math.abs(trendPct)}% dari hari sebelumnya</p>}
    </div>}
    {!active && <div className="pointer-events-none absolute right-3 top-2 rounded-lg border border-border/70 bg-surface/95 px-2 py-1 text-[8.5px] text-ink-500 shadow-sm">Arahkan kursor untuk detail per hari</div>}
  </div>;
}

function BarChartJtm({ days }: { days: DashboardHeatmapDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...days.map((d) => d.total), 1);
  return <div className="flex h-[164px] items-end gap-2 rounded-xl bg-surface-muted/45 px-3 pb-6 pt-3">
    {days.map((d, i) => <Link key={d.day} href={`/analitik?day=${encodeURIComponent(d.day)}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1.5 focus-visible:outline-none">
      {hover === i && <span className="absolute -top-1 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-surface px-2 py-1 text-[9px] font-semibold text-ink-800 shadow-lg">{d.total} JP</span>}
      <div className={`w-full rounded-t-md transition-all ${hover === i ? "bg-brand-600" : "bg-brand-500/70 group-hover:bg-brand-600"}`} style={{ height: `${Math.max((d.total / max) * 100, d.total > 0 ? 4 : 1)}%` }} />
      <span className="text-[8.5px] font-medium text-ink-400 group-hover:text-brand-600">{d.label.slice(0, 3)}</span>
    </Link>)}
  </div>;
}

const JTM_MODES: { key: JtmMode; label: string }[] = [{ key: "hari", label: "Hari" }, { key: "minggu", label: "Minggu" }, { key: "bulan", label: "Bulan" }, { key: "semester", label: "Semester" }];

function RekapJtm({ heatmap, variant, onVariantChange }: { heatmap: DashboardHeatmapDay[]; variant: "garis" | "batang"; onVariantChange: (v: "garis" | "batang") => void }) {
  const [mode, setMode] = useState<JtmMode>("minggu");
  const totalMinggu = heatmap.reduce((s, d) => s + d.total, 0);
  const busiestDay = heatmap.reduce((best, d) => (d.total > (best?.total ?? -1) ? d : best), heatmap[0]);
  return <div>
    <div className="mb-2 flex items-end justify-between gap-2">
      <div><strong className="text-[21px] font-bold leading-none tabular-nums text-ink-900">{totalMinggu}</strong><span className="ml-1 text-[10px] font-medium text-ink-400">JP minggu ini</span>
        {busiestDay && busiestDay.total > 0 && <p className="mt-1 text-[9.5px] text-ink-400">Puncak: <span className="font-semibold text-ink-600">{busiestDay.label}</span> ({busiestDay.total} JP)</p>}
      </div>
      <button type="button" onClick={() => onVariantChange(variant === "garis" ? "batang" : "garis")} title="Ganti tipe grafik" aria-label="Ganti tipe grafik" className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[9px] font-semibold text-ink-500 hover:border-brand-600/25 hover:text-brand-700">
        {variant === "garis" ? <BarChart3 size={11} /> : <LineChartIcon size={11} />}{variant === "garis" ? "Batang" : "Garis"}
      </button>
    </div>
    <div className="mb-3 flex gap-1 rounded-lg bg-surface-muted/60 p-0.5 text-[9.5px] font-semibold">
      {JTM_MODES.map((m) => <button key={m.key} type="button" onClick={() => setMode(m.key)} className={`flex-1 rounded-md px-2 py-1 transition-colors ${mode === m.key ? "bg-surface text-brand-700 shadow-sm" : "text-ink-400 hover:text-ink-700"}`}>{m.label}</button>)}
    </div>
    {mode === "minggu" && (variant === "garis" ? <LineChart days={heatmap} /> : <BarChartJtm days={heatmap} />)}
    {mode === "hari" && <div className="flex h-[164px] flex-col items-center justify-center rounded-xl bg-surface-muted/45 px-6 text-center"><span className="text-[10.5px] font-medium text-ink-500">Rincian per jam untuk hari ini belum tersedia.</span><span className="mt-1 text-[9px] text-ink-400">Gunakan tab Minggu untuk melihat distribusi JP per hari, atau buka Analitik untuk detail lebih lanjut.</span></div>}
    {(mode === "bulan" || mode === "semester") && <div className="flex h-[164px] flex-col items-center justify-center rounded-xl bg-surface-muted/45 px-6 text-center"><span className="text-[10.5px] font-medium text-ink-500">Data historis {mode === "bulan" ? "bulanan" : "semesteran"} belum tersedia.</span><span className="mt-1 text-[9px] text-ink-400">Akan terisi otomatis seiring histori jadwal committed bertambah dari minggu ke minggu.</span></div>}
  </div>;
}

function BebanDonut({ distribution, variant, onVariantChange }: { distribution: DashboardBebanDistribution; variant: "donut" | "batang"; onVariantChange: (v: "donut" | "batang") => void }) {
  const total = Math.max(distribution.ringan + distribution.normal + distribution.berat, 1);
  const a = (distribution.ringan / total) * 360;
  const b = ((distribution.ringan + distribution.normal) / total) * 360;
  const bg = `conic-gradient(var(--color-emerald) 0deg ${a}deg, var(--color-amber) ${a}deg ${b}deg, var(--color-rose) ${b}deg 360deg)`;
  const pct = (n: number) => Math.round((n / total) * 100);
  const rows: { key: "ringan" | "normal" | "berat"; label: string; range: string; dot: string; hover: string; value: number }[] = [
    { key: "ringan", label: "Ringan", range: "(≤ 20 JP)", dot: "bg-emerald", hover: "hover:bg-emerald-50 hover:text-emerald", value: distribution.ringan },
    { key: "normal", label: "Normal", range: "(21–32 JP)", dot: "bg-amber", hover: "hover:bg-amber-50 hover:text-amber", value: distribution.normal },
    { key: "berat", label: "Berat", range: "(≥ 33 JP)", dot: "bg-rose", hover: "hover:bg-rose-50 hover:text-rose", value: distribution.berat },
  ];
  return <div>
    <div className="mb-2 flex justify-end">
      <button type="button" onClick={() => onVariantChange(variant === "donut" ? "batang" : "donut")} title="Ganti tipe grafik" aria-label="Ganti tipe grafik" className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[9px] font-semibold text-ink-500 hover:border-brand-600/25 hover:text-brand-700">
        {variant === "donut" ? <BarChart3 size={11} /> : <PieChart size={11} />}{variant === "donut" ? "Batang" : "Donut"}
      </button>
    </div>
    {variant === "donut" ? <div className="flex items-center gap-5">
      <div className="relative h-28 w-28 shrink-0 rounded-full p-[11px] transition-transform hover:scale-[1.02]" style={{ background: bg }}>
        <Link href="/guru" aria-label="Buka Data Guru" className="flex h-full w-full items-center justify-center rounded-full bg-surface text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
          <span><strong className="block text-[20px] leading-none tabular-nums text-ink-900">{distribution.ringan + distribution.normal + distribution.berat}</strong><small className="mt-1 block text-[8px] text-ink-400">guru aktif</small></span>
        </Link>
      </div>
      <div className="min-w-0 flex-1 space-y-2 text-[10px]">
        {rows.map((r) => <Link key={r.key} href="/guru" className={`flex items-center justify-between gap-3 rounded px-1 focus-visible:ring-2 focus-visible:ring-brand-500/40 ${r.hover}`}><span className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${r.dot}`} />{r.label} <span className="text-ink-400">{r.range}</span></span><span className="flex items-baseline gap-1 tabular-nums"><b>{r.value}</b><span className="text-[8.5px] text-ink-400">({pct(r.value)}%)</span></span></Link>)}
      </div>
    </div> : <div className="space-y-2.5">
      {rows.map((r) => <Link key={r.key} href="/guru" className={`block rounded-lg px-1 py-1 focus-visible:ring-2 focus-visible:ring-brand-500/40 ${r.hover}`}>
        <div className="mb-1 flex items-center justify-between text-[10px]"><span className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${r.dot}`} />{r.label} <span className="text-ink-400">{r.range}</span></span><span className="tabular-nums"><b>{r.value}</b><span className="ml-1 text-[8.5px] text-ink-400">({pct(r.value)}%)</span></span></div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"><div className={`h-full rounded-full ${r.dot}`} style={{ width: `${pct(r.value)}%` }} /></div>
      </Link>)}
    </div>}
  </div>;
}

const DENSITY_OPTIONS: { key: 0 | 1 | 2 | 3 | 4; label: string }[] = [{ key: 0, label: "Semua tingkat" }, { key: 1, label: "Ringan ke atas" }, { key: 2, label: "Sedang ke atas" }, { key: 3, label: "Padat ke atas" }, { key: 4, label: "Sangat padat saja" }];
const LEVEL_BG: Record<0 | 1 | 2 | 3 | 4, string> = { 0: "bg-surface-muted", 1: "bg-brand-50", 2: "bg-brand-100", 3: "bg-brand-600/50", 4: "bg-brand-600" };

function HeatmapGrid({ grid, rooms, gridByRoom }: { grid: DashboardHeatmapGridDay[]; rooms: DashboardRoomLite[]; gridByRoom: Record<string, DashboardHeatmapGridDay[]> }) {
  const [roomId, setRoomId] = useState<string>("all");
  const [minLevel, setMinLevel] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [hover, setHover] = useState<{ dayIdx: number; rowIdx: number } | null>(null);
  const activeGrid = roomId === "all" ? grid : (gridByRoom[roomId] ?? grid);
  const rows = Math.max(...activeGrid.map((d) => d.cells.length), 1);
  const hoverCell = hover ? activeGrid[hover.dayIdx]?.cells[hover.rowIdx] : null;
  const hoverDay = hover ? activeGrid[hover.dayIdx] : null;
  return <div>
    <div className="mb-2.5 flex flex-wrap gap-1.5">
      <div className="relative">
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="appearance-none rounded-lg border border-border bg-surface py-1 pl-2.5 pr-6 text-[9.5px] font-semibold text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
          <option value="all">Semua Ruangan</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.nama}</option>)}
        </select>
        <ChevronRight size={10} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-ink-400" />
      </div>
      <div className="relative">
        <select value={minLevel} onChange={(e) => setMinLevel(Number(e.target.value) as 0 | 1 | 2 | 3 | 4)} className="appearance-none rounded-lg border border-border bg-surface py-1 pl-2.5 pr-6 text-[9.5px] font-semibold text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
          {DENSITY_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <ChevronRight size={10} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-ink-400" />
      </div>
    </div>
    <div className="relative overflow-x-auto">
      <div className="grid min-w-[420px] gap-1.5" style={{ gridTemplateColumns: `repeat(${activeGrid.length}, minmax(0,1fr))` }}>
        {activeGrid.map((d) => <div key={d.day} className="text-center text-[8px] font-semibold text-ink-400">{d.label.slice(0, 3)}</div>)}
        {Array.from({ length: rows }).map((_, r) => activeGrid.map((d, dayIdx) => {
          const cell = d.cells[r];
          if (!cell) return <div key={`${d.day}-${r}`} className="h-6 rounded-md" />;
          const dimmed = cell.level < minLevel;
          return <Link key={`${d.day}-${r}`} href={`/jadwal?day=${encodeURIComponent(d.day)}`} aria-label={`${d.label} jam ke-${cell.periode}: ${cell.total} jadwal`} onMouseEnter={() => setHover({ dayIdx, rowIdx: r })} onMouseLeave={() => setHover(null)} onFocus={() => setHover({ dayIdx, rowIdx: r })} onBlur={() => setHover(null)} className={`h-6 rounded-md transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${LEVEL_BG[cell.level]} ${dimmed ? "opacity-25" : ""}`} />;
        }))}
      </div>
      {hover && hoverCell && hoverDay && <div className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-2.5 py-2 text-left shadow-lg" style={{ left: `${((hover.dayIdx + 0.5) / activeGrid.length) * 100}%`, top: `${((hover.rowIdx + 1) / rows) * 100}%`, marginTop: 6 }}>
        <p className="whitespace-nowrap text-[9.5px] font-semibold text-ink-800">{hoverDay.label} · Jam ke-{hoverCell.periode}</p>
        <p className="whitespace-nowrap text-[8.5px] text-ink-400">{hoverCell.time}</p>
        <p className="mt-1 whitespace-nowrap text-[9px] text-ink-600"><b className="tabular-nums">{hoverCell.kelasCount}</b> kelas · <b className="tabular-nums">{hoverCell.guruCount}</b> guru{roomId === "all" && <> · <b className="tabular-nums">{hoverCell.ruanganCount}</b> ruangan</>}</p>
      </div>}
    </div>
    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      {([["0", 0], ["1–2", 1], ["3–4", 2], ["5–6", 3], ["7+", 4]] as [string, 0 | 1 | 2 | 3 | 4][]).map(([label, level]) => <span key={level} className="flex items-center gap-1 text-[8.5px] text-ink-400"><span className={`h-2.5 w-2.5 rounded-sm ${LEVEL_BG[level]}`} />{label} jadwal</span>)}
    </div>
    <p className="mt-1.5 text-[9px] text-ink-400">Arahkan kursor ke sel untuk melihat detail.</p>
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

type AgendaTab = "hari-ini" | "mendatang";

function AgendaSection({ agenda, guruList, guruByName }: { agenda: DashboardAgendaEntry[]; guruList: GuruLite[]; guruByName: Map<string, GuruLite> }) {
  const [tab, setTab] = useState<AgendaTab>("hari-ini");
  const todayAgenda = agenda.filter((e) => e.daysFromNow === 0);
  const upcomingAgenda = agenda.filter((e) => e.daysFromNow > 0);
  // Fallback: kalau hari ini kosong (mis. hari libur/tanpa jadwal), langsung tampilkan tab Mendatang supaya panel tidak kosong percuma.
  const list = tab === "hari-ini" ? todayAgenda : upcomingAgenda;
  const emptyText = tab === "hari-ini" ? "Belum ada jadwal untuk hari ini." : "Belum ada jadwal pada hari-hari berikutnya.";
  return <Section title="Agenda" description="Jadwal dari konteks aktif." href="/jadwal" icon={<Clock3 size={14} />}
    badge={<div className="ml-1 flex gap-0.5 rounded-full bg-surface-muted/60 p-0.5 text-[9px] font-semibold">
      <button type="button" onClick={() => setTab("hari-ini")} className={`rounded-full px-2 py-0.5 transition-colors ${tab === "hari-ini" ? "bg-surface text-brand-700 shadow-sm" : "text-ink-400 hover:text-ink-700"}`}>Hari Ini{todayAgenda.length > 0 ? ` (${todayAgenda.length})` : ""}</button>
      <button type="button" onClick={() => setTab("mendatang")} className={`rounded-full px-2 py-0.5 transition-colors ${tab === "mendatang" ? "bg-surface text-brand-700 shadow-sm" : "text-ink-400 hover:text-ink-700"}`}>Mendatang{upcomingAgenda.length > 0 ? ` (${upcomingAgenda.length})` : ""}</button>
    </div>}>
    <div className="space-y-1">
      {list.slice(0, 4).map((e) => {
        const teacher = e.teacher?.trim() || "Guru";
        const className = e.className?.trim() || "Kelas";
        const g = e.teacherId ? guruList.find((item) => item.id === e.teacherId) : guruByName.get(teacher);
        return <Link key={e.id} href={`/jadwal?assignment=${encodeURIComponent(e.id)}`} aria-label={`${e.subject} · ${teacher} · ${className}`} className="group flex items-center gap-2.5 border-b border-border/50 py-2 last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
          <span className="w-[50px] shrink-0 text-[9px] font-bold tabular-nums text-brand-600">{e.time}</span>
          <Avatar name={g?.namaGuru ?? teacher} size="md" kodeGuru={g?.kodeGuru} jenisKelamin={g?.jenisKelamin} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[10.5px] font-semibold text-ink-900 group-hover:text-brand-700">{e.subject?.trim() || "Mata pelajaran"}</span>
            <span className="block truncate text-[8.5px] text-ink-400">{tab === "mendatang" ? `${e.dayLabel} · ` : ""}{className} · {teacher}{e.room ? ` · ${e.room}` : ""}</span>
          </span>
          <ChevronRight size={11} className="text-ink-300 group-hover:text-brand-600" />
        </Link>;
      })}
      {list.length === 0 && <p className="text-[10px] text-ink-400">{emptyText}</p>}
    </div>
  </Section>;
}

const NOTIF_TONE: Record<NotificationEntry["tone"], { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: "bg-brand-50 text-brand-600" },
  success: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald" },
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

function Widget({ id, title, editing, span, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd, onResize, children }: {
  id: DashboardWidgetId; title: string; editing: boolean; span: number; dragOverId: DashboardWidgetId | null;
  onDragStart: (id: DashboardWidgetId) => void; onDragOver: (id: DashboardWidgetId) => void; onDrop: (id: DashboardWidgetId) => void; onDragEnd: () => void;
  onResize: (id: DashboardWidgetId, dir: 1 | -1) => void; children: ReactNode;
}) {
  const isDragOver = dragOverId === id;
  return <div
    style={{ gridColumn: `span ${span} / span ${span}` }}
    draggable={editing}
    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(id); }}
    onDragOver={(e) => { if (editing) { e.preventDefault(); onDragOver(id); } }}
    onDrop={(e) => { e.preventDefault(); onDrop(id); }}
    onDragEnd={onDragEnd}
    className={`min-w-0 transition-all ${editing ? `rounded-[18px] ring-2 ring-dashed ${isDragOver ? "ring-brand-600 bg-brand-50/40" : "ring-border"}` : ""}`}
  >
    {editing && <div className="mb-1.5 flex items-center justify-between gap-2 px-1 text-ink-400">
      <span className="flex cursor-grab items-center gap-1 text-[9.5px] font-semibold active:cursor-grabbing"><GripVertical size={12} /> {title}</span>
      <span className="flex items-center gap-0.5">
        <button type="button" onClick={() => onResize(id, -1)} aria-label={`Perkecil ${title}`} className="flex h-5 w-5 items-center justify-center rounded-md border border-border bg-surface hover:border-brand-600/30 hover:text-brand-700"><Minus size={11} /></button>
        <button type="button" onClick={() => onResize(id, 1)} aria-label={`Perbesar ${title}`} className="flex h-5 w-5 items-center justify-center rounded-md border border-border bg-surface hover:border-brand-600/30 hover:text-brand-700"><Plus size={11} /></button>
      </span>
    </div>}
    {children}
  </div>;
}

function DashboardCustomizeBar({ open, onToggle, fontSize, fontFamily, onFontSize, onFontFamily, onReset }: {
  open: boolean; onToggle: () => void; fontSize: FontSize; fontFamily: FontFamily; onFontSize: (v: FontSize) => void; onFontFamily: (v: FontFamily) => void; onReset: () => void;
}) {
  return <div className="relative">
    <button type="button" onClick={onToggle} aria-expanded={open} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10.5px] font-semibold shadow-sm transition-colors ${open ? "border-brand-600/40 bg-brand-50 text-brand-700" : "border-border bg-surface text-ink-600 hover:border-brand-600/25"}`}>
      <Settings2 size={13} /> {open ? "Selesai kustomisasi" : "Kustomisasi"}
    </button>
    {open && <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl border border-border bg-surface p-4 shadow-xl">
      <p className="mb-2.5 text-[11px] font-bold text-ink-800">Tampilan Dashboard</p>
      <div className="mb-3">
        <p className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-ink-400">Ukuran Font</p>
        <div className="flex gap-1.5">{(["sm", "md", "lg"] as FontSize[]).map((s) => <button key={s} type="button" onClick={() => onFontSize(s)} className={`flex-1 rounded-lg border px-2 py-1.5 text-[10.5px] font-semibold ${fontSize === s ? "border-brand-600/40 bg-brand-50 text-brand-700" : "border-border text-ink-500 hover:border-brand-600/25"}`}>{FONT_SIZE_LABEL[s]}</button>)}</div>
      </div>
      <div className="mb-3.5">
        <p className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-ink-400">Jenis Font</p>
        <div className="flex flex-col gap-1">{(["default", "serif", "mono"] as FontFamily[]).map((f) => <button key={f} type="button" onClick={() => onFontFamily(f)} className={`rounded-lg border px-2.5 py-1.5 text-left text-[10.5px] font-medium ${fontFamily === f ? "border-brand-600/40 bg-brand-50 text-brand-700" : "border-border text-ink-500 hover:border-brand-600/25"}`} style={{ fontFamily: FONT_FAMILY_STACK[f] }}>{FONT_FAMILY_LABEL[f]}</button>)}</div>
      </div>
      <p className="mb-3 text-[9.5px] leading-4 text-ink-400">Seret ikon <GripVertical size={10} className="inline" /> pada judul widget untuk memindahkan, atau pakai tombol +/− untuk mengubah ukurannya. Menggeser sebuah widget ke posisi lain akan menyesuaikan ukurannya dengan slot tujuan.</p>
      <button type="button" onClick={onReset} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[10.5px] font-semibold text-ink-500 hover:border-rose/30 hover:text-rose"><RotateCcw size={11} /> Kembalikan ke Default</button>
    </div>}
  </div>;
}

function greetingSalutation(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

function SmartInsight({ jpInsight, bebanTertinggi, bebanDistribution }: { jpInsight: DashboardJpInsight; bebanTertinggi: DashboardWorkloadFullEntry[]; bebanDistribution: DashboardBebanDistribution }) {
  type Signal = { level: "critical" | "warning" | "good"; text: string; href: string };
  const signals: Signal[] = [];
  if (jpInsight.countByStatus.kosong > 0) {
    signals.push({ level: "critical", text: `${jpInsight.countByStatus.kosong} kombinasi guru+mapel+kelas belum punya jadwal sama sekali.`, href: "/pembagian-mengajar" });
  }
  if (jpInsight.countByStatus.lebih > 0) {
    signals.push({ level: "warning", text: `${jpInsight.countByStatus.lebih} kombinasi melebihi target JP mingguan.`, href: "/analitik" });
  }
  if (bebanDistribution.berat > 0) {
    signals.push({ level: "warning", text: `${bebanDistribution.berat} guru dengan beban berat (≥ 33 JP/minggu)${bebanTertinggi[0] ? ` — tertinggi ${bebanTertinggi[0].namaGuru} (${bebanTertinggi[0].totalJamMengajar} JP)` : ""}.`, href: "/guru" });
  }
  if (signals.length === 0 && jpInsight.totalKombinasi > 0) {
    signals.push({ level: "good", text: `Semua ${jpInsight.totalKombinasi} kombinasi JP dalam kondisi aman, tidak ada yang perlu ditindaklanjuti.`, href: "/analitik" });
  }
  if (jpInsight.totalKombinasi === 0) {
    signals.push({ level: "warning", text: "Belum ada Pembagian Mengajar aktif — mulai dari sana untuk mengisi jadwal.", href: "/pembagian-mengajar" });
  }
  const styleFor: Record<Signal["level"], { dot: string; text: string }> = {
    critical: { dot: "bg-rose animate-pulse", text: "text-ink-900" },
    warning: { dot: "bg-amber", text: "text-ink-900" },
    good: { dot: "bg-emerald", text: "text-ink-700" },
  };
  return <div className="flex flex-col gap-2">
    {jpInsight.totalKombinasi > 0 && <div className="mb-0.5 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${jpInsight.completionPercent}%` }} /></div><span className="shrink-0 text-[9.5px] font-bold tabular-nums text-ink-600">{jpInsight.completionPercent}% terpenuhi</span></div>}
    {signals.slice(0, 3).map((s, i) => {
      const style = styleFor[s.level];
      return <Link key={i} href={s.href} className="group flex items-start gap-2 rounded-lg p-1.5 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
        <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
        <span className={`min-w-0 flex-1 text-[10.5px] leading-4 ${style.text}`}>{s.text}</span>
        <ArrowRight size={11} className="mt-0.5 shrink-0 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100" />
      </Link>;
    })}
  </div>;
}

export default function DashboardExperience({ schoolName, adminName, context, metrics, metricTrends, jpInsight, workload, heatmap, heatmapGrid, rooms, heatmapGridByRoom, bebanDistribution, workloadFull, agenda, activity, guruList, notifications }: { schoolName: string; adminName: string | null; context: string | null; metrics: DashboardKeyMetrics; metricTrends: DashboardMetricTrends | null; jpInsight: DashboardJpInsight; workload: DashboardWorkloadEntry[]; heatmap: DashboardHeatmapDay[]; heatmapGrid: DashboardHeatmapGridDay[]; rooms: DashboardRoomLite[]; heatmapGridByRoom: Record<string, DashboardHeatmapGridDay[]>; bebanDistribution: DashboardBebanDistribution; workloadFull: DashboardWorkloadFullEntry[]; agenda: DashboardAgendaEntry[]; activity: DashboardActivityEntry[]; guruList: GuruLite[]; notifications: NotificationEntry[] }) {
  const guruByName = new Map(guruList.map((g) => [g.namaGuru, g]));
  const bebanTertinggi = workloadFull.slice(0, 4);
  const salutation = useMemo(() => greetingSalutation(), []);
  const { prefs, reorder, setSpan, setFontSize, setFontFamily, setChartVariant, reset } = useDashboardPrefs();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const editing = customizeOpen;
  const [draggedId, setDraggedId] = useState<DashboardWidgetId | null>(null);
  const [dragOverId, setDragOverId] = useState<DashboardWidgetId | null>(null);

  function handleResize(id: DashboardWidgetId, dir: 1 | -1) {
    const current = prefs.spans[id] ?? 6;
    const idx = SPAN_PRESETS.findIndex((s) => s >= current);
    const nextIdx = Math.min(SPAN_PRESETS.length - 1, Math.max(0, (idx === -1 ? SPAN_PRESETS.length - 1 : idx) + dir));
    setSpan(id, SPAN_PRESETS[nextIdx]);
  }

  const widgetTitle: Record<DashboardWidgetId, string> = {
    rekapJtm: "Rekap JTM", bebanGuru: "Distribusi Beban Guru", heatmapGrid: "Heatmap Jadwal", bebanTertinggi: "Beban Guru Tertinggi",
    aktivitas: "Aktivitas Terbaru", insight: "Insight", kalender: "Mini Kalender", agenda: "Agenda", notifikasi: "Notifikasi Terbaru",
  };

  const widgetContent: Record<DashboardWidgetId, ReactNode> = {
    rekapJtm: <Section title="Rekap JTM" description="Jam Tatap Muka committed · klik titik/area untuk membuka analitik." href="/analitik" icon={<Activity size={14} />}><RekapJtm heatmap={heatmap} variant={prefs.chartVariant.rekapJtm === "batang" ? "batang" : "garis"} onVariantChange={(v) => setChartVariant("rekapJtm", v)} /></Section>,
    bebanGuru: <Section title="Distribusi Beban Guru" description="Ringan/Normal/Berat berdasarkan JP committed." href="/guru" icon={<Users size={14} />}><BebanDonut distribution={bebanDistribution} variant={prefs.chartVariant.bebanGuru} onVariantChange={(v) => setChartVariant("bebanGuru", v)} /></Section>,
    heatmapGrid: <Section title="Heatmap Jadwal" description="Kepadatan tiap jam pelajaran sepekan." href="/jadwal" icon={<Activity size={14} />}><HeatmapGrid grid={heatmapGrid} rooms={rooms} gridByRoom={heatmapGridByRoom} /></Section>,
    bebanTertinggi: <Section title="Beban Guru Tertinggi" description="Guru dengan JP committed tertinggi." href="/guru" icon={<Users size={14} />} badge={<span className="ml-1 inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[9px] font-bold text-ink-500">Top 5</span>}><div className="space-y-2">{bebanTertinggi.map((e) => { const style = BEBAN_STYLE[e.beban]; const g = guruList.find((item) => item.id === e.guruId); return <Link key={e.guruId} href={`/guru?teacher=${encodeURIComponent(e.guruId)}`} aria-label={`${e.namaGuru}: ${e.totalJamMengajar} JP, ${style.label}`} className="group flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"><Avatar name={e.namaGuru} size="md" kodeGuru={g?.kodeGuru} jenisKelamin={g?.jenisKelamin} /><span className="min-w-0 flex-1 truncate text-[10px] font-medium text-ink-800 group-hover:text-brand-700">{e.namaGuru}</span><span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${style.badge}`}>{style.label}</span><span className="text-[10px] font-bold tabular-nums text-ink-800">{e.totalJamMengajar} JP</span></Link>; })}{bebanTertinggi.length === 0 && <p className="text-[10px] text-ink-400">Belum ada guru aktif dengan jadwal committed.</p>}</div></Section>,
    aktivitas: <Section title="Aktivitas Terbaru" description="Perubahan terakhir pada konteks aktif." href="/riwayat" icon={<Clock3 size={14} />}><div className="space-y-2.5">{activity.slice(0, 4).map((a) => { const isGuru = a.entityType.toLowerCase().replace(/[- ]+/g, "_") === "guru"; const guru = isGuru && a.entityLabel ? guruByName.get(a.entityLabel) : undefined; return <Link key={a.id} href="/riwayat" className="group flex items-start gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">{isGuru ? <Avatar name={a.entityLabel} size="sm" kodeGuru={guru?.kodeGuru} jenisKelamin={guru?.jenisKelamin} /> : <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald"><CheckCircle2 size={12} aria-hidden="true" /></span>}<div className="min-w-0"><p className="truncate text-[10px] font-medium text-ink-800 group-hover:text-brand-700">{a.action}</p><time className="text-[8.5px] text-ink-400">{new Date(a.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}</time></div></Link>; })}</div></Section>,
    insight: <Section title="Insight" description="Sinyal yang layak diperhatikan, urut prioritas." href="/analitik" icon={<Lightbulb size={14} />}><SmartInsight jpInsight={jpInsight} bebanTertinggi={bebanTertinggi} bebanDistribution={bebanDistribution} /></Section>,
    kalender: <Section title="Mini Kalender" description="Bulan berjalan · titik menandai hari dengan jadwal committed." icon={<CalendarDays size={14} />}><MiniCalendar heatmap={heatmap} /></Section>,
    agenda: <AgendaSection agenda={agenda} guruList={guruList} guruByName={guruByName} />,
    notifikasi: <Section title="Notifikasi Terbaru" description="Aktivitas terbaru pada konteks aktif." href="/notifikasi" icon={<Bell size={14} />}><NotificationsPanel notifications={notifications} /></Section>,
  };

  return <main className="mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-[1760px] flex-col gap-3 px-1 pb-4 pt-3 sm:px-2 lg:gap-3.5">
    <header className="flex items-end justify-between gap-4 px-1">
      <div className="min-w-0">
        <p className="mb-1 text-[9px] font-bold uppercase tracking-[.14em] text-brand-600">{context ?? "Konteks akademik belum aktif"}</p>
        <h1 className="text-[21px] font-semibold leading-none tracking-[-.03em] text-ink-900">{salutation}{adminName ? `, ${adminName.split(/\s+/)[0]}` : ""} 👋</h1>
        <p className="mt-1.5 text-[11px] text-ink-500">Ringkasan kondisi akademik <span className="font-semibold text-ink-700">{schoolName}</span> dan jadwal sekolah.</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/analitik" className="hidden items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-[10px] font-semibold text-ink-600 shadow-sm hover:border-brand-600/25 hover:text-brand-700 sm:flex">Analitik <ArrowRight size={12} /></Link>
        <DashboardCustomizeBar open={customizeOpen} onToggle={() => setCustomizeOpen((v) => !v)} fontSize={prefs.fontSize} fontFamily={prefs.fontFamily} onFontSize={setFontSize} onFontFamily={setFontFamily} onReset={reset} />
      </div>
    </header>
    <KpiRow metrics={metrics} metricTrends={metricTrends} />
    <div style={{ zoom: FONT_SIZE_ZOOM[prefs.fontSize], fontFamily: FONT_FAMILY_STACK[prefs.fontFamily] }}>
      <div className="grid min-h-0 grid-cols-12 items-start gap-3">
        {prefs.order.map((id) => <Widget
          key={id}
          id={id}
          title={widgetTitle[id]}
          editing={editing}
          span={Math.min(prefs.spans[id] ?? 6, 12)}
          dragOverId={dragOverId}
          onDragStart={setDraggedId}
          onDragOver={setDragOverId}
          onDrop={(targetId) => { if (draggedId) reorder(draggedId, targetId); setDraggedId(null); setDragOverId(null); }}
          onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
          onResize={handleResize}
        >{widgetContent[id]}</Widget>)}
      </div>
    </div>
    <FloatingActionDock />
  </main>;
}
