"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as usecases from "@/lib/application/pembagianMengajar.usecases";
import { listGuru } from "@/lib/application/guru.usecases";
import { listMataPelajaran } from "@/lib/application/mata-pelajaran.usecases";
import { listKelas } from "@/lib/application/kelas.usecases";
import {
  PembagianMengajarValidationError,
  type PembagianMengajar,
  type PembagianMengajarDraft,
} from "@/lib/domain/pembagianMengajar";
import {
  buildGuruLookup,
  buildMapelLookup,
  buildKelasLookup,
  validatePembagianMengajarImportRows,
  type PembagianMengajarImportRowResult,
} from "@/lib/domain/pembagianMengajar-import";
import { pembagianMengajarRepository } from "@/lib/data-access/pembagianMengajar.repository";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createPembagianMengajarAction(
  draft: PembagianMengajarDraft
): Promise<ActionResult<PembagianMengajar>> {
  try {
    const supabase = await createClient();
    const item = await usecases.createPembagianMengajar(supabase, draft);
    revalidatePath("/pembagian-mengajar");
    return { ok: true, data: item };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function updatePembagianMengajarAction(
  id: string,
  draft: PembagianMengajarDraft
): Promise<ActionResult<PembagianMengajar>> {
  try {
    const supabase = await createClient();
    const item = await usecases.updatePembagianMengajar(supabase, id, draft);
    revalidatePath("/pembagian-mengajar");
    return { ok: true, data: item };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function toggleStatusPembagianMengajarAction(
  item: PembagianMengajar
): Promise<ActionResult<PembagianMengajar>> {
  try {
    const supabase = await createClient();
    const updated = await usecases.togglePembagianMengajarStatus(supabase, item);
    revalidatePath("/pembagian-mengajar");
    return { ok: true, data: updated };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function deletePembagianMengajarAction(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    await usecases.deletePembagianMengajar(supabase, id);
    revalidatePath("/pembagian-mengajar");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

/** Siapkan lookup Guru/Mapel/Kelas (Bagian 75) sekali pakai untuk validate & commit. */
async function buildLookups(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [guruList, mapelList, kelasList] = await Promise.all([
    listGuru(supabase),
    listMataPelajaran(supabase),
    listKelas(supabase),
  ]);
  return {
    guruLookup: buildGuruLookup(guruList.map((g) => ({ id: g.id, namaGuru: g.namaGuru, kodeGuru: g.kodeGuru }))),
    mapelLookup: buildMapelLookup(mapelList.map((m) => ({ id: m.id, nama: m.nama, kode: m.kode }))),
    kelasLookup: buildKelasLookup(kelasList.map((k) => ({ id: k.id, tingkat: k.tingkat, namaRombel: k.namaRombel }))),
  };
}

export async function validatePembagianMengajarImportAction(
  rows: Record<string, string>[],
  academicContextId: string
): Promise<ActionResult<PembagianMengajarImportRowResult[]>> {
  try {
    const supabase = await createClient();
    const { guruLookup, mapelLookup, kelasLookup } = await buildLookups(supabase);
    const existing = await pembagianMengajarRepository.findByContext(supabase, academicContextId);
    const existingCombos = new Set(
      existing.map((e) => `${e.guruId}|${e.mataPelajaranId}|${e.kelasId}`)
    );
    return {
      ok: true,
      data: validatePembagianMengajarImportRows(rows, academicContextId, guruLookup, mapelLookup, kelasLookup, existingCombos),
    };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function commitPembagianMengajarImportAction(
  rows: Record<string, string>[],
  academicContextId: string
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  try {
    const supabase = await createClient();
    const { guruLookup, mapelLookup, kelasLookup } = await buildLookups(supabase);
    const existing = await pembagianMengajarRepository.findByContext(supabase, academicContextId);
    const existingCombos = new Set(
      existing.map((e) => `${e.guruId}|${e.mataPelajaranId}|${e.kelasId}`)
    );
    const results = validatePembagianMengajarImportRows(
      rows,
      academicContextId,
      guruLookup,
      mapelLookup,
      kelasLookup,
      existingCombos
    );

    let imported = 0;
    let skipped = 0;
    for (const row of results) {
      if (row.status !== "valid" || !row.draft) {
        skipped++;
        continue;
      }
      await usecases.createPembagianMengajar(supabase, row.draft);
      imported++;
    }

    revalidatePath("/pembagian-mengajar");
    return { ok: true, data: { imported, skipped } };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

function toMessage(err: unknown): string {
  if (err instanceof PembagianMengajarValidationError) return err.message;
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}
