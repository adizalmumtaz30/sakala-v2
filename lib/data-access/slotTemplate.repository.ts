// Data Access layer — repository. Satu-satunya tempat yang boleh menulis query
// Supabase untuk entity Slot Template. Application layer memanggil fungsi
// di sini, tidak pernah memanggil Supabase langsung.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HariSekolah } from "@/lib/domain/jamPelajaran";
import type { JenisSlot, SlotTemplate, SlotTemplateDraft } from "@/lib/domain/slotTemplate";

type Row = {
  id: string;
  schedule_model_id: string;
  hari: HariSekolah;
  nomor_urut: number;
  jenis_slot: JenisSlot;
  nama_custom: string | null;
};

const SELECT_COLUMNS = "id, schedule_model_id, hari, nomor_urut, jenis_slot, nama_custom";

function rowToEntity(row: Row): SlotTemplate {
  return {
    id: row.id,
    scheduleModelId: row.schedule_model_id,
    hari: row.hari,
    nomorUrut: row.nomor_urut,
    jenisSlot: row.jenis_slot,
    namaCustom: row.nama_custom,
  };
}

export const slotTemplateRepository = {
  async findByModel(supabase: SupabaseClient, scheduleModelId: string): Promise<SlotTemplate[]> {
    const { data, error } = await supabase
      .from("slot_template")
      .select(SELECT_COLUMNS)
      .eq("schedule_model_id", scheduleModelId)
      .order("hari", { ascending: true })
      .order("nomor_urut", { ascending: true });

    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async create(supabase: SupabaseClient, draft: SlotTemplateDraft): Promise<SlotTemplate> {
    const { data, error } = await supabase
      .from("slot_template")
      .insert({
        schedule_model_id: draft.scheduleModelId,
        hari: draft.hari,
        nomor_urut: draft.nomorUrut,
        jenis_slot: draft.jenisSlot,
        nama_custom: draft.jenisSlot === "custom" ? (draft.namaCustom?.trim() ?? null) : null,
      })
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async update(supabase: SupabaseClient, id: string, draft: SlotTemplateDraft): Promise<SlotTemplate> {
    const { data, error } = await supabase
      .from("slot_template")
      .update({
        hari: draft.hari,
        nomor_urut: draft.nomorUrut,
        jenis_slot: draft.jenisSlot,
        nama_custom: draft.jenisSlot === "custom" ? (draft.namaCustom?.trim() ?? null) : null,
      })
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("slot_template").delete().eq("id", id);
    if (error) throw error;
  },
};
