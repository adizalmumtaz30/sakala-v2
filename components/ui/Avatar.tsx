import { getInitials, avatarColor } from "@/lib/utils/avatar";
import { avatarPalette } from "@/lib/utils/avatarIllustration";
import WomanAvatar from "@/components/ui/avatars/WomanAvatar";
import ManAvatar from "@/components/ui/avatars/ManAvatar";

type Size = "sm" | "md" | "lg";

const sizeClass: Record<Size, string> = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-[13px]",
  lg: "h-14 w-14 text-[18px]",
};

/**
 * Avatar guru/persona (SAKALA V2.3 Bagian 15-16; Penyempurnaan #1 Icon & Avatar
 * Premium). Kalau `jenisKelamin` + `kodeGuru` tersedia, render ilustrasi flat
 * premium (varian warna stabil per kodeGuru). Kalau tidak (guru lama yang
 * belum diisi, atau entitas non-guru), fallback ke initial avatar seperti
 * sebelumnya — backward compatible, tidak ada breaking change.
 */
export default function Avatar({
  name,
  size = "md",
  jenisKelamin,
  kodeGuru,
}: {
  name: string;
  size?: Size;
  jenisKelamin?: "L" | "P";
  kodeGuru?: string;
}) {
  if (jenisKelamin && kodeGuru) {
    const palette = avatarPalette(kodeGuru);
    const Illustration = jenisKelamin === "P" ? WomanAvatar : ManAvatar;
    return (
      <div className={`shrink-0 overflow-hidden rounded-full ring-1 ring-border ${sizeClass[size]}`} aria-hidden="true">
        <Illustration palette={palette} className="h-full w-full" />
      </div>
    );
  }

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
