// Data Access layer — repository. Satu-satunya tempat yang boleh menulis query
// Supabase untuk entity Guru. Application layer memanggil fungsi di sini,
// tidak pernah memanggil Supabase langsung.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Guru, GuruDraft } from "@/lib/domain/guru";

type Row = {
  id: string;
  nama_guru: string;
  status: "aktif" | "nonaktif";
  created_at: string;
};

function rowToEntity(row: Row): Guru {
  return { id: row.id, namaGuru: row.nama_guru, status: row.status };
}

export const guruRepository = {
  async findAll(supabase: SupabaseClient): Promise<Guru[]> {
    const { data, error } = await supabase
      .from("guru")
      .select("id, nama_guru, status, created_at")
      .order("nama_guru", { ascending: true });

    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async findById(supabase: SupabaseClient, id: string): Promise<Guru | null> {
    const { data, error } = await supabase
      .from("guru")
      .select("id, nama_guru, status, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToEntity(data as Row) : null;
  },

  async create(supabase: SupabaseClient, draft: GuruDraft): Promise<Guru> {
    const { data, error } = await supabase
      .from("guru")
      .insert({ nama_guru: draft.namaGuru.trim(), status: draft.status })
      .select("id, nama_guru, status, created_at")
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async update(supabase: SupabaseClient, id: string, draft: GuruDraft): Promise<Guru> {
    const { data, error } = await supabase
      .from("guru")
      .update({ nama_guru: draft.namaGuru.trim(), status: draft.status })
      .eq("id", id)
      .select("id, nama_guru, status, created_at")
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("guru").delete().eq("id", id);
    if (error) throw error;
  },
};
