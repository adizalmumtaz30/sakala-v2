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
import * as scheduleModelUseCases from "@/lib/application/scheduleModel.usecases";
import * as slotTemplateUseCases from "@/lib/application/slotTemplate.usecases";
import { ScheduleModelValidationError, type ScheduleModel, type ScheduleModelDraft } from "@/lib/domain/scheduleModel";
import { SlotTemplateValidationError, type SlotTemplate, type SlotTemplateDraft } from "@/lib/domain/slotTemplate";

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

// =========================================================
// Bagian 20 / 84 — SCHEDULE MODEL
// =========================================================

export async function createScheduleModelAction(draft: ScheduleModelDraft): Promise<ActionResult<ScheduleModel>> {
  try {
    const supabase = await createClient();
    const model = await scheduleModelUseCases.createScheduleModel(supabase, draft);
    revalidatePath("/akademik");
    return { ok: true, data: model };
  } catch (err) {
    return { ok: false, error: toScheduleModelMessage(err) };
  }
}

export async function updateScheduleModelAction(id: string, draft: ScheduleModelDraft): Promise<ActionResult<ScheduleModel>> {
  try {
    const supabase = await createClient();
    const model = await scheduleModelUseCases.updateScheduleModel(supabase, id, draft);
    revalidatePath("/akademik");
    return { ok: true, data: model };
  } catch (err) {
    return { ok: false, error: toScheduleModelMessage(err) };
  }
}

export async function deleteScheduleModelAction(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    await scheduleModelUseCases.deleteScheduleModel(supabase, id);
    revalidatePath("/akademik");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: toScheduleModelMessage(err) };
  }
}

// =========================================================
// Bagian 20.2 — SLOT TEMPLATE
// =========================================================

export async function listSlotTemplateAction(scheduleModelId: string): Promise<ActionResult<SlotTemplate[]>> {
  try {
    const supabase = await createClient();
    const list = await slotTemplateUseCases.listSlotTemplate(supabase, scheduleModelId);
    return { ok: true, data: list };
  } catch (err) {
    return { ok: false, error: toSlotTemplateMessage(err) };
  }
}

export async function createSlotTemplateAction(draft: SlotTemplateDraft): Promise<ActionResult<SlotTemplate>> {
  try {
    const supabase = await createClient();
    const slot = await slotTemplateUseCases.createSlotTemplate(supabase, draft);
    revalidatePath("/akademik");
    return { ok: true, data: slot };
  } catch (err) {
    return { ok: false, error: toSlotTemplateMessage(err) };
  }
}

export async function updateSlotTemplateAction(id: string, draft: SlotTemplateDraft): Promise<ActionResult<SlotTemplate>> {
  try {
    const supabase = await createClient();
    const slot = await slotTemplateUseCases.updateSlotTemplate(supabase, id, draft);
    revalidatePath("/akademik");
    return { ok: true, data: slot };
  } catch (err) {
    return { ok: false, error: toSlotTemplateMessage(err) };
  }
}

export async function deleteSlotTemplateAction(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    await slotTemplateUseCases.deleteSlotTemplate(supabase, id);
    revalidatePath("/akademik");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: toSlotTemplateMessage(err) };
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

function toScheduleModelMessage(err: unknown): string {
  if (err instanceof ScheduleModelValidationError) return err.message;
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}

function toSlotTemplateMessage(err: unknown): string {
  if (err instanceof SlotTemplateValidationError) return err.message;
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}
