// Data Access layer — repository. Satu-satunya tempat yang boleh menulis query
// Supabase untuk entity School Profile (Admin Profile). Singleton row.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SchoolProfile, SchoolProfileDraft } from "@/lib/domain/schoolProfile";

type Row = {
  id: string;
  nama: string;
  jabatan: string;
  nama_sekolah: string;
  tahun_pelajaran_default: string;
  semester_default: "ganjil" | "genap";
  created_at: string;
};

function rowToEntity(row: Row): SchoolProfile {
  return {
    id: row.id,
    nama: row.nama,
    jabatan: row.jabatan,
    namaSekolah: row.nama_sekolah,
    tahunPelajaranDefault: row.tahun_pelajaran_default,
    semesterDefault: row.semester_default,
  };
}

export const schoolProfileRepository = {
  async findOne(supabase: SupabaseClient): Promise<SchoolProfile | null> {
    const { data, error } = await supabase
      .from("school_profile")
      .select("id, nama, jabatan, nama_sekolah, tahun_pelajaran_default, semester_default, created_at")
      .maybeSingle();

    if (error) throw error;
    return data ? rowToEntity(data as Row) : null;
  },

  async upsert(
    supabase: SupabaseClient,
    existingId: string | null,
    draft: SchoolProfileDraft
  ): Promise<SchoolProfile> {
    const payload = {
      nama: draft.nama.trim(),
      jabatan: draft.jabatan.trim(),
      nama_sekolah: draft.namaSekolah.trim(),
      tahun_pelajaran_default: draft.tahunPelajaranDefault.trim(),
      semester_default: draft.semesterDefault,
    };

    if (existingId) {
      const { data, error } = await supabase
        .from("school_profile")
        .update(payload)
        .eq("id", existingId)
        .select("id, nama, jabatan, nama_sekolah, tahun_pelajaran_default, semester_default, created_at")
        .single();

      if (error) throw error;
      return rowToEntity(data as Row);
    }

    const { data, error } = await supabase
      .from("school_profile")
      .insert(payload)
      .select("id, nama, jabatan, nama_sekolah, tahun_pelajaran_default, semester_default, created_at")
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },
};
