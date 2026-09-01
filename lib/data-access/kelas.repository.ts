import type { SupabaseClient } from "@supabase/supabase-js";
import type { Kelas, KelasDraft } from "@/lib/domain/kelas";

type Row = {
  id: string;
  academic_context_id: string;
  tingkat: string;
  nama_rombel: string;
  status: "aktif" | "nonaktif";
  academic_context: {
    tahun_pelajaran: string;
    semester: "ganjil" | "genap";
  } | null;
};

const SELECT_COLUMNS =
  "id, academic_context_id, tingkat, nama_rombel, status, academic_context:academic_context_id(tahun_pelajaran,semester)";

function rowToEntity(row: Row): Kelas {
  if (!row.academic_context) {
    throw new Error("Kelas memiliki Academic Context yang tidak ditemukan.");
  }
  return {
    id: row.id,
    academicContextId: row.academic_context_id,
    tingkat: row.tingkat,
    namaRombel: row.nama_rombel,
    status: row.status,
    tahunAjaran: row.academic_context.tahun_pelajaran,
    semester: row.academic_context.semester,
  };
}

export const kelasRepository = {
  async findAll(supabase: SupabaseClient, academicContextId: string): Promise<Kelas[]> {
    const { data, error } = await supabase
      .from("kelas")
      .select(SELECT_COLUMNS)
      .eq("academic_context_id", academicContextId)
      .order("tingkat", { ascending: true })
      .order("nama_rombel", { ascending: true });
    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async findById(supabase: SupabaseClient, id: string, academicContextId?: string): Promise<Kelas | null> {
    let query = supabase.from("kelas").select(SELECT_COLUMNS).eq("id", id);
    if (academicContextId) query = query.eq("academic_context_id", academicContextId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? rowToEntity(data as Row) : null;
  },

  async create(supabase: SupabaseClient, academicContextId: string, draft: KelasDraft): Promise<Kelas> {
    const { data, error } = await supabase
      .from("kelas")
      .insert({
        academic_context_id: academicContextId,
        tingkat: draft.tingkat.trim(),
        nama_rombel: draft.namaRombel.trim(),
        status: draft.status,
      })
      .select(SELECT_COLUMNS)
      .single();
    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async update(supabase: SupabaseClient, id: string, academicContextId: string, draft: KelasDraft): Promise<Kelas> {
    const { data, error } = await supabase
      .from("kelas")
      .update({
        tingkat: draft.tingkat.trim(),
        nama_rombel: draft.namaRombel.trim(),
        status: draft.status,
      })
      .eq("id", id)
      .eq("academic_context_id", academicContextId)
      .select(SELECT_COLUMNS)
      .single();
    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async remove(supabase: SupabaseClient, id: string, academicContextId: string): Promise<void> {
    const { error } = await supabase.from("kelas").delete().eq("id", id).eq("academic_context_id", academicContextId);
    if (error) throw error;
  },
};
