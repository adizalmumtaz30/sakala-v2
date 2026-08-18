// Teacher Identity Color (SAKALA V2.3).
// Warna ini adalah identitas visual UTAMA card slot pada Jadwal: stabil per guru
// dan sengaja SOLID agar perbedaan antar-guru langsung terbaca di grid.

export interface TeacherColor {
  /** Background card Jadwal — SOLID per guru. */
  tint: string;
  /** Accent/border — sama dengan warna solid card. */
  accent: string;
  /** Warna teks — putih untuk kontras di atas card solid. */
  text: string;
}

const PALETTE: TeacherColor[] = [
  { tint: "#4F46E5", accent: "#4F46E5", text: "#FFFFFF" }, // indigo
  { tint: "#EA580C", accent: "#EA580C", text: "#FFFFFF" }, // orange
  { tint: "#0891B2", accent: "#0891B2", text: "#FFFFFF" }, // cyan
  { tint: "#DB2777", accent: "#DB2777", text: "#FFFFFF" }, // pink
  { tint: "#16A34A", accent: "#16A34A", text: "#FFFFFF" }, // green
  { tint: "#DC2626", accent: "#DC2626", text: "#FFFFFF" }, // red
  { tint: "#9333EA", accent: "#9333EA", text: "#FFFFFF" }, // purple
  { tint: "#CA8A04", accent: "#CA8A04", text: "#FFFFFF" }, // amber
  { tint: "#0284C7", accent: "#0284C7", text: "#FFFFFF" }, // sky
  { tint: "#C026D3", accent: "#C026D3", text: "#FFFFFF" }, // fuchsia
  { tint: "#65A30D", accent: "#65A30D", text: "#FFFFFF" }, // lime
  { tint: "#E11D48", accent: "#E11D48", text: "#FFFFFF" }, // rose
  { tint: "#2563EB", accent: "#2563EB", text: "#FFFFFF" }, // blue
  { tint: "#D97706", accent: "#D97706", text: "#FFFFFF" }, // amber-deep
  { tint: "#059669", accent: "#059669", text: "#FFFFFF" }, // emerald
  { tint: "#7C3AED", accent: "#7C3AED", text: "#FFFFFF" }, // violet
  { tint: "#A16207", accent: "#A16207", text: "#FFFFFF" }, // gold
  { tint: "#0D9488", accent: "#0D9488", text: "#FFFFFF" }, // teal
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function teacherColor(kodeGuruOrId: string): TeacherColor {
  const seed = kodeGuruOrId || "?";
  const index = hashSeed(seed) % PALETTE.length;
  return PALETTE[index];
}
