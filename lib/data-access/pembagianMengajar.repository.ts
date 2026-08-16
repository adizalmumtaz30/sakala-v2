// Data Access layer — repository Pembagian Mengajar.
// SELECT pakai nested join Supabase (guru/mata_pelajaran/kelas) supaya list
// UI (Bagian 73) tidak perlu N+1 query terpisah untuk nama guru/mapel/kelas.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PembagianMengajar, PembagianMengajarDraft, StatusAktif } from "@/lib/domain/pembagianMengajar";

type Row = {
  id: string;
  academic_context_id: string;
  guru_id: string;
  mata_pelajaran_id: string;
  kelas_id: string;
  jp_per_minggu: number;
  status: StatusAktif;
  guru: { nama_guru: string; kode_guru: string } | null;
  mata_pelajaran: { nama: string; kode: string | null; warna_jadwal: string | null } | null;
  kelas: { tingkat: string; nama_rombel: string } | null;
};

const SELECT_WITH_JOIN = `
  id, academic_context_id, guru_id, mata_pelajaran_id, kelas_id, jp_per_minggu, status,
  guru:guru_id ( nama_guru, kode_guru ),
  mata_pelajaran:mata_pelajaran_id ( nama, kode, warna_jadwal ),
  kelas:kelas_id ( tingkat, nama_rombel )
`;

function rowToEntity(row: Row): PembagianMengajar {
  return {
    id: row.id,
    academicContextId: row.academic_context_id,
    guruId: row.guru_id,
    mataPelajaranId: row.mata_pelajaran_id,
    kelasId: row.kelas_id,
    jpPerMinggu: row.jp_per_minggu,
    status: row.status,
    guruNama: row.guru?.nama_guru,
    guruKode: row.guru?.kode_guru,
    mataPelajaranNama: row.mata_pelajaran?.nama,
    mataPelajaranKode: row.mata_pelajaran?.kode ?? undefined,
    mataPelajaranWarna: row.mata_pelajaran?.warna_jadwal ?? undefined,
    kelasLabel: row.kelas ? `${row.kelas.tingkat} ${row.kelas.nama_rombel}` : undefined,
  };
}

export const pembagianMengajarRepository = {
  async findByContext(supabase: SupabaseClient, academicContextId: string): Promise<PembagianMengajar[]> {
    const { data, error } = await supabase
      .from("pembagian_mengajar")
      .select(SELECT_WITH_JOIN)
      .eq("academic_context_id", academicContextId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data as unknown as Row[]).map(rowToEntity);
  },

  async findById(supabase: SupabaseClient, id: string): Promise<PembagianMengajar | null> {
    const { data, error } = await supabase
      .from("pembagian_mengajar")
      .select(SELECT_WITH_JOIN)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToEntity(data as unknown as Row) : null;
  },

  async create(supabase: SupabaseClient, draft: PembagianMengajarDraft): Promise<PembagianMengajar> {
    const { data, error } = await supabase
      .from("pembagian_mengajar")
      .insert({
        academic_context_id: draft.academicContextId,
        guru_id: draft.guruId,
        mata_pelajaran_id: draft.mataPelajaranId,
        kelas_id: draft.kelasId,
        jp_per_minggu: draft.jpPerMinggu,
        status: draft.status,
      })
      .select(SELECT_WITH_JOIN)
      .single();
    if (error) throw error;
    return rowToEntity(data as unknown as Row);
  },

  async update(supabase: SupabaseClient, id: string, draft: PembagianMengajarDraft): Promise<PembagianMengajar> {
    const { data, error } = await supabase
      .from("pembagian_mengajar")
      .update({
        academic_context_id: draft.academicContextId,
        guru_id: draft.guruId,
        mata_pelajaran_id: draft.mataPelajaranId,
        kelas_id: draft.kelasId,
        jp_per_minggu: draft.jpPerMinggu,
        status: draft.status,
      })
      .eq("id", id)
      .select(SELECT_WITH_JOIN)
      .single();
    if (error) throw error;
    return rowToEntity(data as unknown as Row);
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("pembagian_mengajar").delete().eq("id", id);
    if (error) throw error;
  },

  /** Cek duplikat kombinasi Guru+Mapel+Kelas dalam satu konteks (Bagian 74) — dipakai validasi & import. */
  async findByCombination(
    supabase: SupabaseClient,
    academicContextId: string,
    guruId: string,
    mataPelajaranId: string,
    kelasId: string
  ): Promise<{ id: string } | null> {
    const { data, error } = await supabase
      .from("pembagian_mengajar")
      .select("id")
      .eq("academic_context_id", academicContextId)
      .eq("guru_id", guruId)
      .eq("mata_pelajaran_id", mataPelajaranId)
      .eq("kelas_id", kelasId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /** Bagian 22.5 — cari target JP (Pembagian Mengajar) AKTIF untuk kombinasi
   * Guru+Mapel+Kelas pada satu konteks. Dipakai Conflict Engine
   * (lib/application/conflictEngine.ts) untuk blok JP_MISMATCH saat commit —
   * hanya status "aktif" karena kombinasi yang dinonaktifkan tidak lagi
   * punya target yang berlaku untuk direkonsiliasi. */
  async findActiveByCombination(
    supabase: SupabaseClient,
    academicContextId: string,
    guruId: string,
    mataPelajaranId: string,
    kelasId: string
  ): Promise<{ jpPerMinggu: number } | null> {
    const { data, error } = await supabase
      .from("pembagian_mengajar")
      .select("jp_per_minggu")
      .eq("academic_context_id", academicContextId)
      .eq("guru_id", guruId)
      .eq("mata_pelajaran_id", mataPelajaranId)
      .eq("kelas_id", kelasId)
      .eq("status", "aktif")
      .maybeSingle();
    if (error) throw error;
    return data ? { jpPerMinggu: data.jp_per_minggu } : null;
  },
};
