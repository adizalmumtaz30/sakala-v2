// Penyempurnaan #1 (Icon & Avatar Premium) — SAKALA V2.3.
// Palet & pemilihan varian ilustrasi avatar guru secara deterministik
// (stabil per kodeGuru, bukan random tiap render — pola sama seperti
// lib/utils/teacherColor.ts).

export interface AvatarPalette {
  /** Warna kerudung (wanita) / peci & kerah (pria). */
  primary: string;
  primaryDark: string;
  /** Warna pakaian/bahu. */
  clothing: string;
  /** Warna kulit. */
  skin: string;
}

// Kombinasi warna premium & muted — senada dengan token brand/cyan/amber/
// violet/emerald/rose di tailwind.config.ts, tapi versi lebih lembut khusus
// ilustrasi (supaya tidak terlalu saturated di area besar seperti kerudung).
const PALETTES: AvatarPalette[] = [
  { primary: "#6C8EF5", primaryDark: "#4A67D6", clothing: "#4B5170", skin: "#F5B294" },
  { primary: "#F0A85B", primaryDark: "#D6862F", clothing: "#3D4358", skin: "#E8A26E" },
  { primary: "#5FBFA8", primaryDark: "#3D9A85", clothing: "#42506B", skin: "#F5B294" },
  { primary: "#B683E0", primaryDark: "#9257C2", clothing: "#464B66", skin: "#E8A26E" },
  { primary: "#5FA8D6", primaryDark: "#3B84B3", clothing: "#3D4358", skin: "#F7C29B" },
  { primary: "#E3849B", primaryDark: "#C25E77", clothing: "#464B66", skin: "#D98F63" },
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Palet stabil per kodeGuru — guru yang sama selalu dapat kombinasi warna sama. */
export function avatarPalette(seed: string): AvatarPalette {
  return PALETTES[hashSeed(seed) % PALETTES.length];
}
