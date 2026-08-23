// Application layer — pencarian global lintas entitas untuk Command Palette /
// search bar header. Reuse findAll() repository yang sudah ada (skala data
// satu sekolah kecil, filter in-memory jauh lebih sederhana daripada nambah
// method ILIKE terpisah di 4 repository berbeda).

import type { SupabaseClient } from "@supabase/supabase-js";
import { guruRepository } from "@/lib/data-access/guru.repository";
import { kelasRepository } from "@/lib/data-access/kelas.repository";
import { mataPelajaranRepository } from "@/lib/data-access/mata-pelajaran.repository";
import { ruanganRepository } from "@/lib/data-access/ruangan.repository";

export interface GlobalSearchResult {
  type: "guru" | "kelas" | "mapel" | "ruangan";
  id: string;
  label: string;
  sublabel?: string;
  href: string;
}

export async function globalSearch(supabase: SupabaseClient, rawQuery: string): Promise<GlobalSearchResult[]> {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return [];

  const [guru, kelas, mapel, ruangan] = await Promise.all([
    guruRepository.findAll(supabase).catch(() => []),
    kelasRepository.findAll(supabase).catch(() => []),
    mataPelajaranRepository.findAll(supabase).catch(() => []),
    ruanganRepository.findAll(supabase).catch(() => []),
  ]);

  const results: GlobalSearchResult[] = [];
  for (const g of guru) {
    if (g.namaGuru.toLowerCase().includes(q)) {
      results.push({ type: "guru", id: g.id, label: g.namaGuru, sublabel: g.kodeGuru ?? undefined, href: `/guru?q=${encodeURIComponent(g.namaGuru)}` });
    }
  }
  for (const k of kelas) {
    if (k.namaRombel.toLowerCase().includes(q)) {
      results.push({ type: "kelas", id: k.id, label: k.namaRombel, href: `/kelas?q=${encodeURIComponent(k.namaRombel)}` });
    }
  }
  for (const m of mapel) {
    if (m.nama.toLowerCase().includes(q)) {
      results.push({ type: "mapel", id: m.id, label: m.nama, sublabel: m.kode ?? undefined, href: `/mata-pelajaran?q=${encodeURIComponent(m.nama)}` });
    }
  }
  for (const r of ruangan) {
    if (r.nama.toLowerCase().includes(q)) {
      results.push({ type: "ruangan", id: r.id, label: r.nama, href: `/ruangan?q=${encodeURIComponent(r.nama)}` });
    }
  }
  return results.slice(0, 24);
}
