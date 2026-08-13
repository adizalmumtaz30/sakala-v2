// Data Access layer — repository. Satu-satunya tempat yang boleh menulis query
// Supabase untuk entity Periode Akademik. Application layer memanggil fungsi
// di sini, tidak pernah memanggil Supabase langsung.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PeriodeAkademik, PeriodeAkademikDraft } from "@/lib/domain/periodeAkademik";

type Row = {
  id: string;
  academic_context_id: string;
  nama: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  urutan: number;
  status: "aktif" | "nonaktif";
};

const SELECT_COLUMNS = "id, academic_context_id, nama, tanggal_mulai, tanggal_selesai, urutan, status";

function rowToEntity(row: Row): PeriodeAkademik {
  return {
    id: row.id,
    academicContextId: row.academic_context_id,
    nama: row.nama,
    tanggalMulai: row.tanggal_mulai,
    tanggalSelesai: row.tanggal_selesai,
    urutan: row.urutan,
    status: row.status,
  };
}

export const periodeAkademikRepository = {
  async findByContext(supabase: SupabaseClient, academicContextId: string): Promise<PeriodeAkademik[]> {
    const { data, error } = await supabase
      .from("periode_akademik")
      .select(SELECT_COLUMNS)
      .eq("academic_context_id", academicContextId)
      .order("urutan", { ascending: true });

    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async create(supabase: SupabaseClient, draft: PeriodeAkademikDraft): Promise<PeriodeAkademik> {
    const { data, error } = await supabase
      .from("periode_akademik")
      .insert({
        academic_context_id: draft.academicContextId,
        nama: draft.nama.trim(),
        tanggal_mulai: draft.tanggalMulai,
        tanggal_selesai: draft.tanggalSelesai,
        urutan: draft.urutan,
        status: draft.status,
      })
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async update(supabase: SupabaseClient, id: string, draft: PeriodeAkademikDraft): Promise<PeriodeAkademik> {
    const { data, error } = await supabase
      .from("periode_akademik")
      .update({
        nama: draft.nama.trim(),
        tanggal_mulai: draft.tanggalMulai,
        tanggal_selesai: draft.tanggalSelesai,
        urutan: draft.urutan,
        status: draft.status,
      })
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("periode_akademik").delete().eq("id", id);
    if (error) throw error;
  },
};
