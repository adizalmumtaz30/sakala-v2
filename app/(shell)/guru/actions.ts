"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toPlainDatabaseError } from "@/lib/utils/databaseError";
import * as guruUseCases from "@/lib/application/guru.usecases";
import { GuruValidationError, type Guru, type GuruDraft } from "@/lib/domain/guru";
import { validateGuruImportRows, type GuruImportRowResult } from "@/lib/domain/guru-import";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createGuruAction(draft: GuruDraft): Promise<ActionResult<Guru>> {
  try {
    const supabase = await createClient();
    const guru = await guruUseCases.createGuru(supabase, draft);
    revalidatePath("/guru");
    return { ok: true, data: guru };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function updateGuruAction(id: string, draft: GuruDraft): Promise<ActionResult<Guru>> {
  try {
    const supabase = await createClient();
    const guru = await guruUseCases.updateGuru(supabase, id, draft);
    revalidatePath("/guru");
    revalidatePath(`/guru/${id}`);
    return { ok: true, data: guru };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function deleteGuruAction(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    await guruUseCases.deleteGuru(supabase, id);
    revalidatePath("/guru");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

/**
 * Validasi baris hasil parse file (preview, Bagian 27) — belum menyentuh database
 * selain membaca daftar guru existing untuk cek duplikat.
 */
export async function validateGuruImportAction(
  rows: Record<string, string>[]
): Promise<ActionResult<GuruImportRowResult[]>> {
  try {
    const supabase = await createClient();
    const existing = await guruUseCases.listGuru(supabase);
    const existingKodes = new Set(existing.map((g) => g.kodeGuru.toUpperCase()));
    const existingNames = new Set(existing.map((g) => g.namaGuru.trim().toLowerCase()));
    return { ok: true, data: validateGuruImportRows(rows, existingKodes, existingNames) };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

/**
 * Commit import (Bagian 78): SELALU re-validate dari nol di server, tidak pernah
 * percaya hasil validasi yang dikirim dari client. Baris tidak valid dilewati,
 * bukan membatalkan seluruh import (Bagian 22-23: opsional tidak boleh blocking).
 */
export async function commitGuruImportAction(
  rows: Record<string, string>[]
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  try {
    const supabase = await createClient();
    const existing = await guruUseCases.listGuru(supabase);
    const existingKodes = new Set(existing.map((g) => g.kodeGuru.toUpperCase()));
    const existingNames = new Set(existing.map((g) => g.namaGuru.trim().toLowerCase()));
    const results = validateGuruImportRows(rows, existingKodes, existingNames);

    let imported = 0;
    let skipped = 0;
    for (const row of results) {
      if (row.status !== "valid") {
        skipped++;
        continue;
      }
      await guruUseCases.createGuru(supabase, row.draft, "import");
      imported++;
    }

    revalidatePath("/guru");
    return { ok: true, data: { imported, skipped } };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

function toMessage(err: unknown): string {
  if (err instanceof GuruValidationError) return err.message;
  if (err && typeof err === "object" && "code" in err) return toPlainDatabaseError(err);
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}
