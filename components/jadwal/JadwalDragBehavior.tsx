"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, GripVertical, Loader2, MoreVertical, Eye, Pencil, Copy, Trash2 } from "lucide-react";
import type { ScheduleAssignment, ScheduleAssignmentDraft } from "@/lib/domain/scheduleAssignment";
import type { ScheduleModel } from "@/lib/domain/scheduleModel";
import type { HariSekolah } from "@/lib/domain/jamPelajaran";
import { validateAssignmentAction, moveAssignmentAction } from "@/app/(shell)/jadwal/actions";

const DAYS: HariSekolah[] = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
type Notice = { tone: "success" | "danger" | "info"; text: string } | null;

export default function JadwalDragBehavior({
  academicContextId,
  scheduleModels,
  assignments,
}: {
  academicContextId: string;
  scheduleModels: ScheduleModel[];
  assignments: ScheduleAssignment[];
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = document.querySelector("main") ?? document.body;
    let observer: MutationObserver | null = null;
    let dragSource: ScheduleAssignment | null = null;
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let moved = false;
    let activeWorkspace: HTMLElement | null = null;
    let activeCellKey: string | null = null;

    const closeMenu = () => {
      menuRef.current?.remove();
      menuRef.current = null;
    };

    const notify = (value: Notice) => setNotice(value);

    const workspace = () => Array.from(root.querySelectorAll<HTMLElement>("div")).find((el) => el.querySelector(":scope > h1")?.textContent?.trim() === "Jadwal" && el.querySelector("table"));

    const selectedModelId = (ws: HTMLElement) => (ws.querySelector("select") as HTMLSelectElement | null)?.value ?? scheduleModels.find((m) => m.status === "aktif")?.id ?? "";

    const viewBy = (ws: HTMLElement) => {
      const active = Array.from(ws.querySelectorAll("button")).find((b) => ["kelas", "guru", "ruangan"].includes(b.textContent?.trim().toLowerCase() ?? "") && b.className.includes("bg-brand-600"));
      return (active?.textContent?.trim().toLowerCase() ?? "kelas") as "kelas" | "guru" | "ruangan";
    };

    const entityId = (ws: HTMLElement, mode: string) => {
      const ids = new Set(assignments.flatMap((a) => mode === "kelas" ? [a.classId] : mode === "guru" ? [a.teacherId] : a.roomId ? [a.roomId] : []));
      return Array.from(ws.querySelectorAll("select")).map((s) => (s as HTMLSelectElement).value).find((v) => ids.has(v)) ?? "";
    };

    const cells = (ws: HTMLElement) => {
      const table = ws.querySelector("table");
      if (!table) return [] as Array<{ td: HTMLTableCellElement; day: HariSekolah; period: number }>;
      const headers = Array.from(table.querySelectorAll("thead th")).slice(1).map((h) => h.textContent?.trim().toLowerCase() ?? "");
      const days = headers.map((h) => DAYS.find((d) => h.includes(d)) ?? null);
      const result: Array<{ td: HTMLTableCellElement; day: HariSekolah; period: number }> = [];
      table.querySelectorAll("tbody tr").forEach((row) => {
        const period = Number(row.querySelector("td")?.textContent?.match(/Jam ke-(\d+)/i)?.[1]);
        if (!Number.isFinite(period)) return;
        Array.from(row.querySelectorAll(":scope > td")).slice(1).forEach((td, i) => {
          const day = days[i];
          if (!day) return;
          const cell = td as HTMLTableCellElement;
          cell.dataset.sakalaScheduleCell = "true";
          cell.dataset.sakalaScheduleCellDay = day;
          cell.dataset.sakalaScheduleCellPeriod = String(period);
          cell.style.position = "relative";
          result.push({ td: cell, day, period });
        });
      });
      return result;
    };

    const scoped = (ws: HTMLElement) => {
      const modelId = selectedModelId(ws);
      const mode = viewBy(ws);
      const eid = entityId(ws, mode);
      return assignments.filter((a) => a.status === "committed" && a.scheduleModelId === modelId && (mode === "kelas" ? a.classId === eid : mode === "guru" ? a.teacherId === eid : a.roomId === eid));
    };

    const clearTarget = () => {
      root.querySelectorAll<HTMLElement>("[data-sakala-drop-target]").forEach((el) => {
        el.classList.remove("ring-2", "ring-brand-600", "bg-brand-50", "ring-rose-400", "bg-rose-50");
        delete el.dataset.sakalaDropTarget;
      });
      activeCellKey = null;
      setDragKey(null);
    };

    const targetFromPoint = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-sakala-schedule-cell]");

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId !== event.pointerId || !dragSource) return;
      event.preventDefault();
      if (!moved && Math.hypot(event.clientX - startX, event.clientY - startY) < 8) return;
      moved = true;
      const td = targetFromPoint(event.clientX, event.clientY);
      root.querySelectorAll<HTMLElement>("[data-sakala-drop-target]").forEach((el) => el.classList.remove("ring-2", "ring-brand-600", "bg-brand-50"));
      if (!td) return;
      const key = `${td.dataset.sakalaScheduleCellDay}:${td.dataset.sakalaScheduleCellPeriod}`;
      activeCellKey = key;
      td.dataset.sakalaDropTarget = "true";
      td.classList.add("ring-2", "ring-brand-600", "bg-brand-50");
      setDragKey(key);
    };

    const onPointerUp = async (event: PointerEvent) => {
      if (pointerId !== event.pointerId || !dragSource) return;
      event.preventDefault();
      const source = dragSource;
      const wasMoved = moved;
      const td = targetFromPoint(event.clientX, event.clientY);
      pointerId = null;
      dragSource = null;
      moved = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      document.body.classList.remove("sakala-dragging");
      if (!wasMoved || !td) {
        clearTarget();
        return;
      }
      const day = td.dataset.sakalaScheduleCellDay as HariSekolah | undefined;
      const period = Number(td.dataset.sakalaScheduleCellPeriod);
      if (!day || !Number.isFinite(period)) {
        clearTarget();
        return;
      }
      const ws = activeWorkspace ?? workspace();
      const modelId = ws ? selectedModelId(ws) : source.scheduleModelId;
      const model = scheduleModels.find((m) => m.id === modelId);
      if (!model) return clearTarget();
      const span = source.periodEnd - source.periodStart;
      const targetEnd = period + span;
      const availableCells = cells(ws ?? root).filter((c) => c.day === day && c.period >= period && c.period <= targetEnd);
      if (availableCells.length !== span + 1) {
        notify({ tone: "danger", text: "Jadwal tidak dapat dipindahkan: rentang JP melewati slot yang tersedia." });
        clearTarget();
        return;
      }
      setBusy(true);
      notify({ tone: "info", text: `Memvalidasi ${source.day} Jam ${source.periodStart} → ${day} Jam ${period}…` });
      const draft: ScheduleAssignmentDraft = {
        academicContextId,
        scheduleModelId: model.id,
        classId: source.classId,
        subjectId: source.subjectId,
        teacherId: source.teacherId,
        roomId: source.roomId ?? null,
        day,
        periodStart: period,
        periodEnd: targetEnd,
        activityType: source.activityType,
        status: "draft",
        source: source.source,
        versionId: source.versionId ?? null,
      };
      const validation = await validateAssignmentAction(draft, source.id);
      if (!validation.ok) {
        setBusy(false);
        notify({ tone: "danger", text: `Jadwal tidak dapat dipindahkan — ${validation.error}` });
        clearTarget();
        return;
      }
      const blocking = validation.data.conflicts.filter((c) => c.blocking);
      if (blocking.length) {
        setBusy(false);
        notify({ tone: "danger", text: `Jadwal tidak dapat dipindahkan — ${blocking[0].message}` });
        clearTarget();
        return;
      }
      const result = await moveAssignmentAction(source.id, { day, periodStart: period, periodEnd: targetEnd, roomId: source.roomId ?? null, classId: source.classId, subjectId: source.subjectId, teacherId: source.teacherId }, "Pindah melalui Drag & Drop");
      setBusy(false);
      clearTarget();
      if (!result.ok) {
        notify({ tone: "danger", text: `Jadwal tidak dapat dipindahkan — ${result.error}` });
        return;
      }
      notify({ tone: "success", text: `✓ Jadwal berhasil dipindahkan — ${source.day} Jam ${source.periodStart} → ${day} Jam ${period}.` });
      router.refresh();
    };

    const onPointerCancel = () => {
      pointerId = null;
      dragSource = null;
      moved = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      document.body.classList.remove("sakala-dragging");
      clearTarget();
    };

    const clickModalAction = (label: string) => {
      const buttons = Array.from(document.querySelectorAll("button")) as HTMLButtonElement[];
      const target = buttons.find((b) => b.offsetParent !== null && b.textContent?.trim().toLowerCase().includes(label.toLowerCase()));
      target?.click();
    };

    const openActionMenu = (card: HTMLElement, assignment: ScheduleAssignment) => {
      closeMenu();
      const rect = card.getBoundingClientRect();
      const menu = document.createElement("div");
      menuRef.current = menu;
      menu.className = "fixed z-[100] min-w-48 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-2xl";
      menu.style.left = `${Math.min(rect.right - 192, window.innerWidth - 204)}px`;
      menu.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 250)}px`;
      menu.innerHTML = `<div class=\"px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400\">Aksi Jadwal</div>`;
      const actions = [
        ["Lihat Detail", "eye", ""],
        ["Edit", "edit", ""],
        ["Pindahkan", "move", ""],
        ["Duplikat", "copy", ""],
        ["Arsipkan / Hapus", "delete", "danger"],
      ];
      for (const [label, action, tone] of actions) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] ${tone === "danger" ? "text-rose-700 hover:bg-rose-50" : "text-ink-700 hover:bg-surface-muted"}`;
        item.innerHTML = `<span class=\"text-ink-400\">${action === "eye" ? "◉" : action === "edit" ? "✎" : action === "move" ? "↔" : action === "copy" ? "⧉" : "⌫"}</span>${label}`;
        item.addEventListener("click", (event) => {
          event.stopPropagation();
          closeMenu();
          card.click();
          window.setTimeout(() => {
            if (action === "eye") return;
            if (action === "edit" || action === "move") clickModalAction("Edit / Pindahkan");
            else if (action === "copy") clickModalAction("Duplikat");
            else clickModalAction("Hapus");
          }, 80);
        });
        menu.appendChild(item);
      }
      document.body.appendChild(menu);
      const closeOutside = (event: MouseEvent | TouchEvent) => {
        if (!menu.contains(event.target as Node)) {
          closeMenu();
          document.removeEventListener("mousedown", closeOutside);
          document.removeEventListener("touchstart", closeOutside);
        }
      };
      window.setTimeout(() => {
        document.addEventListener("mousedown", closeOutside);
        document.addEventListener("touchstart", closeOutside);
      }, 0);
    };

    const bind = () => {
      const ws = workspace();
      if (!ws) return;
      activeWorkspace = ws;
      const modelId = selectedModelId(ws);
      const current = scoped(ws);
      const byCell = new Map<string, ScheduleAssignment>();
      current.forEach((a) => {
        for (let p = a.periodStart; p <= a.periodEnd; p++) byCell.set(`${a.day}:${p}`, a);
      });
      const gridCells = cells(ws);
      gridCells.forEach(({ td, day, period }) => {
        const assignment = byCell.get(`${day}:${period}`);
        const card = td.querySelector("button") as HTMLButtonElement | null;
        if (!card) return;
        card.classList.add("touch-none", "select-none");
        const isStart = !!assignment && assignment.day === day && assignment.periodStart === period;
        if (!isStart || !assignment) return;
        card.dataset.sakalaAssignmentId = assignment.id;
        card.title = "Tekan dan geser untuk memindahkan jadwal";
        card.style.cursor = "grab";
        const oldPointer = (card as HTMLElement & { __sakalaPointer?: EventListener }).__sakalaPointer;
        if (oldPointer) card.removeEventListener("pointerdown", oldPointer);
        const pointer = ((event: PointerEvent) => {
          if (event.button !== 0 || busy) return;
          closeMenu();
          pointerId = event.pointerId;
          startX = event.clientX;
          startY = event.clientY;
          moved = false;
          dragSource = assignment;
          activeWorkspace = ws;
          setDragKey(`${assignment.day}:${assignment.periodStart}`);
          notify({ tone: "info", text: "Tekan dan geser ke slot tujuan." });
          document.body.classList.add("sakala-dragging");
          window.addEventListener("pointermove", onPointerMove, { passive: false });
          window.addEventListener("pointerup", onPointerUp, { passive: false });
          window.addEventListener("pointercancel", onPointerCancel, { passive: false });
        }) as EventListener;
        (card as HTMLElement & { __sakalaPointer?: EventListener }).__sakalaPointer = pointer;
        card.addEventListener("pointerdown", pointer, { passive: false });
        const oldClick = (card as HTMLElement & { __sakalaClick?: EventListener }).__sakalaClick;
        if (oldClick) card.removeEventListener("click", oldClick, true);
        const click = ((event: MouseEvent) => {
          if (moved || dragKey) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        }) as EventListener;
        (card as HTMLElement & { __sakalaClick?: EventListener }).__sakalaClick = click;
        card.addEventListener("click", click, true);

        const oldMenu = td.querySelector("[data-sakala-action-menu]");
        oldMenu?.remove();
        const action = document.createElement("button");
        action.type = "button";
        action.dataset.sakalaActionMenu = "true";
        action.setAttribute("aria-label", "Menu aksi jadwal");
        action.className = "absolute right-1.5 top-1.5 z-20 rounded-lg bg-white/80 px-1.5 py-1 text-ink-500 shadow-sm backdrop-blur transition hover:bg-white hover:text-ink-900";
        action.innerHTML = "⋮";
        action.addEventListener("pointerdown", (e) => e.stopPropagation());
        action.addEventListener("click", (e) => {
          e.stopPropagation();
          openActionMenu(card, assignment);
        });
        td.appendChild(action);
      });
    };

    observer = new MutationObserver(() => bind());
    observer.observe(root, { childList: true, subtree: true });
    bind();
    cleanupRef.current = () => {
      observer?.disconnect();
      closeMenu();
      root.querySelectorAll<HTMLElement>("[data-sakala-schedule-cell]").forEach((td) => {
        td.classList.remove("ring-2", "ring-brand-600", "bg-brand-50");
      });
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
    return cleanupRef.current;
  }, [academicContextId, assignments, scheduleModels, router, busy, dragKey]);

  if (!notice && !busy) return null;
  return (
    <div className="fixed inset-x-0 top-4 z-[120] mx-auto flex max-w-3xl justify-center px-4" aria-live="polite">
      <div className={`flex w-full items-start gap-2 rounded-2xl border px-4 py-3 text-[12.5px] shadow-lg backdrop-blur ${notice?.tone === "danger" ? "border-rose-200 bg-rose-50/95 text-rose-800" : notice?.tone === "success" ? "border-emerald-200 bg-emerald-50/95 text-emerald-800" : "border-brand-600/20 bg-surface/95 text-ink-700"}`}>
        {busy ? <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" /> : notice?.tone === "danger" ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : notice?.tone === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <GripVertical size={16} className="mt-0.5 shrink-0" />}
        <span>{notice?.text}</span>
      </div>
    </div>
  );
}
