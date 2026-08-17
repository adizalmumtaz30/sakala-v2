import type { ReactNode } from "react";

// Penyempurnaan #1 (Icon & Avatar Premium) — SAKALA V2.3.
// Upgrade lucide-react existing (bukan icon set custom baru): bungkus icon
// dalam chip berwarna konsisten, dipakai di header halaman, key metrics,
// dan tombol aksi. Tone memakai token warna yang sudah ada di tailwind.config.ts
// (pola sama seperti METRIC_TONE di Dashboard — disatukan di sini).

export type IconChipTone = "brand" | "violet" | "cyan" | "amber" | "emerald" | "rose" | "neutral";
type Size = "sm" | "md" | "lg";

const TONE_CLASS: Record<IconChipTone, { chip: string; icon: string }> = {
  brand: { chip: "bg-brand-50", icon: "text-brand-600" },
  violet: { chip: "bg-violet-50", icon: "text-violet" },
  cyan: { chip: "bg-cyan-50", icon: "text-cyan" },
  amber: { chip: "bg-amber-50", icon: "text-amber" },
  emerald: { chip: "bg-emerald-50", icon: "text-emerald" },
  rose: { chip: "bg-rose-50", icon: "text-rose" },
  neutral: { chip: "bg-surface-muted", icon: "text-ink-500" },
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-7 w-7 rounded-lg",
  md: "h-8 w-8 rounded-lg",
  lg: "h-12 w-12 rounded-xl2",
};

/** Chip icon premium — dipakai untuk header halaman, key metrics, dan tombol aksi bertone. */
export default function IconChip({
  icon,
  tone = "neutral",
  size = "md",
  className = "",
  shadow = false,
}: {
  icon: ReactNode;
  tone?: IconChipTone;
  size?: Size;
  className?: string;
  shadow?: boolean;
}) {
  const t = TONE_CLASS[tone];
  return (
    <span
      className={`flex shrink-0 items-center justify-center transition-transform ${SIZE_CLASS[size]} ${t.chip} ${t.icon} ${shadow ? "shadow-soft" : ""} ${className}`}
    >
      {icon}
    </span>
  );
}
