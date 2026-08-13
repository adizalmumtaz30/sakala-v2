// Data Access layer — repository. Satu-satunya tempat yang boleh menulis query
// Supabase untuk entity Academic Context. Application layer memanggil fungsi
// di sini, tidak pernah memanggil Supabase langsung.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AcademicContext, AcademicContextDraft } from "@/lib/domain/academicContext";

type Row = {
  id: string;
  tahun_pelajaran: string;
  semester: "ganjil" | "genap";
  is_active: boolean;
  created_at: string;
};

function rowToEntity(row: Row): AcademicContext {
  return { id: row.id, tahunPelajaran: row.tahun_pelajaran, semester: row.semester, isActive: row.is_active };
}

export const academicContextRepository = {
  async findAll(supabase: SupabaseClient): Promise<AcademicContext[]> {
    const { data, error } = await supabase
      .from("academic_context")
      .select("id, tahun_pelajaran, semester, is_active, created_at")
      .order("tahun_pelajaran", { ascending: false })
      .order("semester", { ascending: true });

    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async findActive(supabase: SupabaseClient): Promise<AcademicContext | null> {
    const { data, error } = await supabase
      .from("academic_context")
      .select("id, tahun_pelajaran, semester, is_active, created_at")
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
      .select("id, tahun_pelajaran, semester, is_active, created_at")
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
      .insert({ tahun_pelajaran: draft.tahunPelajaran.trim(), semester: draft.semester, is_active: isActive })
      .select("id, tahun_pelajaran, semester, is_active, created_at")
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
      .select("id, tahun_pelajaran, semester, is_active, created_at")
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async remove(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from("academic_context").delete().eq("id", id);
    if (error) throw error;
  },
};
