// Teacher Identity Color (SAKALA V2.3 — Catatan Penyempurnaan #10 "Identitas
// Warna untuk Setiap Guru"). Setiap guru mendapat warna identitas yang:
// - di-assign otomatis (tidak perlu dipilih manual oleh operator)
// - stabil & konsisten di seluruh halaman (Data Guru maupun kotak Jadwal),
//   karena di-hash dari kodeGuru (identitas permanen, bukan dari nama yang
//   bisa diedit)
// - dipakai sebagai tint/accent dengan tint yang cukup terasa untuk menjaga
//   identitas visual tanpa mengorbankan readability.
// - palette cycling menjaga warna yang berurutan dalam hash space tidak mirip
//   (disusun berselang-seling hue, bukan berurutan gradasi)

export interface TeacherColor {
  /** Tint premium yang terlihat jelas untuk background kotak jadwal / chip. */
  tint: string;
  /** Warna accent lebih pekat — dipakai untuk border-left strip / dot / teks aksen. */
  accent: string;
  /** Warna teks yang tetap kontras di atas tint. */
  text: string;
}

// 18 warna identitas premium. Tint sengaja dinaikkan satu tingkat dari versi
// ultra-muted agar grid tetap hidup dan mudah dipindai, sementara accent tetap
// cukup pekat untuk menjaga hierarchy dan aksesibilitas.
const PALETTE: TeacherColor[] = [
  { tint: "#E0E7FF", accent: "#4F46E5", text: "#3730A3" }, // indigo
  { tint: "#FFEDD5", accent: "#EA580C", text: "#9A3412" }, // orange
  { tint: "#CFFAFE", accent: "#0891B2", text: "#155E75" }, // cyan
  { tint: "#FCE7F3", accent: "#DB2777", text: "#9D174D" }, // pink
  { tint: "#DCFCE7", accent: "#16A34A", text: "#166534" }, // green
  { tint: "#FEE2E2", accent: "#DC2626", text: "#991B1B" }, // red
  { tint: "#F3E8FF", accent: "#9333EA", text: "#6B21A8" }, // purple
  { tint: "#FEF3C7", accent: "#CA8A04", text: "#854D0E" }, // amber
  { tint: "#E0F2FE", accent: "#0284C7", text: "#075985" }, // sky
  { tint: "#FAE8FF", accent: "#C026D3", text: "#86198F" }, // fuchsia
  { tint: "#ECFCCB", accent: "#65A30D", text: "#3F6212" }, // lime
  { tint: "#FFE4E6", accent: "#E11D48", text: "#9F1239" }, // rose-deep
  { tint: "#DBEAFE", accent: "#2563EB", text: "#1E40AF" }, // blue
  { tint: "#FEF3C7", accent: "#D97706", text: "#92400E" }, // amber-deep
  { tint: "#D1FAE5", accent: "#059669", text: "#065F46" }, // emerald
  { tint: "#EDE9FE", accent: "#7C3AED", text: "#5B21B6" }, // violet
  { tint: "#FEF3C7", accent: "#A16207", text: "#713F12" }, // gold
  { tint: "#CCFBF1", accent: "#0D9488", text: "#115E59" }, // teal
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

/**
 * Warna identitas guru, stabil per kodeGuru (fallback ke id kalau kodeGuru
 * belum tersedia). Dipakai konsisten di Data Guru dan kotak Jadwal.
 */
export function teacherColor(kodeGuruOrId: string): TeacherColor {
  const seed = kodeGuruOrId || "?";
  const index = hashSeed(seed) % PALETTE.length;
  return PALETTE[index];
}
