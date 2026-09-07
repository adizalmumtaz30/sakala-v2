import type { CSSProperties } from "react";
import { AlertTriangle, Inbox, RefreshCw, Check, X } from "lucide-react";
import Button from "./Button";

export function Card({
  id,
  className = "",
  style,
  children,
}: {
  id?: string;
  className?: string;
  style?: CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div id={id} style={style} className={`rounded-card border border-border bg-surface p-5 ${className}`}>
      {children}
    </div>
  );
}

type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";
const badgeTone: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald",
  warning: "bg-amber-50 text-amber",
  danger: "bg-rose-50 text-rose",
  info: "bg-brand-50 text-brand-700",
  neutral: "bg-surface-muted text-ink-500",
};

export function Badge({ tone = "neutral", children, title, className }: { tone?: BadgeTone; children: React.ReactNode; title?: string; className?: string }) {
  return (
    <span title={title} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeTone[tone]} ${className ?? ""}`}>
      {children}
    </span>
  );
}

// §4 masukan operator: "aku ingin ada saklar beneran — klik aktif jadi
// hijau, klik lagi jadi nonaktif merah, bukan cuma teks/badge yang diklik."
// Satu komponen dipakai ulang di semua fitur yang punya status aktif/nonaktif
// (Guru, Mata Pelajaran, Kelas, Ruangan, Pembagian Mengajar, dst) — bukan
// implementasi beda-beda tiap halaman.
export function StatusSwitch({
  checked,
  onToggle,
  disabled,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const tone = checked ? "var(--color-emerald)" : "var(--color-rose)";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? (checked ? "Aktif, klik untuk nonaktifkan" : "Nonaktif, klik untuk aktifkan")}
      onClick={onToggle}
      disabled={disabled}
      className="group inline-flex items-center gap-2.5 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {/* Track: gradient 2-lapis dari token warna asli tema + gloss halus di
          atas (bukan flat 1 warna) + glow ambient tipis yang ikut warna
          status — kesan lebih "hidup", bukan toggle template generik.
          Hover: track sedikit membesar untuk afordansi sentuh. */}
      <span
        className="relative block h-[25px] w-[46px] shrink-0 overflow-hidden rounded-full transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,0.8,0.24,1)] group-hover:scale-[1.04]"
        style={{
          background: `linear-gradient(160deg, color-mix(in srgb, ${tone} 92%, white) 0%, ${tone} 45%, color-mix(in srgb, ${tone} 78%, black) 100%)`,
          boxShadow: `inset 0 1px 1.5px rgba(255,255,255,.4), inset 0 -2px 4px rgba(0,0,0,.16), 0 0 0 1px color-mix(in srgb, ${tone} 25%, transparent), 0 3px 10px -4px color-mix(in srgb, ${tone} 55%, transparent)`,
        }}
      >
        {/* Gloss: highlight kaca tipis di sepertiga atas track */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,.30) 0%, rgba(255,255,255,0) 100%)" }}
        />
        <span
          className="absolute top-1/2 flex h-[20px] w-[20px] -translate-y-1/2 items-center justify-center rounded-full bg-white transition-[left] duration-[420ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-active:w-[24px]"
          style={{
            left: checked ? "23px" : "2.5px",
            boxShadow: "0 1px 2px rgba(0,0,0,.18), 0 3px 8px rgba(0,0,0,.16), inset 0 -1px 1.5px rgba(0,0,0,.05)",
          }}
        >
          <span
            key={checked ? "on" : "off"}
            className="animate-[switchPop_260ms_cubic-bezier(0.34,1.56,0.64,1)]"
          >
            {checked ? (
              <Check size={11} strokeWidth={3} className="text-emerald-600" />
            ) : (
              <X size={11} strokeWidth={3} className="text-rose-600" />
            )}
          </span>
        </span>
      </span>
      <span className={`text-[12.5px] font-semibold tracking-[0.01em] transition-colors duration-300 ${checked ? "text-emerald-700" : "text-rose-700"}`}>
        {checked ? "Aktif" : "Nonaktif"}
      </span>
    </button>
  );
}

// Bagian 15.2 — Empty state
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-ink-300">
        <Inbox size={20} />
      </div>
      <p className="text-[14px] font-semibold text-ink-900">{title}</p>
      {description && <p className="max-w-xs text-[12.5px] text-ink-500">{description}</p>}
      {action}
    </div>
  );
}

// Bagian 15.3 — Error state, harus ada tombol retry (15.5 — no infinite loading)
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose">
        <AlertTriangle size={20} />
      </div>
      <p className="text-[14px] font-semibold text-ink-900">Terjadi kesalahan</p>
      <p className="max-w-xs text-[12.5px] text-ink-500">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw size={14} /> Coba lagi
        </Button>
      )}
    </div>
  );
}

// Bagian 15.1 — Loading skeleton, bukan spinner polos
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-12 w-full" />
      ))}
    </div>
  );
}
