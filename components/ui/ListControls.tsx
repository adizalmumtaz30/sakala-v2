"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckSquare2, SlidersHorizontal } from "lucide-react";

export const SAKALA_LIST_PAGE_SIZES = [10, 20, 30, 40, 50] as const;

export default function ListControls({
  total,
  selectedCount = 0,
  allSelected = false,
  onSelectAll,
  pageSize,
  onPageSizeChange,
  label = "Item",
}: {
  total: number;
  selectedCount?: number;
  allSelected?: boolean;
  onSelectAll?: (checked: boolean) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  label?: string;
}) {
  const maxItems = Math.max(1, total);
  const safePageSize = Math.min(maxItems, Math.max(1, Math.floor(pageSize) || 1));
  const [manualValue, setManualValue] = useState(String(safePageSize));

  useEffect(() => {
    setManualValue(String(safePageSize));
  }, [safePageSize]);

  const presetSizes = useMemo(
    () => Array.from(new Set([...SAKALA_LIST_PAGE_SIZES, maxItems])).filter((size) => size <= maxItems),
    [maxItems],
  );

  function applyManualValue(raw: string) {
    setManualValue(raw);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const next = Math.min(maxItems, Math.max(1, Math.floor(parsed)));
    onPageSizeChange(next);
    setManualValue(String(next));
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {onSelectAll && total > 0 && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-ink-700">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => onSelectAll(event.target.checked)}
              aria-label={`Pilih semua ${label}`}
              className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
            />
            <CheckSquare2 size={15} className="text-brand-600" />
            Pilih semua
          </label>
        )}
        <span className="text-[12px] text-ink-500">
          {selectedCount > 0 ? `${selectedCount} dipilih · ` : ""}{total} {label.toLowerCase()}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-ink-600">
        <SlidersHorizontal size={15} />
        <span>Tampilkan</span>
        <select
          value={safePageSize}
          onChange={(event) => onPageSizeChange(Math.min(maxItems, Math.max(1, Number(event.target.value))))}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-ink-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
          aria-label={`Pilihan jumlah ${label.toLowerCase()} per tampilan`}
        >
          {presetSizes.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <span>atau</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={maxItems}
          value={manualValue}
          onChange={(event) => applyManualValue(event.target.value)}
          onBlur={() => applyManualValue(manualValue || "1")}
          className="h-8 w-20 rounded-lg border border-border bg-surface px-2 text-center text-[12px] font-semibold text-ink-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
          aria-label={`Masukkan jumlah ${label.toLowerCase()} per tampilan`}
        />
        <span>item</span>
      </div>
    </div>
  );
}
