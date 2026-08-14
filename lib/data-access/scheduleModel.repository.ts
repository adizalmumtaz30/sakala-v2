// Data Access layer — repository. Satu-satunya tempat yang boleh menulis query
// Supabase untuk entity Schedule Model. Application layer memanggil fungsi
// di sini, tidak pernah memanggil Supabase langsung.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HariSekolah } from "@/lib/domain/jamPelajaran";
import type { ModeRuangan, PenggunaanRombel, ScheduleModel, ScheduleModelDraft, StatusAktif } from "@/lib/domain/scheduleModel";

type Row = {
  id: string;
  academic_context_id: string;
  nama_model: string;
  waktu_mulai: string;
  durasi_standar_menit: number;
  maks_jam_per_hari: number;
  hari_aktif: HariSekolah[];
  hari_libur: string[];
  mode_ruangan: ModeRuangan;
  penggunaan_rombel: PenggunaanRombel;
  status: StatusAktif;
};

const SELECT_COLUMNS =
  "id, academic_context_id, nama_model, waktu_mulai, durasi_standar_menit, maks_jam_per_hari, hari_aktif, hari_libur, mode_ruangan, penggunaan_rombel, status";

function rowToEntity(row: Row): ScheduleModel {
  return {
    id: row.id,
    academicContextId: row.academic_context_id,
    namaModel: row.nama_model,
    waktuMulai: row.waktu_mulai.slice(0, 5),
    durasiStandarMenit: row.durasi_standar_menit,
    maksJamPerHari: row.maks_jam_per_hari,
    hariAktif: row.hari_aktif,
    hariLibur: row.hari_libur,
    modeRuangan: row.mode_ruangan,
    penggunaanRombel: row.penggunaan_rombel,
    status: row.status,
  };
}

function draftToRow(draft: ScheduleModelDraft) {
  return {
    academic_context_id: draft.academicContextId,
    nama_model: draft.namaModel.trim(),
    waktu_mulai: draft.waktuMulai,
    durasi_standar_menit: draft.durasiStandarMenit,
    maks_jam_per_hari: draft.maksJamPerHari,
    hari_aktif: draft.hariAktif,
    hari_libur: draft.hariLibur,
    mode_ruangan: draft.modeRuangan,
    penggunaan_rombel: draft.penggunaanRombel,
    status: draft.status,
  };
}

export const scheduleModelRepository = {
  async findByContext(supabase: SupabaseClient, academicContextId: string): Promise<ScheduleModel[]> {
    const { data, error } = await supabase
      .from("schedule_model")
      .select(SELECT_COLUMNS)
      .eq("academic_context_id", academicContextId)
      .order("nama_model", { ascending: true });

    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async findById(supabase: SupabaseClient, id: string): Promise<ScheduleModel | null> {
    const { data, error } = await supabase.from("schedule_model").select(SELECT_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToEntity(data as Row) : null;
  },

  async create(supabase: SupabaseClient, draft: ScheduleModelDraft): Promise<ScheduleModel> {
    const { data, error } = await supabase.from("schedule_model").insert(draftToRow(draft)).select(SELECT_COLUMNS).single();
    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async update(supabase: SupabaseClient, id: string, draft: ScheduleModelDraft): Promise<ScheduleModel> {
    const { data, error } = await supabase
      .from("schedule_model")
      .update(draftToRow(draft))
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("schedule_model").delete().eq("id", id);
    if (error) throw error;
  },
};
