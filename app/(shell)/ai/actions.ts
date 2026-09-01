"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as usecases from "@/lib/application/aiScheduleFill.usecases";
import { getActiveAcademicContext } from "@/lib/application/academicContext.usecases";
import { listKelas } from "@/lib/application/kelas.usecases";
import { listMataPelajaran } from "@/lib/application/mata-pelajaran.usecases";
import { getSchoolProfile } from "@/lib/application/schoolProfile.usecases";
import { listGuru } from "@/lib/application/guru.usecases";
import { getTargetJpView } from "@/lib/application/targetJp.usecases";
import { listPembagianMengajar } from "@/lib/application/pembagianMengajar.usecases";
import { listRuangan } from "@/lib/application/ruangan.usecases";
import type { AiCopilotContext, AiActionResult } from "@/lib/domain/ai";

async function getActiveContext() {
  const supabase = await createClient();
  const active = await getActiveAcademicContext(supabase);
  if (!active) throw new Error("Belum ada konteks akademik aktif.");
  return { supabase, active };
}

export async function getAiCopilotContextAction(): Promise<AiActionResult<AiCopilotContext>> {
  try {
    const { supabase, active } = await getActiveContext();
    const [kelas, mapel, schoolProfile, guru, targetJpView, pembagianSemua, ruangan] = await Promise.all([
      listKelas(supabase, active.id),
      listMataPelajaran(supabase),
      getSchoolProfile(supabase),
      listGuru(supabase),
      getTargetJpView(supabase, active.id),
      listPembagianMengajar(supabase, active.id),
      listRuangan(supabase),
    ]);

    const teachersBySubject = new Map<string, Map<string, string>>();
    const teacherLoad = new Map<string, number>();
    for (const p of pembagianSemua) {
      if (p.status !== "aktif") continue;
      teacherLoad.set(p.guruId, (teacherLoad.get(p.guruId) ?? 0) + p.jpPerMinggu);
      const m = teachersBySubject.get(p.mataPelajaranId) ?? new Map<string, string>();
      const g = guru.find((x) => x.id === p.guruId);
      if (g) m.set(g.id, g.namaGuru);
      teachersBySubject.set(p.mataPelajaranId, m);
    }
    const activeTeachersByLoad = guru.filter((g) => g.status === "aktif").map((g) => ({ id: g.id, name: g.namaGuru, load: teacherLoad.get(g.id) ?? 0 })).sort((a, b) => a.load - b.load);

    const rowsByKelas = new Map<string, typeof targetJpView.rows>();
    for (const row of targetJpView.rows) {
      const list = rowsByKelas.get(row.kelasId) ?? [];
      list.push(row);
      rowsByKelas.set(row.kelasId, list);
    }

    const classes = kelas.map((k) => {
      const rows = rowsByKelas.get(k.id) ?? [];
      const subjectDeficits = rows.map((r) => ({
        subjectId: r.mataPelajaranId,
        subjectName: r.mataPelajaranNama,
        targetJp: r.targetJp,
        scheduledJp: r.terjadwalJp,
        remainingJp: r.belumSiapJp + r.belumTerjadwalJp,
        belumSiapJp: r.belumSiapJp,
        belumTerjadwalJp: r.belumTerjadwalJp,
        suggestedTeachers: r.belumSiapJp > 0
          ? (() => {
              const relevant = [...(teachersBySubject.get(r.mataPelajaranId) ?? new Map())].map(([id, name]) => ({ id, name, relevant: true }));
              if (relevant.length > 0) return relevant;
              return activeTeachersByLoad.slice(0, 5).map((t) => ({ id: t.id, name: t.name, relevant: false }));
            })()
          : [],
      })).filter((x) => x.remainingJp > 0).sort((a, b) => b.remainingJp - a.remainingJp);

      const subjectExcess = rows.filter((r) => r.scheduledExcessJp > 0).map((r) => ({
        subjectId: r.mataPelajaranId,
        subjectName: r.mataPelajaranNama,
        targetJp: r.targetJp,
        scheduledJp: r.terjadwalJp + r.scheduledExcessJp,
        excessJp: r.scheduledExcessJp,
        schedules: r.schedules.map((s) => ({ id: s.id, day: s.day, periodStart: s.periodStart, periodEnd: s.periodEnd })),
      })).sort((a, b) => b.excessJp - a.excessJp);

      const targetJp = rows.reduce((sum, r) => sum + r.targetJp, 0);
      const scheduledJp = rows.reduce((sum, r) => sum + r.terjadwalJp, 0);
      const belumSiapJp = rows.reduce((sum, r) => sum + r.belumSiapJp, 0);
      const belumTerjadwalJp = rows.reduce((sum, r) => sum + r.belumTerjadwalJp, 0);
      const excessJp = rows.reduce((sum, r) => sum + r.scheduledExcessJp, 0);

      return { id: k.id, label: `${k.tingkat} ${k.namaRombel}`.trim(), targetJp, scheduledJp, remainingJp: Math.max(0, targetJp - scheduledJp), belumSiapJp, belumTerjadwalJp, subjectDeficits, excessJp, subjectExcess };
    });

    return { ok: true, data: { activeContext: active, schoolProfile, classes, guru, mapel, ruangan } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal memuat konteks AI." };
  }
}

export async function aiScheduleFillAction(classId: string, scope: "class" | "class-replace"): Promise<AiActionResult<unknown>> {
  try {
    const { supabase, active } = await getActiveContext();
    const result = await usecases.aiScheduleFill(supabase, active.id, classId, scope);
    revalidatePath("/jadwal");
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "AI gagal memproses." };
  }
}
