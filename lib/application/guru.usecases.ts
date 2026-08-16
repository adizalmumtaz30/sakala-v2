// Application layer — use case / orchestration. Memanggil Domain untuk validasi
// dan Data Access untuk persistence. UI (Presentation) hanya boleh memanggil layer ini.

import type { SupabaseClient } from "@supabase/supabase-js";
import { validateGuruDraft, type Guru, type GuruDraft } from "@/lib/domain/guru";
import { guruRepository } from "@/lib/data-access/guru.repository";
import { recordAuditEvent } from "@/lib/application/auditLog.usecases";
import type { AuditSource } from "@/lib/domain/auditLog";

export async function listGuru(supabase: SupabaseClient): Promise<Guru[]> {
  return guruRepository.findAll(supabase);
}

export async function getGuruById(supabase: SupabaseClient, id: string): Promise<Guru | null> {
  return guruRepository.findById(supabase, id);
}

// Guru tidak terikat Academic Context (entity global) — academicContextId
// audit selalu null, konsisten dengan cara data Guru disimpan di database.
export async function createGuru(supabase: SupabaseClient, draft: GuruDraft, source: AuditSource = "manual"): Promise<Guru> {
  validateGuruDraft(draft);
  const guru = await guruRepository.create(supabase, draft);
  await recordAuditEvent({
    supabase,
    academicContextId: null,
    action: "create",
    entityType: "guru",
    entityId: guru.id,
    entityLabel: guru.namaGuru,
    after: guru,
    source,
  });
  return guru;
}

export async function updateGuru(
  supabase: SupabaseClient,
  id: string,
  draft: GuruDraft
): Promise<Guru> {
  validateGuruDraft(draft);
  const before = await guruRepository.findById(supabase, id);
  const guru = await guruRepository.update(supabase, id, draft);
  await recordAuditEvent({
    supabase,
    academicContextId: null,
    action: "edit",
    entityType: "guru",
    entityId: id,
    entityLabel: guru.namaGuru,
    before,
    after: guru,
  });
  return guru;
}

export async function deleteGuru(supabase: SupabaseClient, id: string): Promise<void> {
  const before = await guruRepository.findById(supabase, id);
  await guruRepository.remove(supabase, id);
  await recordAuditEvent({
    supabase,
    academicContextId: null,
    action: "delete",
    entityType: "guru",
    entityId: id,
    entityLabel: before?.namaGuru ?? null,
    before,
  });
}

export async function toggleGuruStatus(supabase: SupabaseClient, guru: Guru): Promise<Guru> {
  const nextStatus = guru.status === "aktif" ? "nonaktif" : "aktif";
  // Lewat updateGuru (bukan repository langsung) supaya perubahan status ikut tercatat audit.
  return updateGuru(supabase, guru.id, {
    namaGuru: guru.namaGuru,
    status: nextStatus,
    nip: guru.nip,
    nuptk: guru.nuptk,
    email: guru.email,
    noTelepon: guru.noTelepon,
  });
}
