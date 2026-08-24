// Mata Pelajaran Identity Color (menggantikan Teacher Identity Color untuk
// kartu Jadwal — lihat catatan di checkpoint: warna per-mapel tetap informatif
// di SEMUA mode "Lihat per" [Kelas/Guru/Ruangan], sedangkan warna per-guru
// jadi percuma begitu mode "Lihat per: Guru" difilter ke satu guru — semua
// kartu jadi 1 warna. Nama guru tetap tampil sebagai teks di kartu, cuma
// bukan lagi jadi kode warna utama.
//
// Model warna: tint LEMBUT (bukan solid penuh) + aksen kiri solid + teks
// SELALU gelap (bukan putih/berwarna) — supaya kontras terjamin di hue apa
// pun tanpa perlu hitung WCAG per-warna satu-satu. Ini yang memperbaiki
// keluhan "teks samar" di kartu lama (solid+teks putih, sebagian hue
// mid-tone seperti amber/gold kontrasnya pas-pasan).

export interface MapelColor {
  /** Background card — tint lembut (~10% opacity dari aksen). */
  tint: string;
  /** Border kiri 3-4px + border tipis sekeliling — solid, penuh saturasi. */
  accent: string;
  /** Warna teks — SELALU dark ink, bukan putih/berwarna, supaya kontras terjamin. */
  text: string;
}

const DARK_TEXT = "#1E2430";

const ACCENTS: string[] = [
  "#2F6FED", // biru (brand)
  "#16A34A", // hijau
  "#EA580C", // oranye
  "#9333EA", // ungu
  "#0891B2", // cyan
  "#DC2626", // merah
  "#CA8A04", // amber
  "#DB2777", // pink
  "#65A30D", // lime
  "#7C3AED", // violet
  "#0D9488", // teal
  "#E11D48", // rose
  "#4F46E5", // indigo
  "#059669", // emerald
  "#D97706", // amber-deep
  "#C026D3", // fuchsia
  "#0284C7", // sky
  "#A16207", // gold
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** kodeMapelOrId: pakai kode/ID mata pelajaran (bukan nama) supaya stabil walau nama diganti-ganti. */
export function mapelColor(kodeMapelOrId: string): MapelColor {
  const seed = kodeMapelOrId || "?";
  const accent = ACCENTS[hashSeed(seed) % ACCENTS.length];
  return { tint: hexToRgba(accent, 0.1), accent, text: DARK_TEXT };
}
