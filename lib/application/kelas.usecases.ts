import type { SupabaseClient } from "@supabase/supabase-js";
import { validateKelasDraft, type Kelas, type KelasDraft } from "@/lib/domain/kelas";
import { kelasRepository } from "@/lib/data-access/kelas.repository";
import { recordAuditEvent } from "@/lib/application/auditLog.usecases";

export async function listKelas(supabase: SupabaseClient): Promise<Kelas[]> {
  return kelasRepository.findAll(supabase);
}

// Kelas tidak terikat Academic Context via kolom relasi (identitas tahun ajaran/
// semester disimpan sebagai field draft, bukan academic_context_id), jadi audit
// academicContextId selalu null di sini — konsisten dengan Guru/Mapel/Ruangan.
export async function createKelas(supabase: SupabaseClient, draft: KelasDraft): Promise<Kelas> {
  validateKelasDraft(draft);
  const item = await kelasRepository.create(supabase, draft);
  await recordAuditEvent({
    supabase,
    academicContextId: null,
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
  id: string,
  draft: KelasDraft
): Promise<Kelas> {
  validateKelasDraft(draft);
  const before = await kelasRepository.findById(supabase, id);
  const item = await kelasRepository.update(supabase, id, draft);
  await recordAuditEvent({
    supabase,
    academicContextId: null,
    action: "edit",
    entityType: "kelas",
    entityId: id,
    entityLabel: `${item.tingkat} ${item.namaRombel}`,
    before,
    after: item,
  });
  return item;
}

export async function deleteKelas(supabase: SupabaseClient, id: string): Promise<void> {
  const before = await kelasRepository.findById(supabase, id);
  await kelasRepository.remove(supabase, id);
  await recordAuditEvent({
    supabase,
    academicContextId: null,
    action: "delete",
    entityType: "kelas",
    entityId: id,
    entityLabel: before ? `${before.tingkat} ${before.namaRombel}` : null,
    before,
  });
}
