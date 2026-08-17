import type { AvatarPalette } from "@/lib/utils/avatarIllustration";

/**
 * Ilustrasi avatar wanita berkerudung — SVG original flat-style, senada
 * dengan bahasa visual macOS-inspired SAKALA (bukan hasil trace file luar).
 * Penyempurnaan #1 (Icon & Avatar Premium), SAKALA V2.3.
 */
export default function WomanAvatar({ palette, className }: { palette: AvatarPalette; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-hidden="true">
      <defs>
        <clipPath id="womanClip">
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath="url(#womanClip)">
        <circle cx="32" cy="32" r="32" fill={palette.primary} opacity="0.14" />
        {/* Bahu / pakaian */}
        <path d="M6 64c0-13 11.6-21 26-21s26 8 26 21v4H6v-4z" fill={palette.clothing} />
        <path d="M24 45.5c2.4 1.3 5.2 2 8 2s5.6-.7 8-2v10.5c0 1.9-1.5 3-3.5 3H27.5c-2 0-3.5-1.1-3.5-3V45.5z" fill="#F1F3FA" />
        {/* Leher */}
        <rect x="26" y="34" width="12" height="14" rx="5" fill={palette.skin} />
        {/* Kerudung belakang */}
        <path
          d="M32 6c10.5 0 17 8.7 17 19.5 0 8-3.6 14.5-8 18.7-1 .9-2.5.3-2.6-1.1l-.6-8.4c3-2.5 4.8-6.4 4.8-10.7 0-7.4-4.7-12.8-10.6-12.8s-10.6 5.4-10.6 12.8c0 4.3 1.8 8.2 4.8 10.7l-.6 8.4c-.1 1.4-1.6 2-2.6 1.1-4.4-4.2-8-10.7-8-18.7C15 14.7 21.5 6 32 6z"
          fill={palette.primary}
        />
        {/* Wajah */}
        <circle cx="32" cy="29.5" r="12.5" fill={palette.skin} />
        {/* Lengkung dalam kerudung (bingkai wajah) */}
        <path
          d="M20.3 24.5c1.3-6.6 6.1-11 11.7-11s10.4 4.4 11.7 11c-1.9-4.3-6.3-7.3-11.7-7.3s-9.8 3-11.7 7.3z"
          fill="#F1F3FA"
        />
        {/* Senyum sederhana */}
        <path d="M26.5 32.5c1.4 2 3.4 3.1 5.5 3.1s4.1-1.1 5.5-3.1c-1 3-3.1 5-5.5 5s-4.5-2-5.5-5z" fill={palette.primaryDark} opacity="0.55" />
        {/* Kerudung depan menutup dagu/leher */}
        <path
          d="M17 30c0 9 5.4 15.3 8.6 18 1.1.9 2.7-.2 2.4-1.6l-1.4-6.7c-3.6-2.2-6.6-5.9-8.2-10.3-.6-1.6-1.4-1.4-1.4.6z"
          fill={palette.primaryDark}
          opacity="0.9"
        />
        <path
          d="M47 30c0 9-5.4 15.3-8.6 18-1.1.9-2.7-.2-2.4-1.6l1.4-6.7c3.6-2.2 6.6-5.9 8.2-10.3.6-1.6 1.4-1.4 1.4.6z"
          fill={palette.primaryDark}
          opacity="0.9"
        />
      </g>
    </svg>
  );
}
