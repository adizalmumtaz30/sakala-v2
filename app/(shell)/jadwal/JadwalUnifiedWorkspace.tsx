"use client";

import { useState } from "react";
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

type Mode = "operasional" | "cerdas";

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
  const [mode, setMode] = useState<Mode>("operasional");

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
          <button type="button" role="tab" aria-selected={mode === "operasional"} onClick={() => setMode("operasional")} className={`rounded-lg px-3 py-2.5 text-xs font-semibold transition ${mode === "operasional" ? "bg-surface text-brand-700 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}>
            Jadwal Operasional
          </button>
          <button type="button" role="tab" aria-selected={mode === "cerdas"} onClick={() => setMode("cerdas")} className={`rounded-lg px-3 py-2.5 text-xs font-semibold transition ${mode === "cerdas" ? "bg-surface text-brand-700 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}>
            Jadwal Cerdas · AI
          </button>
        </div>
      </section>

      {mode === "operasional" ? (
        <section aria-label="Jadwal Operasional">
          <JadwalWorkspace activeContext={activeContext} scheduleModels={scheduleModels} jamPelajaranList={jamPelajaranList} slotTemplatesByModel={slotTemplatesByModel} guruList={guruList} kelasList={kelasList} mapelList={mapelList} ruanganList={ruanganList} assignments={assignments} schoolName={schoolName} contextLabel={contextLabel} />
        </section>
      ) : (
        <section aria-label="Jadwal Cerdas dan AI">
          <JadwalCerdasWorkspace activeContext={activeContext} scheduleModels={scheduleModels} guruList={guruList} kelasList={kelasList} mapelList={mapelList} ruanganList={ruanganList} candidateAssignments={candidateAssignments} pembagianMengajarList={pembagianMengajarList} />
        </section>
      )}
    </div>
  );
}
