// Shared avatar utilities (SAKALA V2.3 Bagian 15-16) — dipakai untuk Guru, dan
// entitas lain di masa depan yang butuh avatar (Bagian 10 keputusan final: reusable).

const PALETTE: Array<{ bg: string; text: string }> = [
  { bg: "#E0E7FF", text: "#3730A3" },
  { bg: "#DCFCE7", text: "#166534" },
  { bg: "#FEF3C7", text: "#92400E" },
  { bg: "#FCE7F3", text: "#9D174D" },
  { bg: "#DBEAFE", text: "#1E40AF" },
  { bg: "#EDE9FE", text: "#5B21B6" },
  { bg: "#FFE4E6", text: "#9F1239" },
  { bg: "#D1FAE5", text: "#065F46" },
];

/** Initial avatar fallback (Bagian 15) — "Ahmad Fauzan" -> "AF", "Siti" -> "SI". */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Warna avatar stabil per nama (hash sederhana), supaya konsisten di seluruh UI. */
export function avatarColor(seed: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}
