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
type DragState = { assignment: ScheduleAssignment; el: HTMLElement; pointerId: number; x: number; y: number; active: boolean };

export default function JadwalPointerDrag({ academicContextId, scheduleModels, assignments }: { academicContextId: string; scheduleModels: ScheduleModel[]; assignments: ScheduleAssignment[] }) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = document.querySelector("main") ?? document.body;
    const closeMenu = () => { menuRef.current?.remove(); menuRef.current = null; };
    const getWorkspace = () => Array.from(root.querySelectorAll<HTMLElement>("div")).find((el) => el.querySelector(":scope > h1")?.textContent?.trim() === "Jadwal" && el.querySelector("table"));
    const getCells = (ws: HTMLElement) => {
      const table = ws.querySelector("table"); if (!table) return [] as { td: HTMLTableCellElement; day: HariSekolah; period: number }[];
      const days = Array.from(table.querySelectorAll("thead th")).slice(1).map((th) => DAYS.find((d) => (th.textContent || "").toLowerCase().includes(d)) ?? null);
      const out: { td: HTMLTableCellElement; day: HariSekolah; period: number }[] = [];
      table.querySelectorAll("tbody tr").forEach((tr) => { const m = tr.querySelector("td")?.textContent?.match(/Jam ke-\s*(\d+)/i); if (!m) return; const period = Number(m[1]); Array.from(tr.querySelectorAll(":scope > td")).slice(1).forEach((node, i) => { const day = days[i]; if (day) out.push({ td: node as HTMLTableCellElement, day, period }); }); });
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
    const clickModalAction = (label: string) => { const target = Array.from(document.querySelectorAll("button")).find((b) => (b as HTMLElement).offsetParent !== null && b.textContent?.trim().toLowerCase().includes(label.toLowerCase())) as HTMLButtonElement | undefined; target?.click(); };
    const openActionMenu = (card: HTMLElement) => {
      closeMenu(); const rect = card.getBoundingClientRect(); const menu = document.createElement("div"); menuRef.current = menu;
      menu.className = "fixed z-[200] min-w-48 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-2xl";
      menu.style.left = `${Math.max(8, Math.min(rect.right - 192, window.innerWidth - 204))}px`; menu.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 250)}px`;
      menu.innerHTML = `<div class="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Aksi Jadwal</div>`;
      const actions: Array<[string, string, boolean]> = [["Lihat Detail", "detail", false], ["Edit", "edit", false], ["Pindahkan", "move", false], ["Duplikat", "duplicate", false], ["Arsipkan / Hapus", "delete", true]];
      for (const [label, action, danger] of actions) {
        const item = document.createElement("button"); item.type = "button"; item.className = `flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] ${danger ? "text-rose-700 hover:bg-rose-50" : "text-ink-700 hover:bg-surface-muted"}`;
        item.innerHTML = `<span class="text-ink-400">${action === "detail" ? "◉" : action === "edit" ? "✎" : action === "move" ? "↔" : action === "duplicate" ? "⧉" : "⌫"}</span>${label}`;
        item.addEventListener("click", (event) => { event.stopPropagation(); closeMenu(); card.click(); if (action !== "detail") window.setTimeout(() => clickModalAction(action === "duplicate" ? "Duplikat" : action === "delete" ? "Hapus" : "Edit / Pindahkan"), 120); });
        menu.appendChild(item);
      }
      document.body.appendChild(menu);
      const outside = (event: PointerEvent) => { if (!menu.contains(event.target as Node)) { closeMenu(); document.removeEventListener("pointerdown", outside); } };
      window.setTimeout(() => document.addEventListener("pointerdown", outside), 0);
    };
    const bind = () => {
      const ws = getWorkspace(); if (!ws) return;
      const byCell = new Map<string, ScheduleAssignment>(); getScope(ws).forEach((a) => { for (let p = a.periodStart; p <= a.periodEnd; p++) byCell.set(`${a.day}:${p}`, a); });
      getCells(ws).forEach(({ td, day, period }) => {
        td.dataset.sakalaScheduleCell = "true"; td.dataset.sakalaScheduleCellDay = day; td.dataset.sakalaScheduleCellPeriod = String(period); td.style.position = "relative";
        const assignment = byCell.get(`${day}:${period}`); const card = td.querySelector("button:not([data-sakala-action-menu])") as HTMLElement | null;
        if (!card || !assignment || assignment.periodStart !== period) return;
        card.dataset.sakalaAssignmentId = assignment.id; card.style.touchAction = "none"; card.style.cursor = "grab"; card.title = "Tekan dan geser ke slot tujuan untuk memindahkan jadwal";
        if (!td.querySelector("[data-sakala-action-menu]")) {
          const action = document.createElement("button"); action.type = "button"; action.dataset.sakalaActionMenu = "true"; action.setAttribute("aria-label", "Menu aksi jadwal"); action.className = "absolute right-1.5 top-1.5 z-20 rounded-lg bg-white/85 px-1.5 py-0.5 text-base font-semibold leading-none text-ink-500 shadow-sm backdrop-blur hover:bg-white hover:text-ink-900"; action.textContent = "⋮";
          action.addEventListener("pointerdown", (event) => event.stopPropagation()); action.addEventListener("click", (event) => { event.stopPropagation(); openActionMenu(card); }); td.appendChild(action);
        }
      });
    };
    const clearTarget = () => root.querySelectorAll<HTMLElement>("[data-sakala-drop-active]").forEach((el) => { el.classList.remove("ring-2", "ring-brand-600", "bg-brand-50"); delete el.dataset.sakalaDropActive; });
    const targetAt = (x: number, y: number) => { const element = document.elementFromPoint(x, y) as HTMLElement | null; const td = element?.closest("[data-sakala-schedule-cell]") as HTMLTableCellElement | null; if (!td) return null; return { td, day: td.dataset.sakalaScheduleCellDay as HariSekolah, period: Number(td.dataset.sakalaScheduleCellPeriod) }; };
    const onDown = (event: PointerEvent) => {
      if (busy || event.button !== 0) return; if ((event.target as HTMLElement).closest("[data-sakala-action-menu]")) return;
      const card = (event.target as HTMLElement).closest("[data-sakala-assignment-id]") as HTMLElement | null; if (!card) return;
      const assignment = assignments.find((a) => a.id === card.dataset.sakalaAssignmentId && a.status === "committed"); if (!assignment) return;
      closeMenu(); dragRef.current = { assignment, el: card, pointerId: event.pointerId, x: event.clientX, y: event.clientY, active: false };
    };
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId || busy) return;
      if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
      if (!drag.active) { drag.active = true; drag.el.classList.add("opacity-40", "scale-[0.98]"); setNotice({ tone: "info", text: "Tekan, geser, lalu lepas pada slot tujuan." }); document.body.classList.add("sakala-dragging"); }
      clearTarget(); const target = targetAt(event.clientX, event.clientY); if (target) { target.td.dataset.sakalaDropActive = "true"; target.td.classList.add("ring-2", "ring-brand-600", "bg-brand-50"); } event.preventDefault();
    };
    const onUp = async (event: PointerEvent) => {
      const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null; const wasDrag = drag.active; drag.el.classList.remove("opacity-40", "scale-[0.98]"); document.body.classList.remove("sakala-dragging");
      const target = targetAt(event.clientX, event.clientY); clearTarget(); if (!wasDrag) return;
      if (!target || !target.day || !Number.isFinite(target.period)) { setNotice({ tone: "danger", text: "Slot tujuan tidak ditemukan. Jadwal tetap di posisi semula." }); return; }
      if (target.day === drag.assignment.day && target.period === drag.assignment.periodStart) { setNotice(null); return; }
      const ws = getWorkspace(); const modelId = ws ? (ws.querySelector("select") as HTMLSelectElement | null)?.value : drag.assignment.scheduleModelId; const model = scheduleModels.find((m) => m.id === modelId); if (!model) return;
      const span = drag.assignment.periodEnd - drag.assignment.periodStart; const targetEnd = target.period + span; const availableCells = ws ? getCells(ws).filter((c) => c.day === target.day && c.period >= target.period && c.period <= targetEnd) : [];
      if (availableCells.length !== span + 1) { setNotice({ tone: "danger", text: "Jadwal tidak dapat dipindahkan: rentang JP tujuan melewati slot yang tersedia." }); return; }
      setBusy(true); setNotice({ tone: "info", text: `Memvalidasi ${drag.assignment.day} Jam ${drag.assignment.periodStart} → ${target.day} Jam ${target.period}…` });
      const draft: ScheduleAssignmentDraft = { academicContextId, scheduleModelId: model.id, classId: drag.assignment.classId, subjectId: drag.assignment.subjectId, teacherId: drag.assignment.teacherId, roomId: drag.assignment.roomId ?? null, day: target.day, periodStart: target.period, periodEnd: targetEnd, activityType: drag.assignment.activityType, status: "draft", source: drag.assignment.source, versionId: drag.assignment.versionId ?? null };
      const validation = await validateAssignmentAction(draft, drag.assignment.id);
      if (!validation.ok) { setBusy(false); setNotice({ tone: "danger", text: `Jadwal tidak dapat dipindahkan — ${validation.error}` }); return; }
      const blocking = validation.data.conflicts.filter((c) => c.blocking); if (blocking.length) { setBusy(false); setNotice({ tone: "danger", text: `Jadwal tidak dapat dipindahkan — ${blocking[0].message}` }); return; }
      setNotice({ tone: "success", text: "Validasi berhasil. Menyimpan perpindahan…" });
      const result = await moveAssignmentAction(drag.assignment.id, { day: target.day, periodStart: target.period, periodEnd: targetEnd, roomId: drag.assignment.roomId ?? null, classId: drag.assignment.classId, subjectId: drag.assignment.subjectId, teacherId: drag.assignment.teacherId }, "Pindah melalui Drag & Drop");
      setBusy(false); if (!result.ok) { setNotice({ tone: "danger", text: `Jadwal tidak dapat dipindahkan — ${result.error}` }); return; }
      setNotice({ tone: "success", text: `✓ Jadwal berhasil dipindahkan — ${drag.assignment.day} Jam ${drag.assignment.periodStart} → ${target.day} Jam ${target.period}.` }); router.refresh();
    };
    const observer = new MutationObserver(bind); observer.observe(root, { childList: true, subtree: true }); bind();
    root.addEventListener("pointerdown", onDown, { passive: false }); root.addEventListener("pointermove", onMove, { passive: false }); root.addEventListener("pointerup", onUp, { passive: false }); root.addEventListener("pointercancel", onUp, { passive: false });
    return () => { observer.disconnect(); closeMenu(); dragRef.current = null; root.removeEventListener("pointerdown", onDown); root.removeEventListener("pointermove", onMove); root.removeEventListener("pointerup", onUp); root.removeEventListener("pointercancel", onUp); clearTarget(); document.body.classList.remove("sakala-dragging"); };
  }, [academicContextId, assignments, scheduleModels, router, busy]);

  if (!notice && !busy) return null;
  return <div className="fixed inset-x-0 top-4 z-[120] mx-auto flex max-w-3xl justify-center px-4" aria-live="polite"><div className={`flex w-full items-start gap-2 rounded-2xl border px-4 py-3 text-[12.5px] shadow-lg backdrop-blur ${notice?.tone === "danger" ? "border-rose-200 bg-rose-50/95 text-rose-800" : notice?.tone === "success" ? "border-emerald-200 bg-emerald-50/95 text-emerald-800" : "border-brand-600/20 bg-surface/95 text-ink-700"}`}>{busy ? <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" /> : notice?.tone === "danger" ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : notice?.tone === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <GripVertical size={16} className="mt-0.5 shrink-0" />}<span>{notice?.text}</span></div></div>;
}
