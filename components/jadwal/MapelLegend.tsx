"use client";

import type { MapelColor } from "@/lib/utils/mapelColor";

/**
 * Legend warna-per-mapel di bawah grid Jadwal — hanya mapel yang BENAR-BENAR
 * terjadwal (subjectIds) yang ditampilkan, bukan seluruh master data Mata
 * Pelajaran. colorMap WAJIB persis map yang sama dipakai grid (bukan dihitung
 * ulang di sini) — supaya warna swatch legend selalu konsisten dgn kartu.
 */
export default function MapelLegend({
  subjectIds,
  mapelMap,
  colorMap,
}: {
  /** subjectId unik yang muncul di grid saat ini. */
  subjectIds: string[];
  /** id mapel -> nama mapel. */
  mapelMap: Map<string, string>;
  /** id mapel -> warna (map yang SAMA dipakai render kartu grid). */
  colorMap: Map<string, MapelColor>;
}) {
  const items = Array.from(new Set(subjectIds))
    .filter((id) => mapelMap.has(id) && colorMap.has(id))
    .map((id) => ({ id, nama: mapelMap.get(id) as string, color: colorMap.get(id) as MapelColor }))
    .sort((a, b) => a.nama.localeCompare(b.nama));

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border/70 bg-surface px-3.5 py-2.5">
      {items.map((it) => (
        <span key={it.id} className="flex items-center gap-1.5 text-[10.5px] font-medium text-ink-500">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: it.color.accent }} />
          {it.nama}
        </span>
      ))}
    </div>
  );
}
