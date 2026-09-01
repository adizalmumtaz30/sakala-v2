import type { SupabaseClient } from "@supabase/supabase-js";
import { validateKelasDraft, sortKelasByTingkat, type Kelas, type KelasDraft } from "@/lib/domain/kelas";
import { kelasRepository } from "@/lib/data-access/kelas.repository";
import { academicContextRepository } from "@/lib/data-access/academicContext.repository";
import { recordAuditEvent } from "@/lib/application/auditLog.usecases";

async function requireActiveContext(supabase: SupabaseClient) {
  const context = await academicContextRepository.findActive(supabase);
  if (!context) throw new Error("Belum ada Konteks Akademik aktif. Pilih atau buat Konteks Akademik terlebih dahulu.");
  return context;
}

export async function listKelas(supabase: SupabaseClient): Promise<Kelas[]> {
  const context = await requireActiveContext(supabase);
  const data = await kelasRepository.findAll(supabase, context.id);
  return sortKelasByTingkat(data);
}

export async function createKelas(supabase: SupabaseClient, draft: KelasDraft): Promise<Kelas> {
  validateKelasDraft(draft);
  const context = await requireActiveContext(supabase);
  const item = await kelasRepository.create(supabase, context.id, draft);
  await recordAuditEvent({
    supabase,
    academicContextId: context.id,
    action: "create",
    entityType: "kelas",
    entityId: item.id,
    entityLabel: `${item.tingkat} ${item.namaRombel}`,
    after: item,
  });
  return item;
}

export async function updateKelas(supabase: SupabaseClient, id: string, draft: KelasDraft): Promise<Kelas> {
  validateKelasDraft(draft);
  const context = await requireActiveContext(supabase);
  const before = await kelasRepository.findById(supabase, id);
  if (!before) throw new Error("Kelas tidak ditemukan.");
  if (before.academicContextId !== context.id) throw new Error("Kelas bukan bagian dari konteks akademik aktif.");
  const item = await kelasRepository.update(supabase, id, draft);
  await recordAuditEvent({
    supabase,
    academicContextId: context.id,
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
  const context = await requireActiveContext(supabase);
  const before = await kelasRepository.findById(supabase, id);
  if (before && before.academicContextId !== context.id) throw new Error("Kelas bukan bagian dari konteks akademik aktif.");
  await kelasRepository.remove(supabase, id);
  await recordAuditEvent({
    supabase,
    academicContextId: context.id,
    action: "delete",
    entityType: "kelas",
    entityId: before?.id ?? id,
    entityLabel: before ? `${before.tingkat} ${before.namaRombel}` : null,
    before,
  });
}
