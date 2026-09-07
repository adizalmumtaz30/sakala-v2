"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

// §5 masukan operator: "kalau item-nya banyak (guru, mata pelajaran), jangan
// scroll panjang — kasih pencarian." Satu komponen dipakai ulang di semua
// dropdown panjang di seluruh SAKALA (bukan implementasi beda-beda per
// halaman). File terpisah dari primitives.tsx karena butuh hooks — beberapa
// halaman server component mengimpor primitives.tsx langsung, jadi hooks
// tidak boleh ikut di sana.
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Cari & pilih...",
  required,
  disabled,
}: {
  options: Array<{ id: string; label: string; sublabel?: string }>;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = query.trim()
    ? options.filter((o) => `${o.label} ${o.sublabel ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => !disabled && setOpen(true)}
        className={`flex h-11 items-center gap-2 rounded-xl border bg-surface px-3.5 text-[13.5px] outline-none ${
          open ? "border-brand-600/50 ring-2 ring-brand-600/15" : "border-border"
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-text"}`}
      >
        <Search size={14} className="shrink-0 text-ink-400" />
        <input
          value={open ? query : (selected?.label ?? "")}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(""); }}
          placeholder={selected ? selected.label : placeholder}
          required={required && !value}
          disabled={disabled}
          className="w-full min-w-0 flex-1 bg-transparent text-ink-900 outline-none placeholder:text-ink-400"
        />
        {value && !open && (
          <button
            type="button"
            aria-label="Bersihkan pilihan"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="shrink-0 text-ink-300 hover:text-ink-600"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-[12.5px] text-ink-400">Tidak ada yang cocok.</p>
          ) : (
            filtered.map((o) => (
              <button
                type="button"
                key={o.id}
                onClick={() => { onChange(o.id); setOpen(false); setQuery(""); }}
                className={`flex w-full flex-col rounded-lg px-3 py-2 text-left text-[13px] hover:bg-surface-muted ${o.id === value ? "bg-brand-50 text-brand-800" : "text-ink-800"}`}
              >
                <span className="font-medium">{o.label}</span>
                {o.sublabel && <span className="text-[11.5px] text-ink-400">{o.sublabel}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
