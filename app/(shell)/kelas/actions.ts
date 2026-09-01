"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as usecases from "@/lib/application/kelas.usecases";
import { getActiveAcademicContext } from "@/lib/application/academicContext.usecases";
import { KelasValidationError, type Kelas, type StatusAktif } from "@/lib/domain/kelas";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function requireActiveContext() {
  const supabase = await createClient();
  const context = await getActiveAcademicContext(supabase);
  if (!context) throw new Error("Belum ada konteks akademik aktif.");
  return { supabase, context };
}

export async function createKelasAction(
  tingkat: string,
  namaRombel: string,
  status: StatusAktif
): Promise<ActionResult<Kelas>> {
  try {
    const { supabase, context } = await requireActiveContext();
    const item = await usecases.createKelas(supabase, context.id, { tingkat, namaRombel, status });
    revalidatePath("/kelas");
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
    const { supabase, context } = await requireActiveContext();
    const item = await usecases.updateKelas(supabase, context.id, id, { tingkat, namaRombel, status });
    revalidatePath("/kelas");
    return { ok: true, data: item };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function deleteKelasAction(id: string): Promise<ActionResult<null>> {
  try {
    const { supabase, context } = await requireActiveContext();
    await usecases.deleteKelas(supabase, context.id, id);
    revalidatePath("/kelas");
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
