import type { AvatarPalette } from "@/lib/utils/avatarIllustration";

/**
 * Ilustrasi avatar pria berpeci — SVG original flat-style, senada dengan
 * bahasa visual macOS-inspired SAKALA (bukan hasil trace file luar).
 * Penyempurnaan #1 (Icon & Avatar Premium), SAKALA V2.3.
 */
export default function ManAvatar({ palette, className }: { palette: AvatarPalette; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-hidden="true">
      <defs>
        <clipPath id="manClip">
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath="url(#manClip)">
        <circle cx="32" cy="32" r="32" fill={palette.primary} opacity="0.14" />
        {/* Bahu / kemeja */}
        <path d="M4 64c0-12.5 12.5-20 28-20s28 7.5 28 20v4H4v-4z" fill={palette.clothing} />
        {/* Kerah kemeja */}
        <path d="M24 42l8 8 8-8-4-3h-8l-4 3z" fill={palette.primary} />
        {/* Kancing */}
        <circle cx="32" cy="54" r="1.6" fill="#F1F3FA" />
        <circle cx="32" cy="60" r="1.6" fill="#F1F3FA" />
        {/* Telinga */}
        <circle cx="18.5" cy="30" r="3.2" fill={palette.skin} />
        <circle cx="45.5" cy="30" r="3.2" fill={palette.skin} />
        {/* Leher */}
        <rect x="26" y="33" width="12" height="12" rx="4" fill={palette.skin} />
        {/* Wajah */}
        <path d="M32 12c8 0 13.5 6.4 13.5 15.5 0 9.6-5.9 17-13.5 17s-13.5-7.4-13.5-17C18.5 18.4 24 12 32 12z" fill={palette.skin} />
        {/* Senyum sederhana */}
        <path d="M26.5 30.5c1.4 2 3.4 3.1 5.5 3.1s4.1-1.1 5.5-3.1c-1 3-3.1 5-5.5 5s-4.5-2-5.5-5z" fill={palette.primaryDark} opacity="0.5" />
        {/* Peci */}
        <path d="M17 20c0-7.2 6.7-13 15-13s15 5.8 15 13c0 1.7-1.3 3-3 3H20c-1.7 0-3-1.3-3-3z" fill={palette.primary} />
        <path d="M17 20c0-7.2 6.7-13 15-13v16H20c-1.7 0-3-1.3-3-3z" fill={palette.primaryDark} opacity="0.35" />
      </g>
    </svg>
  );
}
