"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as academicContextUseCases from "@/lib/application/academicContext.usecases";
import * as schoolProfileUseCases from "@/lib/application/schoolProfile.usecases";
import * as periodeAkademikUseCases from "@/lib/application/periodeAkademik.usecases";
import * as jamPelajaranUseCases from "@/lib/application/jamPelajaran.usecases";
import { AcademicContextValidationError, type AcademicContext, type Semester } from "@/lib/domain/academicContext";
import { SchoolProfileValidationError, type SchoolProfile } from "@/lib/domain/schoolProfile";
import {
  PeriodeAkademikValidationError,
  type PeriodeAkademik,
  type PeriodeAkademikDraft,
} from "@/lib/domain/periodeAkademik";
import { JamPelajaranValidationError, type JamPelajaran, type JamPelajaranDraft } from "@/lib/domain/jamPelajaran";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createAcademicContextAction(
  tahunPelajaran: string,
  semester: Semester
): Promise<ActionResult<AcademicContext>> {
  try {
    const supabase = await createClient();
    const context = await academicContextUseCases.createAcademicContext(supabase, { tahunPelajaran, semester });
    revalidatePath("/akademik");
    revalidatePath("/");
    return { ok: true, data: context };
  } catch (err) {
    return { ok: false, error: toContextMessage(err) };
  }
}

export async function setActiveAcademicContextAction(id: string): Promise<ActionResult<AcademicContext>> {
  try {
    const supabase = await createClient();
    const context = await academicContextUseCases.setActiveAcademicContext(supabase, id);
    revalidatePath("/akademik");
    revalidatePath("/");
    return { ok: true, data: context };
  } catch (err) {
    return { ok: false, error: toContextMessage(err) };
  }
}

export async function deleteAcademicContextAction(context: AcademicContext): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    await academicContextUseCases.deleteAcademicContext(supabase, context);
    revalidatePath("/akademik");
    revalidatePath("/");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: toContextMessage(err) };
  }
}

export async function saveSchoolProfileAction(
  existingId: string | null,
  nama: string,
  jabatan: string,
  namaSekolah: string,
  tahunPelajaranDefault: string,
  semesterDefault: Semester
): Promise<ActionResult<{ profile: SchoolProfile; contexts: AcademicContext[] }>> {
  try {
    const supabase = await createClient();
    const profile = await schoolProfileUseCases.saveSchoolProfile(supabase, existingId, {
      nama,
      jabatan,
      namaSekolah,
      tahunPelajaranDefault,
      semesterDefault,
    });
    // Simpan profil bisa memicu pembuatan default context (bootstrap) —
    // kembalikan daftar context terbaru sekalian supaya client tidak perlu menebak.
    const contexts = await academicContextUseCases.listAcademicContexts(supabase);
    revalidatePath("/akademik");
    revalidatePath("/");
    return { ok: true, data: { profile, contexts } };
  } catch (err) {
    return { ok: false, error: toProfileMessage(err) };
  }
}

// =========================================================
// Bagian 19 / 83 — PERIODE AKADEMIK
// =========================================================

export async function createPeriodeAkademikAction(
  draft: PeriodeAkademikDraft
): Promise<ActionResult<PeriodeAkademik>> {
  try {
    const supabase = await createClient();
    const periode = await periodeAkademikUseCases.createPeriodeAkademik(supabase, draft);
    revalidatePath("/akademik");
    return { ok: true, data: periode };
  } catch (err) {
    return { ok: false, error: toPeriodeMessage(err) };
  }
}

export async function updatePeriodeAkademikAction(
  id: string,
  draft: PeriodeAkademikDraft
): Promise<ActionResult<PeriodeAkademik>> {
  try {
    const supabase = await createClient();
    const periode = await periodeAkademikUseCases.updatePeriodeAkademik(supabase, id, draft);
    revalidatePath("/akademik");
    return { ok: true, data: periode };
  } catch (err) {
    return { ok: false, error: toPeriodeMessage(err) };
  }
}

export async function deletePeriodeAkademikAction(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    await periodeAkademikUseCases.deletePeriodeAkademik(supabase, id);
    revalidatePath("/akademik");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: toPeriodeMessage(err) };
  }
}

// =========================================================
// Bagian 19.1 / 83 — JAM PELAJARAN
// =========================================================

export async function createJamPelajaranAction(draft: JamPelajaranDraft): Promise<ActionResult<JamPelajaran>> {
  try {
    const supabase = await createClient();
    const jam = await jamPelajaranUseCases.createJamPelajaran(supabase, draft);
    revalidatePath("/akademik");
    return { ok: true, data: jam };
  } catch (err) {
    return { ok: false, error: toJamMessage(err) };
  }
}

export async function updateJamPelajaranAction(
  id: string,
  draft: JamPelajaranDraft
): Promise<ActionResult<JamPelajaran>> {
  try {
    const supabase = await createClient();
    const jam = await jamPelajaranUseCases.updateJamPelajaran(supabase, id, draft);
    revalidatePath("/akademik");
    return { ok: true, data: jam };
  } catch (err) {
    return { ok: false, error: toJamMessage(err) };
  }
}

export async function deleteJamPelajaranAction(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    await jamPelajaranUseCases.deleteJamPelajaran(supabase, id);
    revalidatePath("/akademik");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: toJamMessage(err) };
  }
}

function toContextMessage(err: unknown): string {
  if (err instanceof AcademicContextValidationError) return err.message;
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}

function toProfileMessage(err: unknown): string {
  if (err instanceof SchoolProfileValidationError) return err.message;
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}

function toPeriodeMessage(err: unknown): string {
  if (err instanceof PeriodeAkademikValidationError) return err.message;
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}

function toJamMessage(err: unknown): string {
  if (err instanceof JamPelajaranValidationError) return err.message;
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}
