"use client";

import Link from "next/link";
import { ArrowRight, Bot, BrainCircuit, CalendarDays, CheckCircle2, Clock3, Sparkles, TriangleAlert } from "lucide-react";
import type { AcademicContext } from "@/lib/domain/academicContext";
import type { ScheduleAssignment } from "@/lib/domain/scheduleAssignment";
import type { ScheduleModel } from "@/lib/domain/scheduleModel";
import type { JamPelajaran, HariSekolah } from "@/lib/domain/jamPelajaran";
import { formatContextLabel } from "@/lib/domain/academicContext";

function Metric({ label, value, hint, tone = "neutral" }: { label: string; value: string | number; hint: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const toneClass = tone === "success" ? "text-emerald-700 bg-emerald-50" : tone === "warning" ? "text-amber-700 bg-amber-50" : tone === "danger" ? "text-rose-700 bg-rose-50" : "text-ink-900 bg-surface-muted";
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3.5 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-medium text-ink-500">{label}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${toneClass}`}>{hint}</span>
      </div>
      <div className="mt-2 text-[23px] font-semibold tracking-tight text-ink-900">{value}</div>
    </div>
  );
}

export default function JadwalOverview({
  activeContext,
  activeModel,
  assignments,
  jamPelajaranList,
}: {
  activeContext: AcademicContext;
  activeModel: ScheduleModel | null;
  assignments: ScheduleAssignment[];
  jamPelajaranList: JamPelajaran[];
}) {
  const committed = assignments.filter((a) => a.status === "committed");
  const candidates = assignments.filter((a) => a.status === "candidate" || a.status === "draft");
  const scheduledJp = committed.reduce((sum, a) => sum + Math.max(1, a.periodEnd - a.periodStart + 1), 0);
  const classCount = new Set(committed.map((a) => a.classId)).size;
  const activeDays = activeModel?.hariAktif ?? [];
  const activeJam = jamPelajaranList.filter((j) => activeDays.includes(j.hari as HariSekolah) && j.jenis === "pembelajaran" && j.status === "aktif");

  const keys = new Map<string, number>();
  const addKey = (key: string) => keys.set(key, (keys.get(key) ?? 0) + 1);
  committed.forEach((a) => {
    for (let p = a.periodStart; p <= a.periodEnd; p++) {
      addKey(`class:${a.day}:${p}:${a.classId}`);
      addKey(`teacher:${a.day}:${p}:${a.teacherId}`);
      if (a.roomId) addKey(`room:${a.day}:${p}:${a.roomId}`);
    }
  });
  const conflictUnits = Array.from(keys.values()).filter((count) => count > 1).length;
  const health = conflictUnits === 0 ? "Aman" : `${conflictUnits} bentrok`;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-soft md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11.5px] font-medium text-ink-400">
            <CalendarDays size={14} />
            <span>{formatContextLabel(activeContext)}</span>
            {activeModel && <span className="rounded-full bg-surface-muted px-2 py-0.5">{activeModel.namaModel}</span>}
          </div>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-ink-900">Jadwal Operasional</h2>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-5 text-ink-500">Satu workspace untuk melihat, memeriksa, memindahkan, dan menyempurnakan jadwal tanpa mengubah jadwal committed secara diam-diam.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/ai" className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-600/20 bg-brand-50 px-3.5 text-[12px] font-semibold text-brand-700 transition hover:bg-brand-100">
            <Bot size={15} /> SAKALA AI
          </Link>
          <Link href="/jadwal-cerdas" className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-3.5 text-[12px] font-semibold text-white transition hover:bg-brand-700">
            <Sparkles size={15} /> Jadwal Cerdas <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Jadwal aktif" value={committed.length} hint={`${classCount} kelas`} />
        <Metric label="JP terjadwal" value={scheduledJp} hint="mingguan" />
        <Metric label="Slot pembelajaran" value={activeJam.length} hint="tersedia" />
        <Metric label="Kondisi" value={health} hint={conflictUnits === 0 ? "✓ aman" : "perlu cek"} tone={conflictUnits === 0 ? "success" : "danger"} />
      </div>

      {candidates.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3.5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Sparkles size={15} /></div>
            <div className="min-w-0"><p className="text-[12px] font-semibold text-amber-900">Ada {candidates.length} kandidat jadwal yang belum diterapkan.</p><p className="mt-0.5 text-[11.5px] leading-5 text-amber-800/80">Kandidat berasal dari proses perencanaan. Periksa dulu sebelum menerapkannya ke jadwal operasional.</p></div>
          </div>
          <Link href="/jadwal-cerdas" className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-surface px-3 text-[11.5px] font-semibold text-amber-900 hover:bg-amber-100">Tinjau kandidat <ArrowRight size={12} /></Link>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/ai" className="group rounded-2xl border border-border bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-600/25 hover:shadow-md">
          <div className="flex items-center gap-2 text-brand-700"><BrainCircuit size={16} /><span className="text-[12px] font-semibold">Temukan masalah</span></div>
          <p className="mt-2 text-[12px] leading-5 text-ink-500">Biarkan SAKALA AI memeriksa kelas, JP, slot kosong, dan kondisi jadwal.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700">Periksa dengan AI <ArrowRight size={12} /></span>
        </Link>
        <Link href="/jadwal-cerdas" className="group rounded-2xl border border-border bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-600/25 hover:shadow-md">
          <div className="flex items-center gap-2 text-brand-700"><Sparkles size={16} /><span className="text-[12px] font-semibold">Cari solusi</span></div>
          <p className="mt-2 text-[12px] leading-5 text-ink-500">Gunakan kandidat jadwal untuk mengisi kebutuhan tanpa langsung mengubah jadwal committed.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700">Buka Jadwal Cerdas <ArrowRight size={12} /></span>
        </Link>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
          <div className="flex items-center gap-2 text-ink-800"><Clock3 size={16} /><span className="text-[12px] font-semibold">Alur aman</span></div>
          <p className="mt-2 text-[12px] leading-5 text-ink-500">Perubahan diperiksa dulu. Konflik blocking menghentikan commit. Jadwal lama tidak diubah diam-diam.</p>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700"><CheckCircle2 size={13} /> Review → Validasi → Terapkan</div>
        </div>
      </div>

      {conflictUnits > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-800">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <div><span className="font-semibold">Ada bentrok yang perlu diperiksa.</span> Gunakan tampilan Guru/Kelas/Ruangan untuk menemukan sumbernya sebelum commit perubahan berikutnya.</div>
        </div>
      )}
    </section>
  );
}
