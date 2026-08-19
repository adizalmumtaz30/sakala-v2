"use client";

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

      <label className="inline-flex items-center gap-2 text-[12px] font-medium text-ink-600">
        <SlidersHorizontal size={15} />
        Tampilkan
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-ink-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
          aria-label={`Jumlah ${label.toLowerCase()} per tampilan`}
        >
          {SAKALA_LIST_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        per tampilan
      </label>
    </div>
  );
}
