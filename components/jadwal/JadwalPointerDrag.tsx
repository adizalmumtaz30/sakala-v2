"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, GripVertical, Loader2 } from "lucide-react";
import type { ScheduleAssignment, ScheduleAssignmentDraft } from "@/lib/domain/scheduleAssignment";
import type { ScheduleModel } from "@/lib/domain/scheduleModel";
import type { HariSekolah } from "@/lib/domain/jamPelajaran";
import { validateAssignmentAction, moveAssignmentAction } from "@/app/(shell)/jadwal/actions";

const DAYS: HariSekolah[] = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
type Notice = { tone: "success" | "danger" | "info"; text: string } | null;

export default function JadwalPointerDrag({ academicContextId, scheduleModels, assignments }: {
  academicContextId: string;
  scheduleModels: ScheduleModel[];
  assignments: ScheduleAssignment[];
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ assignment: ScheduleAssignment; el: HTMLElement; pointerId: number; x: number; y: number; active: boolean } | null>(null);

  useEffect(() => {
    const root = document.querySelector("main") ?? document.body;
    const getWorkspace = () => Array.from(root.querySelectorAll("div")).find((el) => el.querySelector("h1")?.textContent?.trim() === "Jadwal" && el.querySelector("table")) as HTMLElement | undefined;
    const getCells = (ws: HTMLElement) => {
      const table = ws.querySelector("table");
      if (!table) return [] as { td: HTMLTableCellElement; day: HariSekolah; period: number }[];
      const days = Array.from(table.querySelectorAll("thead th")).slice(1).map((th) => DAYS.find((d) => (th.textContent || "").toLowerCase().includes(d)) ?? null);
      const out: { td: HTMLTableCellElement; day: HariSekolah; period: number }[] = [];
      table.querySelectorAll("tbody tr").forEach((tr) => {
        const m = tr.querySelector("td")?.textContent?.match(/Jam ke-\s*(\d+)/i);
        if (!m) return;
        const period = Number(m[1]);
        Array.from(tr.querySelectorAll(":scope > td")).slice(1).forEach((td, i) => days[i] && out.push({ td: td as HTMLTableCellElement, day: days[i]!, period }));
      });
      return out;
    };
    const getScope = (ws: HTMLElement) => {
      const selects = Array.from(ws.querySelectorAll("select")) as HTMLSelectElement[];
      const modelId = selects[0]?.value ?? scheduleModels.find((m) => m.status === "aktif")?.id ?? "";
      const buttons = Array.from(ws.querySelectorAll("button"));
      const view = (["kelas", "guru", "ruangan"] as const).find((v) => buttons.some((b) => b.textContent?.trim().toLowerCase() === v && b.className.includes("bg-brand-600"))) ?? "kelas";
      const entityId = selects[1]?.value ?? "";
      return assignments.filter((a) => a.status === "committed" && a.scheduleModelId === modelId && (view === "kelas" ? a.classId === entityId : view === "guru" ? a.teacherId === entityId : a.roomId === entityId));
    };
    const bind = () => {
      const ws = getWorkspace();
      if (!ws) return;
      const visible = getScope(ws);
      const byCell = new Map(visible.map((a) => [`${a.day}:${a.periodStart}`, a]));
      getCells(ws).forEach(({ td, day, period }) => {
        const button = td.querySelector("button") as HTMLElement | null;
        if (!button) return;
        const a = byCell.get(`${day}:${period}`);
        if (!a) { delete button.dataset.sakalaAssignmentId; return; }
        button.dataset.sakalaAssignmentId = a.id;
        button.style.touchAction = "none";
        button.style.cursor = "grab";
        button.title = "Tarik untuk memindahkan jadwal";
        if (!button.querySelector("[data-sakala-grip]")) {
          const grip = document.createElement("span");
          grip.dataset.sakalaGrip = "true";
          grip.className = "pointer-events-none absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100";
          grip.textContent = "⋮⋮";
          button.classList.add("group", "relative");
          button.appendChild(grip);
        }
      });
    };
    const clearTarget = () => root.querySelectorAll<HTMLElement>("[data-sakala-drop-active]").forEach((el) => { el.classList.remove("ring-2", "ring-brand-600", "bg-brand-50"); delete el.dataset.sakalaDropActive; });
    const targetAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const td = el?.closest("td") as HTMLTableCellElement | null;
      if (!td) return null;
      return getCells(getWorkspace()!).find((c) => c.td === td) ?? null;
    };
    const onDown = (e: PointerEvent) => {
      if (busy || e.button !== 0) return;
      const el = (e.target as HTMLElement).closest("[data-sakala-assignment-id]") as HTMLElement | null;
      if (!el) return;
      const a = assignments.find((x) => x.id === el.dataset.sakalaAssignmentId && x.status === "committed");
      if (!a) return;
      dragRef.current = { assignment: a, el, pointerId: e.pointerId, x: e.clientX, y: e.clientY, active: false };
      el.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId || busy) return;
      if (!d.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return;
      if (!d.active) {
        d.active = true;
        d.el.classList.add("opacity-40", "scale-[0.98]");
        setNotice({ tone: "info", text: "Tarik jadwal ke slot kosong untuk memindahkannya." });
      }
      clearTarget();
      const t = targetAt(e.clientX, e.clientY);
      const occupied = t?.td.querySelector("[data-sakala-assignment-id]");
      if (t && !occupied && !(t.day === d.assignment.day && t.period === d.assignment.periodStart)) {
        t.td.dataset.sakalaDropActive = "true";
        t.td.classList.add("ring-2", "ring-brand-600", "bg-brand-50");
      }
      e.preventDefault();
    };
    const onUp = async (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      dragRef.current = null;
      const wasDrag = d.active;
      d.el.classList.remove("opacity-40", "scale-[0.98]");
      clearTarget();
      if (!wasDrag) return;
      const ws = getWorkspace();
      const t = ws ? targetAt(e.clientX, e.clientY) : null;
      if (!t || t.td.querySelector("[data-sakala-assignment-id]")) { setNotice({ tone: "danger", text: "Slot tujuan tidak tersedia. Jadwal tetap di posisi semula." }); return; }
      const span = d.assignment.periodEnd - d.assignment.periodStart;
      const end = t.period + span;
      const all = getCells(ws!);
      const needed = all.filter((c) => c.day === t.day && c.period >= t.period && c.period <= end);
      if (needed.length !== span + 1 || needed.some((c) => c.td.querySelector("[data-sakala-assignment-id]"))) { setNotice({ tone: "danger", text: "Jadwal tidak dapat dipindahkan: seluruh rentang JP tujuan harus kosong." }); return; }
      const modelId = (ws?.querySelector("select") as HTMLSelectElement | null)?.value ?? "";
      const model = scheduleModels.find((m) => m.id === modelId);
      if (!model) return;
      setBusy(true);
      setNotice({ tone: "info", text: `Memvalidasi perpindahan ke ${t.day}, Jam ${t.period}…` });
      const draft: ScheduleAssignmentDraft = { academicContextId, scheduleModelId: model.id, classId: d.assignment.classId, subjectId: d.assignment.subjectId, teacherId: d.assignment.teacherId, roomId: d.assignment.roomId ?? null, day: t.day, periodStart: t.period, periodEnd: end, activityType: d.assignment.activityType, status: "draft", source: d.assignment.source, versionId: d.assignment.versionId ?? null };
      const validation = await validateAssignmentAction(draft, d.assignment.id);
      if (!validation.ok) { setBusy(false); setNotice({ tone: "danger", text: validation.error }); return; }
      const blocking = validation.data.conflicts.filter((c) => c.blocking);
      if (blocking.length) { setBusy(false); setNotice({ tone: "danger", text: `Jadwal tidak dapat dipindahkan — ${blocking[0].message}` }); return; }
      setNotice({ tone: "success", text: `✓ Slot tersedia — ${d.assignment.day} Jam ${d.assignment.periodStart} → ${t.day} Jam ${t.period}. Menyimpan…` });
      const result = await moveAssignmentAction(d.assignment.id, { day: t.day, periodStart: t.period, periodEnd: end, roomId: d.assignment.roomId ?? null, classId: d.assignment.classId, subjectId: d.assignment.subjectId, teacherId: d.assignment.teacherId }, "Pindah melalui Drag & Drop");
      setBusy(false);
      if (!result.ok) { setNotice({ tone: "danger", text: `Jadwal tidak dapat dipindahkan — ${result.error}` }); return; }
      setNotice({ tone: "success", text: `✓ Jadwal berhasil dipindahkan — ${d.assignment.day} Jam ${d.assignment.periodStart} → ${t.day} Jam ${t.period}.` });
      router.refresh();
    };
    const observer = new MutationObserver(bind);
    observer.observe(root, { childList: true, subtree: true });
    bind();
    root.addEventListener("pointerdown", onDown, { passive: false });
    root.addEventListener("pointermove", onMove, { passive: false });
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);
    return () => { observer.disconnect(); root.removeEventListener("pointerdown", onDown); root.removeEventListener("pointermove", onMove); root.removeEventListener("pointerup", onUp); root.removeEventListener("pointercancel", onUp); clearTarget(); };
  }, [academicContextId, assignments, scheduleModels, router, busy]);

  if (!notice && !busy) return null;
  return <div className="fixed inset-x-0 top-4 z-[80] mx-auto flex max-w-3xl justify-center px-4" aria-live="polite"><div className={`flex w-full items-start gap-2 rounded-2xl border px-4 py-3 text-[12.5px] shadow-lg backdrop-blur ${notice?.tone === "danger" ? "border-rose-200 bg-rose-50/95 text-rose-800" : notice?.tone === "success" ? "border-emerald-200 bg-emerald-50/95 text-emerald-800" : "border-brand-600/20 bg-surface/95 text-ink-700"}`}>{busy ? <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" /> : notice?.tone === "danger" ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : notice?.tone === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <GripVertical size={16} className="mt-0.5 shrink-0" />}<span>{notice?.text}</span></div></div>;
}
