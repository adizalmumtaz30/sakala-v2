"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as usecases from "@/lib/application/mata-pelajaran.usecases";
import {
  MataPelajaranValidationError,
  type MataPelajaran,
  type StatusAktif,
} from "@/lib/domain/mata-pelajaran";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createMataPelajaranAction(
  nama: string,
  kode: string,
  status: StatusAktif,
  targetJpPerRombel: number | null
): Promise<ActionResult<MataPelajaran>> {
  try {
    const supabase = await createClient();
    const item = await usecases.createMataPelajaran(supabase, { nama, kode, status, targetJpPerRombel });
    revalidatePath("/mata-pelajaran");
    return { ok: true, data: item };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function updateMataPelajaranAction(
  id: string,
  nama: string,
  kode: string,
  status: StatusAktif,
  targetJpPerRombel: number | null
): Promise<ActionResult<MataPelajaran>> {
  try {
    const supabase = await createClient();
    const item = await usecases.updateMataPelajaran(supabase, id, { nama, kode, status, targetJpPerRombel });
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

function toMessage(err: unknown): string {
  if (err instanceof MataPelajaranValidationError) return err.message;
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}
