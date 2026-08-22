"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Preferensi kustomisasi Dashboard: font, urutan widget, ukuran (grid-column
 * span dari 12 kolom), dan varian tampilan grafik. Disimpan di localStorage
 * per-browser (bukan per-akun/server) — cukup untuk kebutuhan "atur tampilan
 * dashboard sesuai selera saya di perangkat ini".
 */

export const DASHBOARD_WIDGET_IDS = [
  "rekapJtm",
  "bebanGuru",
  "heatmapGrid",
  "bebanTertinggi",
  "aktivitas",
  "insight",
  "kalender",
  "agenda",
  "notifikasi",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export type FontSize = "sm" | "md" | "lg";
export type FontFamily = "default" | "serif" | "mono";
export type RekapJtmVariant = "garis" | "batang";
export type BebanGuruVariant = "donut" | "batang";

export interface DashboardPrefs {
  fontSize: FontSize;
  fontFamily: FontFamily;
  order: DashboardWidgetId[];
  spans: Record<DashboardWidgetId, number>;
  chartVariant: { rekapJtm: RekapJtmVariant; bebanGuru: BebanGuruVariant };
}

export const FONT_SIZE_ZOOM: Record<FontSize, number> = { sm: 0.92, md: 1, lg: 1.15 };
export const FONT_FAMILY_STACK: Record<FontFamily, string | undefined> = {
  default: undefined, // warisi Inter dari body — tidak perlu override
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', ui-monospace, 'Courier New', monospace",
};
export const FONT_SIZE_LABEL: Record<FontSize, string> = { sm: "Kecil", md: "Sedang", lg: "Besar" };
export const FONT_FAMILY_LABEL: Record<FontFamily, string> = { default: "Default (Inter)", serif: "Serif elegan", mono: "Mono teknikal" };

export const DEFAULT_SPANS: Record<DashboardWidgetId, number> = {
  rekapJtm: 8,
  bebanGuru: 4,
  heatmapGrid: 7,
  bebanTertinggi: 5,
  aktivitas: 6,
  insight: 6,
  kalender: 4,
  agenda: 4,
  notifikasi: 4,
};

export const DEFAULT_PREFS: DashboardPrefs = {
  fontSize: "md",
  fontFamily: "default",
  order: [...DASHBOARD_WIDGET_IDS],
  spans: { ...DEFAULT_SPANS },
  chartVariant: { rekapJtm: "garis", bebanGuru: "donut" },
};

const STORAGE_KEY = "sakala:dashboard-prefs:v1";
// Preset lebar widget dalam grid 12 kolom — dipakai tombol "perbesar/perkecil".
export const SPAN_PRESETS = [4, 5, 6, 7, 8, 12] as const;

function sanitize(raw: unknown): DashboardPrefs {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFS;
  const r = raw as Partial<DashboardPrefs>;
  const order = Array.isArray(r.order) && r.order.every((id) => (DASHBOARD_WIDGET_IDS as readonly string[]).includes(id))
    ? (DASHBOARD_WIDGET_IDS as readonly string[]).filter((id) => (r.order as string[]).includes(id)).length === DASHBOARD_WIDGET_IDS.length
      ? (r.order as DashboardWidgetId[])
      : [...DASHBOARD_WIDGET_IDS]
    : [...DASHBOARD_WIDGET_IDS];
  const spans = { ...DEFAULT_SPANS, ...(r.spans && typeof r.spans === "object" ? r.spans : {}) };
  return {
    fontSize: r.fontSize === "sm" || r.fontSize === "lg" ? r.fontSize : "md",
    fontFamily: r.fontFamily === "serif" || r.fontFamily === "mono" ? r.fontFamily : "default",
    order,
    spans,
    chartVariant: {
      rekapJtm: r.chartVariant?.rekapJtm === "batang" ? "batang" : "garis",
      bebanGuru: r.chartVariant?.bebanGuru === "batang" ? "batang" : "donut",
    },
  };
}

export function useDashboardPrefs() {
  const [prefs, setPrefs] = useState<DashboardPrefs>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefs(sanitize(JSON.parse(raw)));
    } catch {
      // localStorage tidak tersedia/rusak — pakai default, jangan sampai crash dashboard.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // quota penuh / private mode — abaikan, preferensi cukup berlaku untuk sesi ini saja.
    }
  }, [prefs, hydrated]);

  const reset = useCallback(() => setPrefs(DEFAULT_PREFS), []);

  const reorder = useCallback((draggedId: DashboardWidgetId, targetId: DashboardWidgetId) => {
    if (draggedId === targetId) return;
    setPrefs((p) => {
      const order = [...p.order];
      const from = order.indexOf(draggedId);
      const to = order.indexOf(targetId);
      if (from === -1 || to === -1) return p;
      order.splice(from, 1);
      order.splice(order.indexOf(targetId) === -1 ? to : order.indexOf(targetId), 0, draggedId);
      // Widget yang digeser mengikuti ukuran (span) slot tujuan — supaya "geser A ke posisi B" terasa alami.
      const spans = { ...p.spans, [draggedId]: p.spans[targetId] };
      return { ...p, order, spans };
    });
  }, []);

  const setSpan = useCallback((id: DashboardWidgetId, span: number) => {
    setPrefs((p) => ({ ...p, spans: { ...p.spans, [id]: span } }));
  }, []);

  const setFontSize = useCallback((fontSize: FontSize) => setPrefs((p) => ({ ...p, fontSize })), []);
  const setFontFamily = useCallback((fontFamily: FontFamily) => setPrefs((p) => ({ ...p, fontFamily })), []);
  const setChartVariant = useCallback(<K extends keyof DashboardPrefs["chartVariant"]>(key: K, value: DashboardPrefs["chartVariant"][K]) => {
    setPrefs((p) => ({ ...p, chartVariant: { ...p.chartVariant, [key]: value } }));
  }, []);

  return { prefs, hydrated, reorder, setSpan, setFontSize, setFontFamily, setChartVariant, reset };
}
