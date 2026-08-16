// Data Access layer — repository Mata Pelajaran.
// Pack 09b (lanjutan): kolom baru (kelompok, warna_jadwal, prioritas_penjadwalan,
// jenis_mapel) ditambahkan mengikuti migration 0007 — semua nullable, dikirim
// null saat kosong (bukan string kosong), sama pola dengan guru.repository.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MataPelajaran,
  MataPelajaranDraft,
  PrioritasPenjadwalan,
  JenisMapel,
} from "@/lib/domain/mata-pelajaran";

type Row = {
  id: string;
  nama: string;
  kode: string | null;
  status: "aktif" | "nonaktif";
  target_jp_per_rombel: number | null;
  kelompok: string | null;
  warna_jadwal: string | null;
  prioritas_penjadwalan: PrioritasPenjadwalan | null;
  jenis_mapel: JenisMapel | null;
};

const SELECT_COLUMNS =
  "id, nama, kode, status, target_jp_per_rombel, kelompok, warna_jadwal, prioritas_penjadwalan, jenis_mapel";

function rowToEntity(row: Row): MataPelajaran {
  return {
    id: row.id,
    nama: row.nama,
    kode: row.kode,
    status: row.status,
    targetJpPerRombel: row.target_jp_per_rombel,
    kelompok: row.kelompok ?? undefined,
    warnaJadwal: row.warna_jadwal ?? undefined,
    prioritasPenjadwalan: row.prioritas_penjadwalan ?? undefined,
    jenisMapel: row.jenis_mapel ?? undefined,
  };
}

/** Optional text field: string kosong disimpan sebagai NULL, bukan "" (Bagian 22). */
function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function toRowPayload(draft: MataPelajaranDraft) {
  return {
    nama: draft.nama.trim(),
    kode: draft.kode.trim() || null,
    status: draft.status,
    target_jp_per_rombel: draft.targetJpPerRombel,
    kelompok: optionalText(draft.kelompok),
    warna_jadwal: optionalText(draft.warnaJadwal),
    prioritas_penjadwalan: draft.prioritasPenjadwalan ?? null,
    jenis_mapel: draft.jenisMapel ?? null,
  };
}

export const mataPelajaranRepository = {
  async findAll(supabase: SupabaseClient): Promise<MataPelajaran[]> {
    const { data, error } = await supabase
      .from("mata_pelajaran")
      .select(SELECT_COLUMNS)
      .order("nama", { ascending: true });
    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async findById(supabase: SupabaseClient, id: string): Promise<MataPelajaran | null> {
    const { data, error } = await supabase
      .from("mata_pelajaran")
      .select(SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToEntity(data as Row) : null;
  },

  async create(supabase: SupabaseClient, draft: MataPelajaranDraft): Promise<MataPelajaran> {
    const { data, error } = await supabase
      .from("mata_pelajaran")
      .insert(toRowPayload(draft))
      .select(SELECT_COLUMNS)
      .single();
    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async update(supabase: SupabaseClient, id: string, draft: MataPelajaranDraft): Promise<MataPelajaran> {
    const { data, error } = await supabase
      .from("mata_pelajaran")
      .update(toRowPayload(draft))
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();
    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("mata_pelajaran").delete().eq("id", id);
    if (error) throw error;
  },
};
