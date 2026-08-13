// Data Access layer — repository. Satu-satunya tempat yang boleh menulis query
// Supabase untuk entity Jam Pelajaran. Application layer memanggil fungsi
// di sini, tidak pernah memanggil Supabase langsung.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HariSekolah, JamPelajaran, JamPelajaranDraft, JenisJamPelajaran } from "@/lib/domain/jamPelajaran";

type Row = {
  id: string;
  academic_context_id: string;
  hari: HariSekolah;
  nomor_urut: number;
  nama: string;
  jenis: JenisJamPelajaran;
  waktu_mulai: string;
  waktu_selesai: string;
  status: "aktif" | "nonaktif";
};

const SELECT_COLUMNS = "id, academic_context_id, hari, nomor_urut, nama, jenis, waktu_mulai, waktu_selesai, status";

function rowToEntity(row: Row): JamPelajaran {
  return {
    id: row.id,
    academicContextId: row.academic_context_id,
    hari: row.hari,
    nomorUrut: row.nomor_urut,
    nama: row.nama,
    jenis: row.jenis,
    waktuMulai: row.waktu_mulai.slice(0, 5),
    waktuSelesai: row.waktu_selesai.slice(0, 5),
    status: row.status,
  };
}

export const jamPelajaranRepository = {
  async findByContext(supabase: SupabaseClient, academicContextId: string): Promise<JamPelajaran[]> {
    const { data, error } = await supabase
      .from("jam_pelajaran")
      .select(SELECT_COLUMNS)
      .eq("academic_context_id", academicContextId)
      .order("hari", { ascending: true })
      .order("nomor_urut", { ascending: true });

    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async create(supabase: SupabaseClient, draft: JamPelajaranDraft): Promise<JamPelajaran> {
    const { data, error } = await supabase
      .from("jam_pelajaran")
      .insert({
        academic_context_id: draft.academicContextId,
        hari: draft.hari,
        nomor_urut: draft.nomorUrut,
        nama: draft.nama.trim(),
        jenis: draft.jenis,
        waktu_mulai: draft.waktuMulai,
        waktu_selesai: draft.waktuSelesai,
        status: draft.status,
      })
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async update(supabase: SupabaseClient, id: string, draft: JamPelajaranDraft): Promise<JamPelajaran> {
    const { data, error } = await supabase
      .from("jam_pelajaran")
      .update({
        hari: draft.hari,
        nomor_urut: draft.nomorUrut,
        nama: draft.nama.trim(),
        jenis: draft.jenis,
        waktu_mulai: draft.waktuMulai,
        waktu_selesai: draft.waktuSelesai,
        status: draft.status,
      })
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("jam_pelajaran").delete().eq("id", id);
    if (error) throw error;
  },
};
