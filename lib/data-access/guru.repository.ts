// Data Access layer — repository. Satu-satunya tempat yang boleh menulis query
// Supabase untuk entity Guru. Application layer memanggil fungsi di sini,
// tidak pernah memanggil Supabase langsung.
//
// Pack 09: kode_guru di-generate oleh database trigger (migration 0006) — repository
// TIDAK PERNAH mengirim kode_guru saat insert, biar tidak konflik dengan sequence.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Guru, GuruDraft } from "@/lib/domain/guru";

type Row = {
  id: string;
  nama_guru: string;
  kode_guru: string;
  status: "aktif" | "nonaktif";
  nip: string | null;
  nuptk: string | null;
  email: string | null;
  no_telepon: string | null;
  created_at: string;
};

const SELECT_COLUMNS = "id, nama_guru, kode_guru, status, nip, nuptk, email, no_telepon, created_at";

function rowToEntity(row: Row): Guru {
  return {
    id: row.id,
    namaGuru: row.nama_guru,
    kodeGuru: row.kode_guru,
    status: row.status,
    nip: row.nip ?? undefined,
    nuptk: row.nuptk ?? undefined,
    email: row.email ?? undefined,
    noTelepon: row.no_telepon ?? undefined,
  };
}

/** Optional text field: string kosong disimpan sebagai NULL, bukan "" (Bagian 22). */
function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export const guruRepository = {
  async findAll(supabase: SupabaseClient): Promise<Guru[]> {
    const { data, error } = await supabase
      .from("guru")
      .select(SELECT_COLUMNS)
      .order("nama_guru", { ascending: true });

    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async findById(supabase: SupabaseClient, id: string): Promise<Guru | null> {
    const { data, error } = await supabase
      .from("guru")
      .select(SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToEntity(data as Row) : null;
  },

  async create(supabase: SupabaseClient, draft: GuruDraft): Promise<Guru> {
    const { data, error } = await supabase
      .from("guru")
      .insert({
        nama_guru: draft.namaGuru.trim(),
        status: draft.status,
        nip: optionalText(draft.nip),
        nuptk: optionalText(draft.nuptk),
        email: optionalText(draft.email),
        no_telepon: optionalText(draft.noTelepon),
      })
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async update(supabase: SupabaseClient, id: string, draft: GuruDraft): Promise<Guru> {
    const { data, error } = await supabase
      .from("guru")
      .update({
        nama_guru: draft.namaGuru.trim(),
        status: draft.status,
        nip: optionalText(draft.nip),
        nuptk: optionalText(draft.nuptk),
        email: optionalText(draft.email),
        no_telepon: optionalText(draft.noTelepon),
      })
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("guru").delete().eq("id", id);
    if (error) throw error;
  },
};
