"use client";

import { useMemo, useState } from "react";
import { BookOpen, CalendarDays, User, Users } from "lucide-react";
import type { ScheduleAssignment } from "@/lib/domain/scheduleAssignment";
import type { Guru } from "@/lib/domain/guru";
import type { Kelas } from "@/lib/domain/kelas";
import type { MataPelajaran } from "@/lib/domain/mata-pelajaran";
import type { HariSekolah, JamPelajaran } from "@/lib/domain/jamPelajaran";
import { formatHari, URUTAN_HARI } from "@/lib/domain/jamPelajaran";
import ReportExportBar from "@/components/ui/ReportExportBar";

export default function ScheduleExportPanel({
  assignments, guruList, kelasList, mapelList, jamPelajaranList, activeDays, contextLabel, schoolName,
}: {
  assignments: ScheduleAssignment[];
  guruList: Guru[];
  kelasList: Kelas[];
  mapelList: MataPelajaran[];
  jamPelajaranList: JamPelajaran[];
  activeDays: HariSekolah[];
  contextLabel: string;
  schoolName?: string;
}) {
  const [mode, setMode] = useState<"mingguan" | "harian" | "kelas" | "guru" | "mapel">("mingguan");
  const [day, setDay] = useState<HariSekolah>(activeDays[0] ?? "senin");
  const [entityId, setEntityId] = useState("");
  const guruMap = useMemo(() => new Map(guruList.map((g) => [g.id, g.namaGuru])), [guruList]);
  const kelasMap = useMemo(() => new Map(kelasList.map((k) => [k.id, `${k.tingkat} ${k.namaRombel}`])), [kelasList]);
  const mapelMap = useMemo(() => new Map(mapelList.map((m) => [m.id, m.nama])), [mapelList]);
  const jamMap = useMemo(() => new Map(jamPelajaranList.map((j) => [j.nomorUrut, `${j.waktuMulai}–${j.waktuSelesai}`])), [jamPelajaranList]);

  const entityOptions = mode === "kelas" ? kelasList.map((k) => ({ id: k.id, label: `${k.tingkat} ${k.namaRombel}` })) : mode === "mapel" ? mapelList.map((m) => ({ id: m.id, label: m.nama })) : guruList.map((g) => ({ id: g.id, label: g.namaGuru }));
  const activeEntity = entityOptions.some((x) => x.id === entityId) ? entityId : entityOptions[0]?.id ?? "";
  const scoped = assignments.filter((a) => {
    if (a.status !== "committed") return false;
    if (mode === "harian") return a.day === day;
    if (mode === "kelas") return a.classId === activeEntity;
    if (mode === "guru") return a.teacherId === activeEntity;
    if (mode === "mapel") return a.subjectId === activeEntity;
    return activeDays.includes(a.day);
  });

  const rows = scoped.map((a) => ({
    hari: formatHari(a.day),
    jam: `Ke-${a.periodStart}${a.periodEnd !== a.periodStart ? `–${a.periodEnd}` : ""}`,
    waktu: jamMap.get(a.periodStart) ?? "",
    kelas: kelasMap.get(a.classId) ?? "-",
    mataPelajaran: mapelMap.get(a.subjectId) ?? "-",
    guru: guruMap.get(a.teacherId) ?? "-",
    ruangan: a.roomId ?? "-",
    status: a.status,
  }));

  const columns = [
    { key: "hari", label: "Hari" }, { key: "jam", label: "Jam" }, { key: "waktu", label: "Waktu" },
    { key: "kelas", label: "Kelas" }, { key: "mataPelajaran", label: "Mata Pelajaran" },
    { key: "guru", label: "Guru" }, { key: "ruangan", label: "Ruangan" }, { key: "status", label: "Status" },
  ];
  const label = mode === "kelas" ? `Per Kelas — ${kelasMap.get(activeEntity) ?? "Belum dipilih"}` : mode === "guru" ? `Per Guru — ${guruMap.get(activeEntity) ?? "Belum dipilih"}` : mode === "mapel" ? `Per Mata Pelajaran — ${mapelMap.get(activeEntity) ?? "Belum dipilih"}` : mode === "harian" ? `Harian — ${formatHari(day)}` : "Mingguan";
  const filterLabel = `Mode: ${label}${mode === "harian" ? ` · Hari: ${formatHari(day)}` : ""}${mode === "kelas" ? ` · Kelas: ${kelasMap.get(activeEntity) ?? "-"}` : ""}${mode === "guru" ? ` · Guru: ${guruMap.get(activeEntity) ?? "-"}` : ""}${mode === "mapel" ? ` · Mata Pelajaran: ${mapelMap.get(activeEntity) ?? "-"}` : ""}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-ink-700">Jadwal</div>
        <div className="flex overflow-hidden rounded-xl border border-border">
          {(["mingguan", "harian", "kelas", "guru", "mapel"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`h-10 px-3 text-[12px] font-medium capitalize ${mode === m ? "bg-brand-600 text-white" : "bg-surface text-ink-700 hover:bg-surface-muted"}`}>
              {m === "kelas" ? <><Users size={13} className="mr-1 inline" />Kelas</> : m === "guru" ? <><User size={13} className="mr-1 inline" />Guru</> : m === "mapel" ? <><BookOpen size={13} className="mr-1 inline" />Mapel</> : <><CalendarDays size={13} className="mr-1 inline" />{m}</>}
            </button>
          ))}
        </div>
        <ReportExportBar
          title={`Jadwal ${label}`}
          context={`${contextLabel} · ${label}`}
          schoolName={schoolName}
          periodLabel={contextLabel}
          filterLabel={filterLabel}
          columns={columns}
          rows={rows}
          landscape
          compact
        />
        {mode === "harian" && (
          <select aria-label="Pilih hari" value={day} onChange={(e) => setDay(e.target.value as HariSekolah)} className="h-10 rounded-xl border border-border bg-surface px-3 text-[12.5px]">
            {URUTAN_HARI.filter((d) => activeDays.includes(d)).map((d) => <option key={d} value={d}>{formatHari(d)}</option>)}
          </select>
        )}
        {(mode === "kelas" || mode === "guru" || mode === "mapel") && (
          <select aria-label={mode === "kelas" ? "Pilih kelas" : mode === "guru" ? "Pilih guru" : "Pilih mata pelajaran"} value={activeEntity} onChange={(e) => setEntityId(e.target.value)} className="h-10 min-w-[190px] rounded-xl border border-border bg-surface px-3 text-[12.5px]">
            {entityOptions.length === 0 && <option value="">Belum ada data</option>}
            {entityOptions.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        )}
        <span className="ml-auto text-[11.5px] text-ink-400">{label} · {scoped.length} jadwal · {contextLabel}</span>
      </div>
    </div>
  );
}
