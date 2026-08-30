"use client";

// SAKALA MASTER RULE (Core Consolidation / Bagian 16 — Minimum Page
// Switching): "Jadwal" dan "Jadwal Cerdas" sebelumnya dua route terpisah
// (dua entri sidebar, dua page.tsx yang masing-masing fetch data sendiri --
// 7 query yang sama persis dobel setiap kali operator pindah antar
// keduanya). Operator sebenarnya melakukan SATU pekerjaan (menyusun jadwal),
// bukan dua pekerjaan berbeda.
//
// Shell ini menyatukan keduanya jadi SATU halaman dengan tab, TANPA
// menyentuh logic internal JadwalWorkspace (operasional, 1173 baris) atau
// JadwalCerdasWorkspace (generate/kandidat, 804 baris) -- keduanya dipakai
// apa adanya untuk menghindari risiko regresi pada Conflict Engine dan
// Candidate Generator yang sudah terbukti benar (kontrak: DO NOT TOUCH
// business logic yang sudah benar tanpa evidence problem).
//
// Tab disinkronkan ke URL (?mode=cerdas) -- bukan cuma useState lokal --
// supaya refresh, back/forward, dan link "Lihat Jadwal Cerdas" dari halaman
// lain tetap mendarat di tab yang benar (context tidak boleh hilang).
// Hanya tab aktif yang di-mount (bukan disembunyikan lewat CSS), supaya
// tidak dua workspace berat sekaligus hidup di DOM.

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import JadwalPointerDrag from "@/components/jadwal/JadwalPointerDrag";

type Mode = "operasional" | "cerdas";

export default function JadwalUnifiedWorkspace({
  activeContext,
  scheduleModels,
  jamPelajaranList,
  slotTemplatesByModel,
  guruList,
  kelasList,
  mapelList,
  ruanganList,
  assignments,
  pembagianMengajarList,
  schoolName,
  contextLabel,
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
  pembagianMengajarList: PembagianMengajar[];
  schoolName?: string;
  contextLabel: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode: Mode = searchParams.get("mode") === "cerdas" ? "cerdas" : "operasional";

  const setMode = useCallback(
    (next: Mode) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "operasional") params.delete("mode");
      else params.set("mode", next);
      const query = params.toString();
      router.replace(query ? `/jadwal?${query}` : "/jadwal", { scroll: false });
    },
    [router, searchParams]
  );

  const candidateAssignments = useMemo(() => assignments.filter((a) => a.status === "candidate"), [assignments]);

  return (
    <div data-sakala-jadwal-root className="space-y-4">
      <h1 className="sr-only">Jadwal</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-surface-muted p-1" role="tablist" aria-label="Mode Jadwal">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "operasional"}
            onClick={() => setMode("operasional")}
            className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors ${
              mode === "operasional" ? "bg-surface text-brand-700 shadow-sm" : "text-ink-500 hover:text-ink-700"
            }`}
          >
            Jadwal Operasional
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "cerdas"}
            onClick={() => setMode("cerdas")}
            className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors ${
              mode === "cerdas" ? "bg-surface text-brand-700 shadow-sm" : "text-ink-500 hover:text-ink-700"
            }`}
          >
            Generate &amp; Kandidat
            {candidateAssignments.length > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-600/10 px-1.5 py-0.5 text-[10.5px] text-brand-700">{candidateAssignments.length}</span>
            )}
          </button>
        </div>
        <span className="rounded-full border border-brand-600/15 bg-brand-50 px-3 py-1.5 text-[11px] font-semibold text-brand-700">{contextLabel}</span>
      </div>

      {mode === "operasional" ? (
        <>
          <JadwalPointerDrag academicContextId={activeContext.id} scheduleModels={scheduleModels} assignments={assignments} />
          <JadwalWorkspace
            activeContext={activeContext}
            scheduleModels={scheduleModels}
            jamPelajaranList={jamPelajaranList}
            slotTemplatesByModel={slotTemplatesByModel}
            guruList={guruList}
            kelasList={kelasList}
            mapelList={mapelList}
            ruanganList={ruanganList}
            assignments={assignments}
            schoolName={schoolName}
            contextLabel={contextLabel}
          />
        </>
      ) : (
        <JadwalCerdasWorkspace
          activeContext={activeContext}
          scheduleModels={scheduleModels}
          guruList={guruList}
          kelasList={kelasList}
          mapelList={mapelList}
          ruanganList={ruanganList}
          candidateAssignments={candidateAssignments}
          pembagianMengajarList={pembagianMengajarList}
        />
      )}
    </div>
  );
}
