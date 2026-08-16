import type { SupabaseClient } from "@supabase/supabase-js";
import type { Kelas, KelasDraft } from "@/lib/domain/kelas";

type Row = {
  id: string;
  tingkat: string;
  nama_rombel: string;
  status: "aktif" | "nonaktif";
  tahun_ajaran: string;
  semester: "ganjil" | "genap";
};

function rowToEntity(row: Row): Kelas {
  return {
    id: row.id,
    tingkat: row.tingkat,
    namaRombel: row.nama_rombel,
    status: row.status,
    tahunAjaran: row.tahun_ajaran,
    semester: row.semester,
  };
}

export const kelasRepository = {
  async findAll(supabase: SupabaseClient): Promise<Kelas[]> {
    const { data, error } = await supabase
      .from("kelas")
      .select("id, tingkat, nama_rombel, status, tahun_ajaran, semester")
      .order("tingkat", { ascending: true })
      .order("nama_rombel", { ascending: true });
    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async findById(supabase: SupabaseClient, id: string): Promise<Kelas | null> {
    const { data, error } = await supabase
      .from("kelas")
      .select("id, tingkat, nama_rombel, status, tahun_ajaran, semester")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToEntity(data as Row) : null;
  },

  async create(supabase: SupabaseClient, draft: KelasDraft): Promise<Kelas> {
    const { data, error } = await supabase
      .from("kelas")
      .insert({
        tingkat: draft.tingkat.trim(),
        nama_rombel: draft.namaRombel.trim(),
        status: draft.status,
        tahun_ajaran: draft.tahunAjaran.trim(),
        semester: draft.semester,
      })
      .select("id, tingkat, nama_rombel, status, tahun_ajaran, semester")
      .single();
    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async update(supabase: SupabaseClient, id: string, draft: KelasDraft): Promise<Kelas> {
    const { data, error } = await supabase
      .from("kelas")
      .update({
        tingkat: draft.tingkat.trim(),
        nama_rombel: draft.namaRombel.trim(),
        status: draft.status,
        tahun_ajaran: draft.tahunAjaran.trim(),
        semester: draft.semester,
      })
      .eq("id", id)
      .select("id, tingkat, nama_rombel, status, tahun_ajaran, semester")
      .single();
    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("kelas").delete().eq("id", id);
    if (error) throw error;
  },
};
