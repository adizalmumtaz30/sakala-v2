"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as usecases from "@/lib/application/mata-pelajaran.usecases";
import {
  MataPelajaranValidationError,
  type MataPelajaran,
  type MataPelajaranDraft,
} from "@/lib/domain/mata-pelajaran";
import { validateMapelImportRows, type MapelImportRowResult } from "@/lib/domain/mapel-import";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createMataPelajaranAction(
  draft: MataPelajaranDraft
): Promise<ActionResult<MataPelajaran>> {
  try {
    const supabase = await createClient();
    const item = await usecases.createMataPelajaran(supabase, draft);
    revalidatePath("/mata-pelajaran");
    return { ok: true, data: item };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function updateMataPelajaranAction(
  id: string,
  draft: MataPelajaranDraft
): Promise<ActionResult<MataPelajaran>> {
  try {
    const supabase = await createClient();
    const item = await usecases.updateMataPelajaran(supabase, id, draft);
    revalidatePath("/mata-pelajaran");
    return { ok: true, data: item };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function deleteMataPelajaranAction(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    await usecases.deleteMataPelajaran(supabase, id);
    revalidatePath("/mata-pelajaran");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function validateMapelImportAction(
  rows: Record<string, string>[]
): Promise<ActionResult<MapelImportRowResult[]>> {
  try {
    const supabase = await createClient();
    const existing = await usecases.listMataPelajaran(supabase);
    const existingKodes = new Set(existing.map((m) => (m.kode ?? "").toUpperCase()).filter(Boolean));
    const existingNames = new Set(existing.map((m) => m.nama.trim().toLowerCase()));
    return { ok: true, data: validateMapelImportRows(rows, existingKodes, existingNames) };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function commitMapelImportAction(
  rows: Record<string, string>[]
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  try {
    const supabase = await createClient();
    const existing = await usecases.listMataPelajaran(supabase);
    const existingKodes = new Set(existing.map((m) => (m.kode ?? "").toUpperCase()).filter(Boolean));
    const existingNames = new Set(existing.map((m) => m.nama.trim().toLowerCase()));
    const results = validateMapelImportRows(rows, existingKodes, existingNames);

    let imported = 0;
    let skipped = 0;
    for (const row of results) {
      if (row.status !== "valid") {
        skipped++;
        continue;
      }
      await usecases.createMataPelajaran(supabase, row.draft);
      imported++;
    }

    revalidatePath("/mata-pelajaran");
    return { ok: true, data: { imported, skipped } };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

function toMessage(err: unknown): string {
  if (err instanceof MataPelajaranValidationError) return err.message;
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}
