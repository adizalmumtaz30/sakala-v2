"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toPlainDatabaseError } from "@/lib/utils/databaseError";
import * as usecases from "@/lib/application/ruangan.usecases";
import { RuanganValidationError, type Ruangan, type StatusAktif } from "@/lib/domain/ruangan";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createRuanganAction(
  nama: string,
  kapasitas: number | null,
  tipeRuangan: string,
  status: StatusAktif
): Promise<ActionResult<Ruangan>> {
  try {
    const supabase = await createClient();
    const item = await usecases.createRuangan(supabase, { nama, kapasitas, tipeRuangan, status });
    revalidatePath("/ruangan");
    return { ok: true, data: item };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function updateRuanganAction(
  id: string,
  nama: string,
  kapasitas: number | null,
  tipeRuangan: string,
  status: StatusAktif
): Promise<ActionResult<Ruangan>> {
  try {
    const supabase = await createClient();
    const item = await usecases.updateRuangan(supabase, id, { nama, kapasitas, tipeRuangan, status });
    revalidatePath("/ruangan");
    return { ok: true, data: item };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function deleteRuanganAction(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    await usecases.deleteRuangan(supabase, id);
    revalidatePath("/ruangan");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

function toMessage(err: unknown): string {
  if (err instanceof RuanganValidationError) return err.message;
  if (err && typeof err === "object" && "code" in err) return toPlainDatabaseError(err);
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}
