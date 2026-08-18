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

export default function JadwalDragBehavior({ academicContextId, scheduleModels, assignments }: {
  academicContextId: string;
  scheduleModels: ScheduleModel[];
  assignments: ScheduleAssignment[];
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = document.querySelector("main") ?? document.body;
    let observer: MutationObserver | null = null;
    let source: ScheduleAssignment | null = null;
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let moved = false;
    let suppressClick = false;
    let workspace: HTMLElement | null = null;

    const closeMenu = () => { menuRef.current?.remove(); menuRef.current = null; };
    const notify = (value: Notice) => setNotice(value);

    const getWorkspace = () => Array.from(root.querySelectorAll<HTMLElement>("div")).find((el) => el.querySelector(":scope > h1")?.textContent?.trim() === "Jadwal" && el.querySelector("table"));
    const modelId = (ws: HTMLElement) => (ws.querySelector("select") as HTMLSelectElement | null)?.value ?? scheduleModels.find((m) => m.status === "aktif")?.id ?? "";
    const mode = (ws: HTMLElement) => {
      const active = Array.from(ws.querySelectorAll("button")).find((b) => ["kelas", "guru", "ruangan"].includes(b.textContent?.trim().toLowerCase() ?? "") && b.className.includes("bg-brand-600"));
      return (active?.textContent?.trim().toLowerCase() ?? "kelas") as "kelas" | "guru" | "ruangan";
    };
    const entityId = (ws: HTMLElement, view: string) => {
      const ids = new Set(assignments.flatMap((a) => view === "kelas" ? [a.classId] : view === "guru" ? [a.teacherId] : a.roomId ? [a.roomId] : []));
      return Array.from(ws.querySelectorAll("select")).map((s) => (s as HTMLSelectElement).value).find((v) => ids.has(v)) ?? "";
    };
    const getCells = (ws: HTMLElement) => {
      const table = ws.querySelector("table");
      if (!table) return [] as Array<{ td: HTMLTableCellElement; day: HariSekolah; period: number }>;
      const headers = Array.from(table.querySelectorAll("thead th")).slice(1).map((h) => h.textContent?.trim().toLowerCase() ?? "");
      const days = headers.map((h) => DAYS.find((d) => h.includes(d)) ?? null);
      const result: Array<{ td: HTMLTableCellElement; day: HariSekolah; period: number }> = [];
      table.querySelectorAll("tbody tr").forEach((row) => {
        const period = Number(row.querySelector("td")?.textContent?.match(/Jam ke-(\d+)/i)?.[1]);
        if (!Number.isFinite(period)) return;
        Array.from(row.querySelectorAll(":scope > td")).slice(1).forEach((node, i) => {
          const day = days[i]; if (!day) return;
          const td = node as HTMLTableCellElement;
          td.dataset.sakalaScheduleCell = "true";
          td.dataset.sakalaScheduleCellDay = day;
          td.dataset.sakalaScheduleCellPeriod = String(period);
          td.style.position = "relative";
          result.push({ td, day, period });
        });
      });
      return result;
    };
    const getScoped = (ws: HTMLElement) => {
      const view = mode(ws); const eid = entityId(ws, view); const mid = modelId(ws);
      return assignments.filter((a) => a.status === "committed" && a.scheduleModelId === mid && (view === "kelas" ? a.classId === eid : view === "guru" ? a.teacherId === eid : a.roomId === eid));
    };
    const clearTarget = () => root.querySelectorAll<HTMLElement>("[data-sakala-drop-target]").forEach((el) => { el.classList.remove("ring-2", "ring-brand-600", "bg-brand-50"); delete el.dataset.sakalaDropTarget; });
    const targetAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-sakala-schedule-cell]");

    const pointerCancel = () => {
      pointerId = null; source = null; moved = false; suppressClick = false;
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerCancel);
      document.body.classList.remove("sakala-dragging"); clearTarget();
    };
    const pointerMove = (event: PointerEvent) => {
      if (pointerId !== event.pointerId || !source) return;
      event.preventDefault();
      if (!moved && Math.hypot(event.clientX - startX, event.clientY - startY) < 8) return;
      moved = true;
      root.querySelectorAll<HTMLElement>("[data-sakala-drop-target]").forEach((el) => el.classList.remove("ring-2", "ring-brand-600", "bg-brand-50"));
      const td = targetAt(event.clientX, event.clientY); if (!td) return;
      td.dataset.sakalaDropTarget = "true"; td.classList.add("ring-2", "ring-brand-600", "bg-brand-50");
    };
    const pointerUp = async (event: PointerEvent) => {
      if (pointerId !== event.pointerId || !source) return;
      event.preventDefault();
      const current = source; const wasMoved = moved; const td = targetAt(event.clientX, event.clientY);
      pointerId = null; source = null;
      window.removeEventListener("pointermove", pointerMove); window.removeEventListener("pointerup", pointerUp); window.removeEventListener("pointercancel", pointerCancel);
      document.body.classList.remove("sakala-dragging");
      if (!wasMoved || !td) { clearTarget(); return; }
      suppressClick = true;
      window.setTimeout(() => { suppressClick = false; }, 100);
      const day = td.dataset.sakalaScheduleCellDay as HariSekolah | undefined; const period = Number(td.dataset.sakalaScheduleCellPeriod);
      if (!day || !Number.isFinite(period)) { clearTarget(); return; }
      const ws = workspace ?? getWorkspace(); if (!ws) { clearTarget(); return; }
      const model = scheduleModels.find((m) => m.id === modelId(ws)); if (!model) { clearTarget(); return; }
      const span = current.periodEnd - current.periodStart; const targetEnd = period + span;
      const targetCells = getCells(ws).filter((c) => c.day === day && c.period >= period && c.period <= targetEnd);
      if (targetCells.length !== span + 1) { notify({ tone: "danger", text: "Jadwal tidak dapat dipindahkan: rentang JP melewati slot yang tersedia." }); clearTarget(); return; }
      setBusy(true); notify({ tone: "info", text: `Memvalidasi ${current.day} Jam ${current.periodStart} → ${day} Jam ${period}…` });
      const draft: ScheduleAssignmentDraft = { academicContextId, scheduleModelId: model.id, classId: current.classId, subjectId: current.subjectId, teacherId: current.teacherId, roomId: current.roomId ?? null, day, periodStart: period, periodEnd: targetEnd, activityType: current.activityType, status: "draft", source: current.source, versionId: current.versionId ?? null };
      const validation = await validateAssignmentAction(draft, current.id);
      if (!validation.ok) { setBusy(false); notify({ tone: "danger", text: `Jadwal tidak dapat dipindahkan — ${validation.error}` }); clearTarget(); return; }
      const blocking = validation.data.conflicts.filter((c) => c.blocking);
      if (blocking.length) { setBusy(false); notify({ tone: "danger", text: `Jadwal tidak dapat dipindahkan — ${blocking[0].message}` }); clearTarget(); return; }
      const result = await moveAssignmentAction(current.id, { day, periodStart: period, periodEnd: targetEnd, roomId: current.roomId ?? null, classId: current.classId, subjectId: current.subjectId, teacherId: current.teacherId }, "Pindah melalui Drag & Drop");
      setBusy(false); clearTarget();
      if (!result.ok) { notify({ tone: "danger", text: `Jadwal tidak dapat dipindahkan — ${result.error}` }); return; }
      notify({ tone: "success", text: `✓ Jadwal berhasil dipindahkan — ${current.day} Jam ${current.periodStart} → ${day} Jam ${period}.` }); router.refresh();
    };

    const clickModalAction = (label: string) => {
      const target = Array.from(document.querySelectorAll("button")).find((b) => (b as HTMLElement).offsetParent !== null && b.textContent?.trim().toLowerCase().includes(label.toLowerCase())) as HTMLButtonElement | undefined;
      target?.click();
    };
    const openMenu = (card: HTMLElement) => {
      closeMenu(); const rect = card.getBoundingClientRect(); const menu = document.createElement("div"); menuRef.current = menu;
      menu.className = "fixed z-[200] min-w-48 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-2xl";
      menu.style.left = `${Math.max(8, Math.min(rect.right - 192, window.innerWidth - 204))}px`; menu.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 250)}px`;
      menu.innerHTML = `<div class="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Aksi Jadwal</div>`;
      const actions = [["Lihat Detail", "eye", ""], ["Edit", "edit", ""], ["Pindahkan", "move", ""], ["Duplikat", "copy", ""], ["Arsipkan / Hapus", "delete", "danger"]];
      actions.forEach(([label, icon, tone]) => {
        const item = document.createElement("button"); item.type = "button"; item.className = `flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] ${tone === "danger" ? "text-rose-700 hover:bg-rose-50" : "text-ink-700 hover:bg-surface-muted"}`;
        item.innerHTML = `<span class="text-ink-400">${icon === "eye" ? "◉" : icon === "edit" ? "✎" : icon === "move" ? "↔" : icon === "copy" ? "⧉" : "⌫"}</span>${label}`;
        item.onclick = (e) => { e.stopPropagation(); closeMenu(); card.click(); if (icon !== "eye") window.setTimeout(() => clickModalAction(icon === "copy" ? "Duplikat" : icon === "delete" ? "Hapus" : "Edit / Pindahkan"), 100); };
        menu.appendChild(item);
      });
      document.body.appendChild(menu);
      const outside = (e: Event) => { if (!menu.contains(e.target as Node)) { closeMenu(); document.removeEventListener("pointerdown", outside); } };
      window.setTimeout(() => document.addEventListener("pointerdown", outside), 0);
    };

    const bind = () => {
      const ws = getWorkspace(); if (!ws) return; workspace = ws;
      const byCell = new Map<string, ScheduleAssignment>(); getScoped(ws).forEach((a) => { for (let p = a.periodStart; p <= a.periodEnd; p++) byCell.set(`${a.day}:${p}`, a); });
      getCells(ws).forEach(({ td, day, period }) => {
        const assignment = byCell.get(`${day}:${period}`); const card = td.querySelector("button") as HTMLButtonElement | null; if (!card) return;
        const isStart = !!assignment && assignment.day === day && assignment.periodStart === period; if (!isStart || !assignment) return;
        card.dataset.sakalaAssignmentId = assignment.id; card.classList.add("touch-none", "select-none"); card.style.cursor = "grab"; card.title = "Tekan dan geser untuk memindahkan jadwal";
        const oldPointer = (card as HTMLElement & { __sakalaPointer?: EventListener }).__sakalaPointer; if (oldPointer) card.removeEventListener("pointerdown", oldPointer);
        const handler = ((event: PointerEvent) => {
          if (event.button !== 0 || busy) return; closeMenu(); pointerId = event.pointerId; startX = event.clientX; startY = event.clientY; moved = false; suppressClick = false; source = assignment; document.body.classList.add("sakala-dragging"); notify({ tone: "info", text: "Tekan dan geser ke slot tujuan." });
          window.addEventListener("pointermove", pointerMove, { passive: false }); window.addEventListener("pointerup", pointerUp, { passive: false }); window.addEventListener("pointercancel", pointerCancel, { passive: false });
        }) as EventListener;
        (card as HTMLElement & { __sakalaPointer?: EventListener }).__sakalaPointer = handler; card.addEventListener("pointerdown", handler, { passive: false });
        const oldClick = (card as HTMLElement & { __sakalaClick?: EventListener }).__sakalaClick; if (oldClick) card.removeEventListener("click", oldClick, true);
        const clickHandler = ((event: MouseEvent) => { if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; } }) as EventListener;
        (card as HTMLElement & { __sakalaClick?: EventListener }).__sakalaClick = clickHandler; card.addEventListener("click", clickHandler, true);
        td.querySelector("[data-sakala-action-menu]")?.remove();
        const action = document.createElement("button"); action.type = "button"; action.dataset.sakalaActionMenu = "true"; action.setAttribute("aria-label", "Menu aksi jadwal"); action.className = "absolute right-1.5 top-1.5 z-20 rounded-lg bg-white/85 px-1.5 py-0.5 text-base font-semibold leading-none text-ink-500 shadow-sm backdrop-blur hover:bg-white hover:text-ink-900"; action.textContent = "⋮";
        action.addEventListener("pointerdown", (e) => e.stopPropagation()); action.addEventListener("click", (e) => { e.stopPropagation(); openMenu(card); }); td.appendChild(action);
      });
    };

    observer = new MutationObserver(bind); observer.observe(root, { childList: true, subtree: true }); bind();
    return () => { observer?.disconnect(); closeMenu(); window.removeEventListener("pointermove", pointerMove); window.removeEventListener("pointerup", pointerUp); window.removeEventListener("pointercancel", pointerCancel); document.body.classList.remove("sakala-dragging"); };
  }, [academicContextId, assignments, scheduleModels, router]);

  if (!notice && !busy) return null;
  return <div className="fixed inset-x-0 top-4 z-[120] mx-auto flex max-w-3xl justify-center px-4" aria-live="polite"><div className={`flex w-full items-start gap-2 rounded-2xl border px-4 py-3 text-[12.5px] shadow-lg backdrop-blur ${notice?.tone === "danger" ? "border-rose-200 bg-rose-50/95 text-rose-800" : notice?.tone === "success" ? "border-emerald-200 bg-emerald-50/95 text-emerald-800" : "border-brand-600/20 bg-surface/95 text-ink-700"}`}>{busy ? <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" /> : notice?.tone === "danger" ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : notice?.tone === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <GripVertical size={16} className="mt-0.5 shrink-0" />}<span>{notice?.text}</span></div></div>;
}
