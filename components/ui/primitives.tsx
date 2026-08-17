import type { CSSProperties } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import Button from "./Button";

export function Card({
  className = "",
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div style={style} className={`rounded-card border border-border bg-surface p-5 ${className}`}>
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

export function Badge({ tone = "neutral", children, title }: { tone?: BadgeTone; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeTone[tone]}`}>
      {children}
    </span>
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
