import type { SupabaseClient } from "@supabase/supabase-js";
import type { Kelas, KelasDraft } from "@/lib/domain/kelas";

type AcademicContextRelation = {
  tahun_pelajaran: string;
  semester: "ganjil" | "genap";
};

type Row = {
  id: string;
  academic_context_id: string;
  tingkat: string;
  nama_rombel: string;
  status: "aktif" | "nonaktif";
  academic_context: AcademicContextRelation | AcademicContextRelation[] | null;
};

const SELECT_COLUMNS =
  "id, academic_context_id, tingkat, nama_rombel, status, academic_context:academic_context_id(tahun_pelajaran,semester)";

function rowToEntity(row: Row): Kelas {
  const context = Array.isArray(row.academic_context) ? row.academic_context[0] : row.academic_context;
  if (!context) {
    throw new Error("Kelas memiliki Academic Context yang tidak ditemukan.");
  }
  return {
    id: row.id,
    academicContextId: row.academic_context_id,
    tingkat: row.tingkat,
    namaRombel: row.nama_rombel,
    status: row.status,
    tahunAjaran: context.tahun_pelajaran,
    semester: context.semester,
  };
}

async function resolveActiveContextId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from("academic_context")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Belum ada Academic Context aktif.");
  return data.id;
}

export const kelasRepository = {
  async findAll(supabase: SupabaseClient, academicContextId?: string): Promise<Kelas[]> {
    const contextId = academicContextId ?? (await resolveActiveContextId(supabase));
    const { data, error } = await supabase
      .from("kelas")
      .select(SELECT_COLUMNS)
      .eq("academic_context_id", contextId)
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