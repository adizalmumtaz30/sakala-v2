// Teacher Identity Color (SAKALA V2.3 — Catatan Penyempurnaan #10 "Identitas Warna untuk Setiap Guru").
// Warna ini adalah identitas visual UTAMA card slot pada Jadwal: stabil per guru,
// mudah dipindai, tetapi tetap menjaga readability.

export interface TeacherColor {
  /** Background card Jadwal — sengaja terlihat jelas, bukan hampir putih. */
  tint: string;
  /** Accent strip / border / aksen. */
  accent: string;
  /** Warna teks sekunder yang kontras di atas tint. */
  text: string;
}

// 18 warna premium yang cukup kuat untuk membuat card slot kembali "hidup".
// Hue dibuat berjauhan agar jadwal mudah dipindai secara visual.
const PALETTE: TeacherColor[] = [
  { tint: "#C7D2FE", accent: "#4F46E5", text: "#312E81" }, // indigo
  { tint: "#FED7AA", accent: "#EA580C", text: "#9A3412" }, // orange
  { tint: "#A5F3FC", accent: "#0891B2", text: "#155E75" }, // cyan
  { tint: "#FBCFE8", accent: "#DB2777", text: "#9D174D" }, // pink
  { tint: "#BBF7D0", accent: "#16A34A", text: "#166534" }, // green
  { tint: "#FECACA", accent: "#DC2626", text: "#991B1B" }, // red
  { tint: "#E9D5FF", accent: "#9333EA", text: "#6B21A8" }, // purple
  { tint: "#FDE68A", accent: "#CA8A04", text: "#854D0E" }, // amber
  { tint: "#BAE6FD", accent: "#0284C7", text: "#075985" }, // sky
  { tint: "#F5D0FE", accent: "#C026D3", text: "#86198F" }, // fuchsia
  { tint: "#D9F99D", accent: "#65A30D", text: "#3F6212" }, // lime
  { tint: "#FECDD3", accent: "#E11D48", text: "#9F1239" }, // rose
  { tint: "#BFDBFE", accent: "#2563EB", text: "#1E40AF" }, // blue
  { tint: "#FDE68A", accent: "#D97706", text: "#92400E" }, // amber-deep
  { tint: "#A7F3D0", accent: "#059669", text: "#065F46" }, // emerald
  { tint: "#DDD6FE", accent: "#7C3AED", text: "#5B21B6" }, // violet
  { tint: "#FDE68A", accent: "#A16207", text: "#713F12" }, // gold
  { tint: "#99F6E4", accent: "#0D9488", text: "#115E59" }, // teal
];

/** Hash string sederhana, deterministik lintas render/sesi. */
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Warna identitas guru, stabil per kodeGuru (fallback ke id). */
export function teacherColor(kodeGuruOrId: string): TeacherColor {
  const seed = kodeGuruOrId || "?";
  const index = hashSeed(seed) % PALETTE.length;
  return PALETTE[index];
}
