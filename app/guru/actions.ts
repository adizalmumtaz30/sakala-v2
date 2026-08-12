"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as guruUseCases from "@/lib/application/guru.usecases";
import { GuruValidationError, type Guru, type StatusAktif } from "@/lib/domain/guru";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createGuruAction(
  namaGuru: string,
  status: StatusAktif
): Promise<ActionResult<Guru>> {
  try {
    const supabase = await createClient();
    const guru = await guruUseCases.createGuru(supabase, { namaGuru, status });
    revalidatePath("/guru");
    return { ok: true, data: guru };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function updateGuruAction(
  id: string,
  namaGuru: string,
  status: StatusAktif
): Promise<ActionResult<Guru>> {
  try {
    const supabase = await createClient();
    const guru = await guruUseCases.updateGuru(supabase, id, { namaGuru, status });
    revalidatePath("/guru");
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

function toMessage(err: unknown): string {
  if (err instanceof GuruValidationError) return err.message;
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}
