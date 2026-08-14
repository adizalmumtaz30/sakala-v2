import { getInitials, avatarColor } from "@/lib/utils/avatar";

type Size = "sm" | "md" | "lg";

const sizeClass: Record<Size, string> = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-[13px]",
  lg: "h-14 w-14 text-[18px]",
};

/**
 * Avatar guru/persona (SAKALA V2.3 Bagian 15-16).
 * Belum ada dukungan foto asli (kolom foto belum ada di skema) — fallback
 * initial avatar dengan warna stabil per nama, bukan generic gray circle.
 */
export default function Avatar({ name, size = "md" }: { name: string; size?: Size }) {
  const { bg, text } = avatarColor(name || "?");
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${sizeClass[size]}`}
      style={{ backgroundColor: bg, color: text }}
      aria-hidden="true"
    >
      {getInitials(name || "?")}
    </div>
  );
}
