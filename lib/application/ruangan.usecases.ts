import type { SupabaseClient } from "@supabase/supabase-js";
import { validateRuanganDraft, type Ruangan, type RuanganDraft } from "@/lib/domain/ruangan";
import { ruanganRepository } from "@/lib/data-access/ruangan.repository";
import { recordAuditEvent } from "@/lib/application/auditLog.usecases";

export async function listRuangan(supabase: SupabaseClient): Promise<Ruangan[]> {
  return ruanganRepository.findAll(supabase);
}

// Ruangan tidak terikat Academic Context (entity global), sama seperti Guru/Mapel/Kelas.
export async function createRuangan(supabase: SupabaseClient, draft: RuanganDraft): Promise<Ruangan> {
  validateRuanganDraft(draft);
  const item = await ruanganRepository.create(supabase, draft);
  await recordAuditEvent({
    supabase,
    academicContextId: null,
    action: "create",
    entityType: "ruangan",
    entityId: item.id,
    entityLabel: item.nama,
    after: item,
  });
  return item;
}

export async function updateRuangan(
  supabase: SupabaseClient,
  id: string,
  draft: RuanganDraft
): Promise<Ruangan> {
  validateRuanganDraft(draft);
  const before = await ruanganRepository.findById(supabase, id);
  const item = await ruanganRepository.update(supabase, id, draft);
  await recordAuditEvent({
    supabase,
    academicContextId: null,
    action: "edit",
    entityType: "ruangan",
    entityId: id,
    entityLabel: item.nama,
    before,
    after: item,
  });
  return item;
}

export async function deleteRuangan(supabase: SupabaseClient, id: string): Promise<void> {
  const before = await ruanganRepository.findById(supabase, id);
  await ruanganRepository.remove(supabase, id);
  await recordAuditEvent({
    supabase,
    academicContextId: null,
    action: "delete",
    entityType: "ruangan",
    entityId: id,
    entityLabel: before?.nama ?? null,
    before,
  });
}
