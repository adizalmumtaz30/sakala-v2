import type { SupabaseClient } from "@supabase/supabase-js";
import type { MataPelajaran, MataPelajaranDraft } from "@/lib/domain/mata-pelajaran";

type Row = {
  id: string;
  nama: string;
  kode: string | null;
  status: "aktif" | "nonaktif";
  target_jp_per_rombel: number | null;
};

function rowToEntity(row: Row): MataPelajaran {
  return {
    id: row.id,
    nama: row.nama,
    kode: row.kode,
    status: row.status,
    targetJpPerRombel: row.target_jp_per_rombel,
  };
}

export const mataPelajaranRepository = {
  async findAll(supabase: SupabaseClient): Promise<MataPelajaran[]> {
    const { data, error } = await supabase
      .from("mata_pelajaran")
      .select("id, nama, kode, status, target_jp_per_rombel")
      .order("nama", { ascending: true });
    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async create(supabase: SupabaseClient, draft: MataPelajaranDraft): Promise<MataPelajaran> {
    const { data, error } = await supabase
      .from("mata_pelajaran")
      .insert({
        nama: draft.nama.trim(),
        kode: draft.kode.trim() || null,
        status: draft.status,
        target_jp_per_rombel: draft.targetJpPerRombel,
      })
      .select("id, nama, kode, status, target_jp_per_rombel")
      .single();
    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async update(supabase: SupabaseClient, id: string, draft: MataPelajaranDraft): Promise<MataPelajaran> {
    const { data, error } = await supabase
      .from("mata_pelajaran")
      .update({
        nama: draft.nama.trim(),
        kode: draft.kode.trim() || null,
        status: draft.status,
        target_jp_per_rombel: draft.targetJpPerRombel,
      })
      .eq("id", id)
      .select("id, nama, kode, status, target_jp_per_rombel")
      .single();
    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("mata_pelajaran").delete().eq("id", id);
    if (error) throw error;
  },
};
