import type { SupabaseClient } from "@supabase/supabase-js";
import { validateKelasDraft, sortKelasByTingkat, type Kelas, type KelasDraft } from "@/lib/domain/kelas";
import { kelasRepository } from "@/lib/data-access/kelas.repository";
import { recordAuditEvent } from "@/lib/application/auditLog.usecases";

export async function listKelas(supabase: SupabaseClient, academicContextId: string): Promise<Kelas[]> {
  const data = await kelasRepository.findAll(supabase, academicContextId);
  return sortKelasByTingkat(data);
}

export async function createKelas(
  supabase: SupabaseClient,
  academicContextId: string,
  draft: KelasDraft
): Promise<Kelas> {
  validateKelasDraft(draft);
  const item = await kelasRepository.create(supabase, academicContextId, draft);
  await recordAuditEvent({
    supabase,
    academicContextId,
    action: "create",
    entityType: "kelas",
    entityId: item.id,
    entityLabel: `${item.tingkat} ${item.namaRombel}`,
    after: item,
  });
  return item;
}

export async function updateKelas(
  supabase: SupabaseClient,
  academicContextId: string,
  id: string,
  draft: KelasDraft
): Promise<Kelas> {
  validateKelasDraft(draft);
  const before = await kelasRepository.findById(supabase, id, academicContextId);
  const item = await kelasRepository.update(supabase, id, academicContextId, draft);
  await recordAuditEvent({
    supabase,
    academicContextId,
    action: "edit",
    entityType: "kelas",
    entityId: id,
    entityLabel: `${item.tingkat} ${item.namaRombel}`,
    before,
    after: item,
  });
  return item;
}

export async function deleteKelas(supabase: SupabaseClient, academicContextId: string, id: string): Promise<void> {
  const before = await kelasRepository.findById(supabase, id, academicContextId);
  await kelasRepository.remove(supabase, id, academicContextId);
  await recordAuditEvent({
    supabase,
    academicContextId,
    action: "delete",
    entityType: "kelas",
    entityId: id,
    entityLabel: before ? `${before.tingkat} ${before.namaRombel}` : null,
    before,
  });
}
