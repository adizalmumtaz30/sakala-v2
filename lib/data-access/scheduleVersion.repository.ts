// Data Access layer — repository. Satu-satunya tempat yang boleh menulis query
// Supabase untuk entity Schedule Version. Application layer memanggil fungsi
// di sini, tidak pernah memanggil Supabase langsung.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduleVersion, ScheduleVersionDraft, ScheduleVersionStatus } from "@/lib/domain/scheduleVersion";

type Row = {
  id: string;
  academic_context_id: string;
  label: string;
  created_by: string | null;
  source: string;
  status: ScheduleVersionStatus;
  change_summary: string | null;
  created_at: string;
};

const SELECT_COLUMNS = "id, academic_context_id, label, created_by, source, status, change_summary, created_at";

function rowToEntity(row: Row): ScheduleVersion {
  return {
    id: row.id,
    academicContextId: row.academic_context_id,
    label: row.label,
    createdBy: row.created_by,
    createdAt: row.created_at,
    source: row.source,
    status: row.status,
    changeSummary: row.change_summary,
  };
}

export const scheduleVersionRepository = {
  async findByContext(supabase: SupabaseClient, academicContextId: string): Promise<ScheduleVersion[]> {
    const { data, error } = await supabase
      .from("schedule_version")
      .select(SELECT_COLUMNS)
      .eq("academic_context_id", academicContextId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data as Row[]).map(rowToEntity);
  },

  async findActiveByContext(supabase: SupabaseClient, academicContextId: string): Promise<ScheduleVersion | null> {
    const { data, error } = await supabase
      .from("schedule_version")
      .select(SELECT_COLUMNS)
      .eq("academic_context_id", academicContextId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToEntity(data as Row) : null;
  },

  async findById(supabase: SupabaseClient, id: string): Promise<ScheduleVersion | null> {
    const { data, error } = await supabase.from("schedule_version").select(SELECT_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToEntity(data as Row) : null;
  },

  async create(supabase: SupabaseClient, draft: ScheduleVersionDraft): Promise<ScheduleVersion> {
    const { data, error } = await supabase
      .from("schedule_version")
      .insert({
        academic_context_id: draft.academicContextId,
        label: draft.label.trim(),
        created_by: draft.createdBy,
        source: draft.source,
        change_summary: draft.changeSummary?.trim() || null,
      })
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },

  async setStatus(supabase: SupabaseClient, id: string, status: ScheduleVersionStatus): Promise<ScheduleVersion> {
    const { data, error } = await supabase
      .from("schedule_version")
      .update({ status })
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return rowToEntity(data as Row);
  },
};
