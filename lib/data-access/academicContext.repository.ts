// Data Access layer — repository. Satu-satunya tempat yang boleh menulis query
// Supabase untuk entity Academic Context. Application layer memanggil fungsi
// di sini, tidak pernah memanggil Supabase langsung.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AcademicContext, AcademicContextDraft, Jenjang, Institution } from "@/lib/domain/academicContext";

const SELECT_COLUMNS = "id, tahun_pelajaran, semester, jenjang, institution, is_active, created_at";

type Row = {
  id: string;
  tahun_pelajaran: string;
  semester: "ganjil" | "genap";
  jenjang: Jenjang;
  institution: Institution;
  is_active: boolean;
  created_at: string;
};

function rowToEntity(row: Row): AcademicContext {
  return {
    id: row.id,
    tahunPelajaran: row.tahun_pelajaran,
    semester: row.semester,
    jenjang: row.jenjang,
    institution: row.institution,
    isActive: row.is_active,
  };
}

export const academicContextRepository = {
  async findAll(supabase: SupabaseClient): Promise<AcademicContext[]> {
    const { data, error } = await supabase
      .from("academic_context")
      .select(SELECT_COLUMNS)
      .order("tahun_pelajaran", { ascending: false })
      .order("semester", { ascending: true });

    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async findActive(supabase: SupabaseClient): Promise<AcademicContext | null> {
    const { data, error } = await supabase
      .from("academic_context")
      .select(SELECT_COLUMNS)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToEntity(data as Row) : null;
  },

  async findByPair(
    supabase: SupabaseClient,
    tahunPelajaran: string,
    semester: "ganjil" | "genap"
  ): Promise<AcademicContext | null> {
    const { data, error } = await supabase
      .from("academic_context")
      .select(SELECT_COLUMNS)
      .eq("tahun_pelajaran", tahunPelajaran)
      .eq("semester", semester)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToEntity(data as Row) : null;
  },

  async create(
    supabase: SupabaseClient,
    draft: AcademicContextDraft,
    isActive: boolean
  ): Promise<AcademicContext> {
    const { data, error } = await supabase
      .from("academic_context")
      .insert({
        tahun_pelajaran: draft.tahunPelajaran.trim(),
        semester: draft.semester,
        jenjang: draft.jenjang,
        institution: draft.institution,
        is_active: isActive,
      })
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async update(supabase: SupabaseClient, id: string, draft: AcademicContextDraft): Promise<AcademicContext> {
    const { data, error } = await supabase
      .from("academic_context")
      .update({
        tahun_pelajaran: draft.tahunPelajaran.trim(),
        semester: draft.semester,
        jenjang: draft.jenjang,
        institution: draft.institution,
      })
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  /**
   * Set satu context menjadi aktif dan menonaktifkan semua yang lain.
   * Bukan transaksi database sungguhan (Supabase JS client tidak expose multi-
   * statement transaction) — dua langkah sekuensial, tapi unique index parsial
   * di migration (Bagian 77) tetap mencegah dua baris aktif sekaligus walau
   * request ini gagal di tengah jalan.
   */
  async setActive(supabase: SupabaseClient, id: string): Promise<AcademicContext> {
    const { error: clearError } = await supabase
      .from("academic_context")
      .update({ is_active: false })
      .eq("is_active", true);
    if (clearError) throw clearError;

    const { data, error } = await supabase
      .from("academic_context")
      .update({ is_active: true })
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  // Menonaktifkan tanpa mengaktifkan konteks lain — aman secara skema
  // (unique index parsial cuma mencegah DUA baris aktif sekaligus, bukan nol).
  // Halaman lain sudah menangani "tidak ada konteks aktif" sebagai empty
  // state yang valid (bukan error).
  async deactivate(supabase: SupabaseClient, id: string): Promise<AcademicContext> {
    const { data, error } = await supabase
      .from("academic_context")
      .update({ is_active: false })
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("academic_context").delete().eq("id", id);
    if (error) throw error;
  },
};
