// Application layer — Pembagian Mengajar (Bagian 35-36 / 72-75).

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validatePembagianMengajarDraft,
  summarizeJp,
  type PembagianMengajar,
  type PembagianMengajarDraft,
  PembagianMengajarValidationError,
} from "@/lib/domain/pembagianMengajar";
import { pembagianMengajarRepository } from "@/lib/data-access/pembagianMengajar.repository";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import { recordAuditEvent } from "@/lib/application/auditLog.usecases";
import type { AuditSource } from "@/lib/domain/auditLog";

const ASSIGNMENT_ACTIVE_STATUSES = new Set(["draft", "candidate", "committed"]);

/**
 * Bagian 73: hitung JP yang sudah dijadwalkan lewat schedule_assignment yang
 * cocok teacherId+subjectId+classId pada konteks yang sama (draft/candidate/
 * committed dihitung "sudah dipakai" — hanya archived/cancelled diabaikan).
 * Computed di sini, TIDAK disimpan mentah (konsisten dengan Guru.totalJamMengajar).
 */
async function attachJpTerjadwal(
  supabase: SupabaseClient,
  academicContextId: string,
  items: PembagianMengajar[]
): Promise<PembagianMengajar[]> {
  if (items.length === 0) return items;
  const assignments = await scheduleAssignmentRepository.findByContext(supabase, academicContextId);

  return items.map((item) => {
    const jpTerjadwal = assignments
      .filter(
        (a) =>
          ASSIGNMENT_ACTIVE_STATUSES.has(a.status) &&
          a.teacherId === item.guruId &&
          a.subjectId === item.mataPelajaranId &&
          a.classId === item.kelasId
      )
      .reduce((sum, a) => sum + (a.periodEnd - a.periodStart + 1), 0);
    const { jpTersisa } = summarizeJp(item.jpPerMinggu, jpTerjadwal);
    return { ...item, jpTerjadwal, jpTersisa };
  });
}

export async function listPembagianMengajar(
  supabase: SupabaseClient,
  academicContextId: string
): Promise<PembagianMengajar[]> {
  const items = await pembagianMengajarRepository.findByContext(supabase, academicContextId);
  return attachJpTerjadwal(supabase, academicContextId, items);
}

/** Bagian 28: pesan forensic, bukan generik — sebut siapa pemilik kombinasi yang bentrok. */
async function assertNoDuplicateCombination(
  supabase: SupabaseClient,
  draft: PembagianMengajarDraft,
  excludeId?: string
): Promise<void> {
  const existing = await pembagianMengajarRepository.findByCombination(
    supabase,
    draft.academicContextId,
    draft.guruId,
    draft.mataPelajaranId,
    draft.kelasId
  );
  if (existing && existing.id !== excludeId) {
    throw new PembagianMengajarValidationError(
      "kombinasi",
      "Kombinasi Guru + Mata Pelajaran + Kelas ini sudah terdaftar di Pembagian Mengajar untuk konteks akademik aktif."
    );
  }
}

export async function createPembagianMengajar(
  supabase: SupabaseClient,
  draft: PembagianMengajarDraft,
  source: AuditSource = "manual",
  reason?: string | null
): Promise<PembagianMengajar> {
  validatePembagianMengajarDraft(draft);
  await assertNoDuplicateCombination(supabase, draft);
  const item = await pembagianMengajarRepository.create(supabase, draft);
  await recordAuditEvent({
    supabase,
    academicContextId: item.academicContextId,
    action: "create",
    entityType: "pembagian_mengajar",
    entityId: item.id,
    entityLabel: null,
    after: item,
    source,
    reason: reason ?? null,
  });
  return item;
}

export async function updatePembagianMengajar(
  supabase: SupabaseClient,
  id: string,
  draft: PembagianMengajarDraft
): Promise<PembagianMengajar> {
  validatePembagianMengajarDraft(draft);
  await assertNoDuplicateCombination(supabase, draft, id);
  const before = await pembagianMengajarRepository.findById(supabase, id);
  const item = await pembagianMengajarRepository.update(supabase, id, draft);
  await recordAuditEvent({
    supabase,
    academicContextId: item.academicContextId,
    action: "edit",
    entityType: "pembagian_mengajar",
    entityId: id,
    entityLabel: null,
    before,
    after: item,
  });
  return item;
}

export async function togglePembagianMengajarStatus(
  supabase: SupabaseClient,
  item: PembagianMengajar
): Promise<PembagianMengajar> {
  const nextStatus = item.status === "aktif" ? "nonaktif" : "aktif";
  // Lewat updatePembagianMengajar (bukan repository langsung) supaya toggle status ikut tercatat audit.
  return updatePembagianMengajar(supabase, item.id, {
    academicContextId: item.academicContextId,
    guruId: item.guruId,
    mataPelajaranId: item.mataPelajaranId,
    kelasId: item.kelasId,
    jpPerMinggu: item.jpPerMinggu,
    status: nextStatus,
  });
}

/**
 * Bagian 80-81 (soft delete): kalau sudah punya JP terjadwal (dipakai di
 * schedule_assignment), TOLAK hapus permanen — arahkan ke nonaktifkan saja,
 * supaya assignment yang sudah ada tidak jadi yatim secara data historis.
 * Hanya boleh hard delete kalau belum pernah dipakai penjadwalan sama sekali.
 */
export async function deletePembagianMengajar(supabase: SupabaseClient, id: string): Promise<void> {
  const item = await pembagianMengajarRepository.findById(supabase, id);
  if (!item) return;

  const [withJp] = await attachJpTerjadwal(supabase, item.academicContextId, [item]);
  if ((withJp.jpTerjadwal ?? 0) > 0) {
    throw new PembagianMengajarValidationError(
      "hapus",
      `Pembagian mengajar ini sudah punya ${withJp.jpTerjadwal} JP terjadwal. Nonaktifkan saja, bukan hapus, supaya jadwal yang sudah ada tidak kehilangan rujukan.`
    );
  }

  await pembagianMengajarRepository.remove(supabase, id);
  await recordAuditEvent({
    supabase,
    academicContextId: item.academicContextId,
    action: "delete",
    entityType: "pembagian_mengajar",
    entityId: id,
    entityLabel: null,
    before: item,
  });
}
