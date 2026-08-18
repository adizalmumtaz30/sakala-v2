"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ScheduleAssignment } from "@/lib/domain/scheduleAssignment";
import type { ScheduleModel } from "@/lib/domain/scheduleModel";
import type { JamPelajaran, HariSekolah } from "@/lib/domain/jamPelajaran";
import { formatHari, URUTAN_HARI } from "@/lib/domain/jamPelajaran";
import { moveAssignmentAction } from "@/app/(shell)/jadwal/actions";

export default function JadwalDragDrop({
  scheduleModels,
  jamPelajaranList,
  assignments,
  classNames,
  subjectNames,
  teacherNames,
}: {
  scheduleModels: ScheduleModel[];
  jamPelajaranList: JamPelajaran[];
  assignments: ScheduleAssignment[];
  classNames: Record<string, string>;
  subjectNames: Record<string, string>;
  teacherNames: Record<string, string>;
}) {
  const router = useRouter();
  const activeModels = scheduleModels.filter((m) => m.status === "aktif");
  const [modelId, setModelId] = useState(activeModels[0]?.id ?? "");
  const [dragId, setDragId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const model = activeModels.find((m) => m.id === modelId) ?? null;
  const days = model ? URUTAN_HARI.filter((d) => model.hariAktif.includes(d)) : [];
  const committed = useMemo(() => assignments.filter((a) => a.status === "committed" && a.scheduleModelId === modelId), [assignments, modelId]);
  const byCell = useMemo(() => {
    const map = new Map<string, ScheduleAssignment>();
    for (const a of committed) {
      for (let p = a.periodStart; p <= a.periodEnd; p++) map.set(`${a.day}:${p}`, a);
    }
    return map;
  }, [committed]);
  const maxPeriod = Math.max(0, ...days.flatMap((d) => jamPelajaranList.filter((j) => j.hari === d).map((j) => j.nomorUrut)));

  async function drop(day: HariSekolah, period: number) {
    if (!dragId) return;
    const source = committed.find((a) => a.id === dragId);
    if (!source) return;
    if (source.day === day && source.periodStart === period) { setDragId(null); return; }
    const span = source.periodEnd - source.periodStart;
    for (let p = period; p <= period + span; p++) {
      const occupant = byCell.get(`${day}:${p}`);
      if (occupant && occupant.id !== source.id) {
        setNotice("Pindah diblokir: slot tujuan masih terisi.");
        setDragId(null);
        return;
      }
    }
    setBusyId(source.id); setNotice(null);
    const result = await moveAssignmentAction(source.id, {
      day,
      periodStart: period,
      periodEnd: period + span,
      roomId: source.roomId ?? null,
      classId: source.classId,
      subjectId: source.subjectId,
      teacherId: source.teacherId,
    }, "Pindah melalui Drag & Drop");
    setBusyId(null); setDragId(null);
    if (!result.ok) setNotice(result.error);
    else { setNotice("Jadwal berhasil dipindahkan dan dibuatkan Schedule Version baru."); router.refresh(); }
  }

  if (!model) return null;

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-[14px] font-semibold text-ink-900">Drag &amp; Drop Jadwal</h2>
          <p className="text-[11.5px] text-ink-500">Tarik kartu jadwal ke slot kosong. Conflict tetap diblokir server-side.</p>
        </div>
        <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="h-10 rounded-xl border border-border bg-surface px-3 text-[12.5px]">
          {activeModels.map((m) => <option key={m.id} value={m.id}>{m.namaModel}</option>)}
        </select>
      </div>
      {notice && <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs text-ink-700"><CheckCircle2 size={14} />{notice}</div>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <div className="grid min-w-[900px]" style={{ gridTemplateColumns: `110px repeat(${days.length}, minmax(150px, 1fr))` }}>
          <div className="border-b border-r border-border bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-500">Jam</div>
          {days.map((d) => <div key={d} className="border-b border-r border-border bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-500">{formatHari(d)}</div>)}
          {Array.from({ length: maxPeriod }, (_, i) => i + 1).flatMap((period) => [
            <div key={`p-${period}`} className="border-b border-r border-border px-3 py-2 text-xs text-ink-500">Jam ke-{period}</div>,
            ...days.map((day) => {
              const a = byCell.get(`${day}:${period}`);
              const isStart = a?.periodStart === period && a.day === day;
              return <div
                key={`${day}-${period}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                onDrop={(e) => { e.preventDefault(); void drop(day, period); }}
                className={`min-h-[58px] border-b border-r border-border p-1.5 transition ${dragId ? "bg-brand-50/30" : ""}`}
              >
                {a && isStart ? (
                  <div draggable={busyId !== a.id} onDragStart={(e) => { setDragId(a.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", a.id); }} onDragEnd={() => setDragId(null)} className={`flex cursor-grab items-start gap-1 rounded-lg border border-border bg-surface px-2 py-1.5 shadow-sm active:cursor-grabbing ${busyId === a.id ? "opacity-50" : ""}`}>
                    <GripVertical size={14} className="mt-0.5 shrink-0 text-ink-400" />
                    <div className="min-w-0"><div className="truncate text-[11px] font-semibold text-ink-900">{subjectNames[a.subjectId] ?? "Mapel"}</div><div className="truncate text-[10px] text-ink-500">{classNames[a.classId] ?? "Kelas"} · {teacherNames[a.teacherId] ?? "Guru"}</div>{a.periodEnd > a.periodStart && <div className="text-[9.5px] text-brand-700">{a.periodEnd - a.periodStart + 1} JP</div>}</div>
                  </div>
                ) : a ? <div className="h-full rounded-lg bg-surface-muted" /> : <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-ink-300">Drop</div>}
              </div>;
            }),
          ])}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10.5px] text-ink-400"><AlertTriangle size={13} /> Drop hanya ke rentang kosong; server tetap melakukan validasi conflict sebelum commit.</div>
    </section>
  );
}
