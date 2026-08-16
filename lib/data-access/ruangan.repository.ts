import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ruangan, RuanganDraft } from "@/lib/domain/ruangan";

type Row = {
  id: string;
  nama: string;
  kapasitas: number | null;
  tipe_ruangan: string | null;
  status: "aktif" | "nonaktif";
};

function rowToEntity(row: Row): Ruangan {
  return {
    id: row.id,
    nama: row.nama,
    kapasitas: row.kapasitas,
    tipeRuangan: row.tipe_ruangan,
    status: row.status,
  };
}

export const ruanganRepository = {
  async findAll(supabase: SupabaseClient): Promise<Ruangan[]> {
    const { data, error } = await supabase
      .from("ruangan")
      .select("id, nama, kapasitas, tipe_ruangan, status")
      .order("nama", { ascending: true });
    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async findById(supabase: SupabaseClient, id: string): Promise<Ruangan | null> {
    const { data, error } = await supabase
      .from("ruangan")
      .select("id, nama, kapasitas, tipe_ruangan, status")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToEntity(data as Row) : null;
  },

  async create(supabase: SupabaseClient, draft: RuanganDraft): Promise<Ruangan> {
    const { data, error } = await supabase
      .from("ruangan")
      .insert({
        nama: draft.nama.trim(),
        kapasitas: draft.kapasitas,
        tipe_ruangan: draft.tipeRuangan.trim() || null,
        status: draft.status,
      })
      .select("id, nama, kapasitas, tipe_ruangan, status")
      .single();
    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async update(supabase: SupabaseClient, id: string, draft: RuanganDraft): Promise<Ruangan> {
    const { data, error } = await supabase
      .from("ruangan")
      .update({
        nama: draft.nama.trim(),
        kapasitas: draft.kapasitas,
        tipe_ruangan: draft.tipeRuangan.trim() || null,
        status: draft.status,
      })
      .eq("id", id)
      .select("id, nama, kapasitas, tipe_ruangan, status")
      .single();
    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("ruangan").delete().eq("id", id);
    if (error) throw error;
  },
};
