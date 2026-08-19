"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

type LongTextProps = {
  text: string | null | undefined;
  lines?: number;
  className?: string;
  detailLabel?: string;
  allowCustomLines?: boolean;
  minLines?: number;
  maxLines?: number;
};

export default function LongText({
  text,
  lines = 2,
  className = "",
  detailLabel = "Lihat detail",
  allowCustomLines = true,
  minLines = 1,
  maxLines = 20,
}: LongTextProps) {
  const value = text?.trim() || "—";
  const safeMin = Math.max(1, Math.floor(minLines));
  const safeMax = Math.max(safeMin, Math.floor(maxLines));
  const initialLines = Math.min(safeMax, Math.max(safeMin, Math.floor(lines) || safeMin));
  const [visibleLines, setVisibleLines] = useState(initialLines);

  const clampStyle: CSSProperties = {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: visibleLines,
    overflow: "hidden",
  };

  function handleLinesChange(nextValue: string) {
    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed)) return;
    setVisibleLines(Math.min(safeMax, Math.max(safeMin, Math.floor(parsed))));
  }

  return (
    <details className={`group min-w-0 ${className}`}>
      <summary className="cursor-pointer list-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-2">
        <span style={clampStyle} className="text-inherit">
          {value}
        </span>
        <span className="mt-1 inline-flex text-[11px] font-semibold text-brand-700 group-open:hidden">
          {detailLabel}
        </span>
      </summary>

      {allowCustomLines && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-500">
          <label htmlFor="long-text-view-lines" className="shrink-0 font-medium">
            View
          </label>
          <input
            id="long-text-view-lines"
            type="number"
            inputMode="numeric"
            min={safeMin}
            max={safeMax}
            value={visibleLines}
            onChange={(event) => handleLinesChange(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            className="h-7 w-16 rounded-md border border-border bg-surface px-2 text-center text-[11px] font-semibold text-ink-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10"
            aria-label="Jumlah baris yang ingin dilihat"
          />
          <span>baris</span>
        </div>
      )}

      <div className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-surface-muted px-3 py-2 text-inherit">
        {value}
      </div>
      <span className="mt-1 inline-flex text-[11px] font-semibold text-brand-700 group-open:inline">
        Tutup detail
      </span>
    </details>
  );
}
