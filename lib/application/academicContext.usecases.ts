// Application layer — use case / orchestration. Memanggil Domain untuk validasi
// dan Data Access untuk persistence. UI (Presentation) hanya boleh memanggil layer ini.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateAcademicContextDraft,
  type AcademicContext,
  type AcademicContextDraft,
  AcademicContextValidationError,
} from "@/lib/domain/academicContext";
import { academicContextRepository } from "@/lib/data-access/academicContext.repository";

export async function listAcademicContexts(supabase: SupabaseClient): Promise<AcademicContext[]> {
  return academicContextRepository.findAll(supabase);
}

export async function getActiveAcademicContext(supabase: SupabaseClient): Promise<AcademicContext | null> {
  return academicContextRepository.findActive(supabase);
}

/**
 * Bagian 78: School Profile menyimpan default context, TIDAK otomatis jadi
 * active context. Pengecualian satu-satunya adalah bootstrap: kalau ini
 * context pertama yang pernah dibuat di seluruh sistem, ia otomatis aktif —
 * supaya app tidak pernah berada di kondisi "tidak ada context aktif sama sekali".
 */
export async function createAcademicContext(
  supabase: SupabaseClient,
  draft: AcademicContextDraft
): Promise<AcademicContext> {
  validateAcademicContextDraft(draft);

  const existing = await academicContextRepository.findByPair(supabase, draft.tahunPelajaran.trim(), draft.semester);
  if (existing) {
    throw new AcademicContextValidationError(
      "tahunPelajaran",
      "Konteks dengan tahun pelajaran dan semester ini sudah ada."
    );
  }

  const all = await academicContextRepository.findAll(supabase);
  const isFirstEver = all.length === 0;

  return academicContextRepository.create(supabase, draft, isFirstEver);
}

/**
 * Bagian 8.3 / 77 — Context switch. Client (UI) bertanggung jawab atas langkah
 * "check unsaved changes" dan "confirm" sebelum memanggil ini; use case ini
 * mengeksekusi langkah "load new context" dan menegakkan single-active-context.
 */
export async function setActiveAcademicContext(supabase: SupabaseClient, id: string): Promise<AcademicContext> {
  return academicContextRepository.setActive(supabase, id);
}

export async function deleteAcademicContext(supabase: SupabaseClient, context: AcademicContext): Promise<void> {
  if (context.isActive) {
    throw new AcademicContextValidationError(
      "isActive",
      "Tidak bisa menghapus konteks yang sedang aktif. Aktifkan konteks lain dulu."
    );
  }
  return academicContextRepository.remove(supabase, context.id);
}
