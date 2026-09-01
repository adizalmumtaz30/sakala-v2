"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as usecases from "@/lib/application/kelas.usecases";
import { KelasValidationError, type Kelas, type StatusAktif } from "@/lib/domain/kelas";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createKelasAction(
  tingkat: string,
  namaRombel: string,
  status: StatusAktif
): Promise<ActionResult<Kelas>> {
  try {
    const supabase = await createClient();
    const item = await usecases.createKelas(supabase, { tingkat, namaRombel, status });
    revalidatePath("/kelas");
    revalidatePath("/akademik");
    return { ok: true, data: item };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function updateKelasAction(
  id: string,
  tingkat: string,
  namaRombel: string,
  status: StatusAktif
): Promise<ActionResult<Kelas>> {
  try {
    const supabase = await createClient();
    const item = await usecases.updateKelas(supabase, id, { tingkat, namaRombel, status });
    revalidatePath("/kelas");
    revalidatePath("/akademik");
    return { ok: true, data: item };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function deleteKelasAction(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    await usecases.deleteKelas(supabase, id);
    revalidatePath("/kelas");
    revalidatePath("/akademik");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

function toMessage(err: unknown): string {
  if (err instanceof KelasValidationError) return err.message;
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}
