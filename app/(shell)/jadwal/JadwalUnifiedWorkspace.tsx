"use client";

import type { AcademicContext } from "@/lib/domain/academicContext";
import type { ScheduleModel } from "@/lib/domain/scheduleModel";
import type { Guru } from "@/lib/domain/guru";
import type { Kelas } from "@/lib/domain/kelas";
import type { MataPelajaran } from "@/lib/domain/mata-pelajaran";
import type { Ruangan } from "@/lib/domain/ruangan";
import type { JamPelajaran } from "@/lib/domain/jamPelajaran";
import type { SlotTemplate } from "@/lib/domain/slotTemplate";
import type { ScheduleAssignment } from "@/lib/domain/scheduleAssignment";
import type { PembagianMengajar } from "@/lib/domain/pembagianMengajar";
import JadwalWorkspace from "./JadwalWorkspace";
import JadwalCerdasWorkspace from "../jadwal-cerdas/JadwalCerdasWorkspace";

export default function JadwalUnifiedWorkspace({
  activeContext, scheduleModels, jamPelajaranList, slotTemplatesByModel, guruList, kelasList, mapelList, ruanganList,
  assignments, candidateAssignments, pembagianMengajarList, schoolName, contextLabel,
}: {
  activeContext: AcademicContext;
  scheduleModels: ScheduleModel[];
  jamPelajaranList: JamPelajaran[];
  slotTemplatesByModel: Record<string, SlotTemplate[]>;
  guruList: Guru[];
  kelasList: Kelas[];
  mapelList: MataPelajaran[];
  ruanganList: Ruangan[];
  assignments: ScheduleAssignment[];
  candidateAssignments: ScheduleAssignment[];
  pembagianMengajarList: PembagianMengajar[];
  schoolName?: string;
  contextLabel: string;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/70 bg-surface/95 p-3 shadow-[0_1px_2px_rgba(15,23,42,.03)] sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-600">Schedule Workspace</p>
            <h1 className="mt-1 text-lg font-bold tracking-tight text-ink-900">Jadwal</h1>
            <p className="mt-1 text-xs text-ink-500">Satu ruang kerja untuk melihat, menyusun, menganalisis, dan memvalidasi jadwal.</p>
          </div>
          <span className="rounded-full border border-brand-600/15 bg-brand-50 px-3 py-1.5 text-[10px] font-semibold text-brand-700">{contextLabel}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1" role="tablist" aria-label="Mode Jadwal">
          <label className="cursor-pointer rounded-lg px-3 py-2.5 text-center text-xs font-semibold text-ink-500 transition has-[:checked]:bg-surface has-[:checked]:text-brand-700 has-[:checked]:shadow-sm">
            <input type="radio" name="schedule-mode" defaultChecked className="sr-only" />
            Jadwal Operasional
          </label>
          <label className="cursor-pointer rounded-lg px-3 py-2.5 text-center text-xs font-semibold text-ink-500 transition has-[:checked]:bg-surface has-[:checked]:text-brand-700 has-[:checked]:shadow-sm">
            <input type="radio" name="schedule-mode" className="sr-only" />
            Jadwal Cerdas · AI
          </label>
        </div>
      </section>

      <div className="space-y-6">
        <section aria-label="Jadwal Operasional">
          <JadwalWorkspace activeContext={activeContext} scheduleModels={scheduleModels} jamPelajaranList={jamPelajaranList} slotTemplatesByModel={slotTemplatesByModel} guruList={guruList} kelasList={kelasList} mapelList={mapelList} ruanganList={ruanganList} assignments={assignments} schoolName={schoolName} contextLabel={contextLabel} />
        </section>
        <section aria-label="Jadwal Cerdas dan AI" className="border-t border-border pt-6">
          <JadwalCerdasWorkspace activeContext={activeContext} scheduleModels={scheduleModels} guruList={guruList} kelasList={kelasList} mapelList={mapelList} ruanganList={ruanganList} candidateAssignments={candidateAssignments} pembagianMengajarList={pembagianMengajarList} />
        </section>
      </div>
    </div>
  );
}
