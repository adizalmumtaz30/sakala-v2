import type { CSSProperties } from "react";

type LongTextProps = {
  text: string | null | undefined;
  lines?: number;
  className?: string;
  detailLabel?: string;
};

export default function LongText({ text, lines = 2, className = "", detailLabel = "Lihat detail" }: LongTextProps) {
  const value = text?.trim() || "—";
  const clampStyle: CSSProperties = {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
  };

  return (
    <details className={`group min-w-0 ${className}`}>
      <summary className="cursor-pointer list-none outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-2 rounded-md">
        <span style={clampStyle} className="text-inherit">
          {value}
        </span>
        <span className="mt-1 inline-flex text-[11px] font-semibold text-brand-700 group-open:hidden">
          {detailLabel}
        </span>
      </summary>
      <div className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-surface-muted px-3 py-2 text-inherit">
        {value}
      </div>
      <span className="mt-1 inline-flex text-[11px] font-semibold text-brand-700 group-open:inline">
        Tutup detail
      </span>
    </details>
  );
}
