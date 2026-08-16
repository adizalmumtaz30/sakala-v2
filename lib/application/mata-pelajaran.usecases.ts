import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateMataPelajaranDraft,
  type MataPelajaran,
  type MataPelajaranDraft,
} from "@/lib/domain/mata-pelajaran";
import { mataPelajaranRepository } from "@/lib/data-access/mata-pelajaran.repository";
import { recordAuditEvent } from "@/lib/application/auditLog.usecases";
import type { AuditSource } from "@/lib/domain/auditLog";

export async function listMataPelajaran(supabase: SupabaseClient): Promise<MataPelajaran[]> {
  return mataPelajaranRepository.findAll(supabase);
}

export async function getMataPelajaranById(
  supabase: SupabaseClient,
  id: string
): Promise<MataPelajaran | null> {
  return mataPelajaranRepository.findById(supabase, id);
}

// Mata Pelajaran tidak terikat Academic Context (entity global), sama seperti Guru.
export async function createMataPelajaran(
  supabase: SupabaseClient,
  draft: MataPelajaranDraft,
  source: AuditSource = "manual"
): Promise<MataPelajaran> {
  validateMataPelajaranDraft(draft);
  const item = await mataPelajaranRepository.create(supabase, draft);
  await recordAuditEvent({
    supabase,
    academicContextId: null,
    action: "create",
    entityType: "mata_pelajaran",
    entityId: item.id,
    entityLabel: item.nama,
    after: item,
    source,
  });
  return item;
}

export async function updateMataPelajaran(
  supabase: SupabaseClient,
  id: string,
  draft: MataPelajaranDraft
): Promise<MataPelajaran> {
  validateMataPelajaranDraft(draft);
  const before = await mataPelajaranRepository.findById(supabase, id);
  const item = await mataPelajaranRepository.update(supabase, id, draft);
  await recordAuditEvent({
    supabase,
    academicContextId: null,
    action: "edit",
    entityType: "mata_pelajaran",
    entityId: id,
    entityLabel: item.nama,
    before,
    after: item,
  });
  return item;
}

export async function deleteMataPelajaran(supabase: SupabaseClient, id: string): Promise<void> {
  const before = await mataPelajaranRepository.findById(supabase, id);
  await mataPelajaranRepository.remove(supabase, id);
  await recordAuditEvent({
    supabase,
    academicContextId: null,
    action: "delete",
    entityType: "mata_pelajaran",
    entityId: id,
    entityLabel: before?.nama ?? null,
    before,
  });
}
