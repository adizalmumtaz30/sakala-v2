import type { CSSProperties } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
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
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? (checked ? "Aktif, klik untuk nonaktifkan" : "Nonaktif, klik untuk aktifkan")}
      onClick={onToggle}
      disabled={disabled}
      className={`inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span
        className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-emerald-500" : "bg-rose-400"
        }`}
      >
        <span
          className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </span>
      <span className={`text-[12.5px] font-semibold ${checked ? "text-emerald-700" : "text-rose-700"}`}>
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
