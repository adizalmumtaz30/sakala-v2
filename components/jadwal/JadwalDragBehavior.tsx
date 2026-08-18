"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, GripVertical, Loader2 } from "lucide-react";
import type { ScheduleAssignment, ScheduleAssignmentDraft } from "@/lib/domain/scheduleAssignment";
import type { ScheduleModel } from "@/lib/domain/scheduleModel";
import type { HariSekolah } from "@/lib/domain/jamPelajaran";
import { validateAssignmentAction, moveAssignmentAction } from "@/app/(shell)/jadwal/actions";

const VIEW_LABELS = ["kelas", "guru", "ruangan"] as const;
type ViewBy = (typeof VIEW_LABELS)[number];

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
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  useEffect(() => {
    const root = document.querySelector("main") ?? document.body;
    let dragId: string | null = null;
    let dragSource: ScheduleAssignment | null = null;

    const getWorkspace = () => Array.from(root.querySelectorAll("div")).find((el) => {
      const heading = el.querySelector("h1");
      return heading?.textContent?.trim() === "Jadwal";
    }) as HTMLElement | undefined;

    const getModelId = (workspace: HTMLElement) => {
      const select = workspace.querySelector("select") as HTMLSelectElement | null;
      return select?.value ?? scheduleModels.find((m) => m.status === "aktif")?.id ?? "";
    };

    const getViewBy = (workspace: HTMLElement): ViewBy => {
      const buttons = Array.from(workspace.querySelectorAll("button"));
      const active = buttons.find((button) => {
        const text = button.textContent?.trim().toLowerCase();
        return VIEW_LABELS.includes(text as ViewBy) && button.className.includes("bg-brand-600");
      });
      return (active?.textContent?.trim().toLowerCase() as ViewBy) || "kelas";
    };

    const getEntityId = (workspace: HTMLElement) => {
      const selects = Array.from(workspace.querySelectorAll("select"));
      return (selects[2] as HTMLSelectElement | undefined)?.value || (selects[1] as HTMLSelectElement | undefined)?.value || "";
    };

    const getGridCells = (workspace: HTMLElement) => {
      const table = workspace.querySelector("table");
      if (!table) return [] as Array<{ td: HTMLTableCellElement; day: HariSekolah; period: number }>;
      const headers = Array.from(table.querySelectorAll("thead th")).slice(1);
      const days = headers.map((h) => h.textContent?.trim().toLowerCase() || "").map((label) => {
        const found = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu"] as HariSekolah[];
        return found.find((d) => label.includes(d)) ?? null;
      });
      const rows = Array.from(table.querySelectorAll("tbody tr"));
      const result: Array<{ td: HTMLTableCellElement; day: HariSekolah; period: number }> = [];
      rows.forEach((row) => {
        const label = row.querySelector("td")?.textContent?.match(/Jam ke-(\d+)/i);
        const period = label ? Number(label[1]) : NaN;
        if (!Number.isFinite(period)) return;
        const cells = Array.from(row.querySelectorAll(":scope > td")).slice(1) as HTMLTableCellElement[];
        cells.forEach((td, index) => {
          const day = days[index];
          if (day) result.push({ td, day, period });
        });
      });
      return result;
    };

    const currentScopedAssignments = (workspace: HTMLElement, modelId: string) => {
      const viewBy = getViewBy(workspace);
      const entityId = getEntityId(workspace);
      return assignments.filter((a) =>
        a.status === "committed" &&
        a.scheduleModelId === modelId &&
        (viewBy === "kelas" ? a.classId === entityId : viewBy === "guru" ? a.teacherId === entityId : a.roomId === entityId)
      );
    };

    const clearDropClasses = () => {
      root.querySelectorAll<HTMLElement>("[data-sakala-drop]").forEach((el) => {
        el.classList.remove("ring-2", "ring-brand-600", "bg-brand-50", "ring-rose", "bg-rose-50");
      });
    };

    const onDragStart = (event: DragEvent) => {
      const target = (event.currentTarget as HTMLElement).dataset.sakalaAssignmentId;
      if (!target) return;
      const workspace = getWorkspace();
      if (!workspace) return;
      const modelId = getModelId(workspace);
      dragSource = currentScopedAssignments(workspace, modelId).find((a) => a.id === target) ?? null;
      dragId = target;
      if (!dragSource) return;
      event.dataTransfer?.setData("text/plain", target);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      setNotice({ tone: "info", text: "Tarik jadwal ke slot kosong untuk memindahkannya." });
      const grip = document.createElement("span");
      grip.className = "pointer-events-none fixed -left-[9999px] rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg";
      grip.textContent = "Memindahkan jadwal…";
      document.body.appendChild(grip);
      event.dataTransfer?.setDragImage(grip, 8, 8);
      setTimeout(() => grip.remove(), 0);
    };

    const onDragEnd = () => {
      dragId = null;
      dragSource = null;
      clearDropClasses();
      setNotice(null);
    };

    const onDragOver = (event: DragEvent) => {
      if (!dragId) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      const td = event.currentTarget as HTMLElement;
      clearDropClasses();
      td.dataset.sakalaDrop = "true";
      td.classList.add("ring-2", "ring-brand-600", "bg-brand-50");
    };

    const onDrop = async (event: DragEvent) => {
      event.preventDefault();
      const td = event.currentTarget as HTMLTableCellElement;
      const workspace = getWorkspace();
      if (!workspace || !dragSource || !dragId) return;
      const cellMeta = getGridCells(workspace).find((c) => c.td === td);
      if (!cellMeta) return;
      const source = dragSource;
      const modelId = getModelId(workspace);
      const model = scheduleModels.find((m) => m.id === modelId);
      if (!model) return;
      const span = source.periodEnd - source.periodStart;
      const targetEnd = cellMeta.period + span;
      const targetCells = getGridCells(workspace).filter((c) => c.day === cellMeta.day && c.period >= cellMeta.period && c.period <= targetEnd);
      if (targetCells.length !== span + 1) {
        setBusy(false);
        setNotice({ tone: "danger", text: "Jadwal tidak dapat dipindahkan: rentang JP melewati slot yang tersedia." });
        return;
      }

      setBusy(true);
      setNotice({ tone: "info", text: `Memvalidasi perpindahan ke ${cellMeta.day}, Jam ${cellMeta.period}…` });
      clearDropClasses();

      const draft: ScheduleAssignmentDraft = {
        academicContextId,
        scheduleModelId: model.id,
        classId: source.classId,
        subjectId: source.subjectId,
        teacherId: source.teacherId,
        roomId: source.roomId ?? null,
        day: cellMeta.day,
        periodStart: cellMeta.period,
        periodEnd: targetEnd,
        activityType: source.activityType,
        status: "draft",
        source: source.source,
        versionId: source.versionId ?? null,
      };

      const validation = await validateAssignmentAction(draft, source.id);
      if (!validation.ok) {
        setBusy(false);
        setNotice({ tone: "danger", text: validation.error });
        return;
      }
      const blocking = validation.data.conflicts.filter((c) => c.blocking);
      if (blocking.length > 0) {
        setBusy(false);
        setNotice({ tone: "danger", text: `Jadwal tidak dapat dipindahkan — ${blocking[0].message}` });
        return;
      }

      setNotice({ tone: "success", text: `✓ Slot tersedia — ${source.day} Jam ${source.periodStart} → ${cellMeta.day} Jam ${cellMeta.period}. Menyimpan…` });
      const result = await moveAssignmentAction(source.id, {
        day: cellMeta.day,
        periodStart: cellMeta.period,
        periodEnd: targetEnd,
        roomId: source.roomId ?? null,
        classId: source.classId,
        subjectId: source.subjectId,
        teacherId: source.teacherId,
      }, "Pindah melalui Drag & Drop");
      setBusy(false);
      dragId = null;
      dragSource = null;
      if (!result.ok) {
        setNotice({ tone: "danger", text: `Jadwal tidak dapat dipindahkan — ${result.error}` });
        return;
      }
      setNotice({ tone: "success", text: `✓ Jadwal berhasil dipindahkan — ${source.day} Jam ${source.periodStart} → ${cellMeta.day} Jam ${cellMeta.period}.` });
      router.refresh();
    };

    const bind = () => {
      const workspace = getWorkspace();
      if (!workspace) return;
      const modelId = getModelId(workspace);
      const scoped = currentScopedAssignments(workspace, modelId);
      const cells = getGridCells(workspace);
      const assignmentByCell = new Map<string, ScheduleAssignment>();
      for (const a of scoped) {
        for (let period = a.periodStart; period <= a.periodEnd; period++) assignmentByCell.set(`${a.day}:${period}`, a);
      }

      cells.forEach(({ td, day, period }) => {
        td.dataset.sakalaDrop = "true";
        td.removeEventListener("dragover", onDragOver);
        td.removeEventListener("drop", onDrop);
        td.addEventListener("dragover", onDragOver);
        td.addEventListener("drop", onDrop);
        const button = td.querySelector("button") as HTMLButtonElement | null;
        if (!button) return;
        const assignment = assignmentByCell.get(`${day}:${period}`);
        const isStart = assignment && assignment.day === day && assignment.periodStart === period;
        if (isStart) {
          button.dataset.sakalaAssignmentId = assignment.id;
          button.draggable = !busy;
          button.title = "Tarik untuk memindahkan jadwal";
          if (!button.querySelector("[data-sakala-grip]")) {
            const grip = document.createElement("span");
            grip.dataset.sakalaGrip = "true";
            grip.className = "pointer-events-none absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100";
            grip.innerHTML = "<span aria-hidden=\"true\">⋮⋮</span>";
            button.classList.add("group", "relative");
            button.appendChild(grip);
          }
          button.removeEventListener("dragstart", onDragStart);
          button.removeEventListener("dragend", onDragEnd);
          button.addEventListener("dragstart", onDragStart);
          button.addEventListener("dragend", onDragEnd);
        } else {
          button.draggable = false;
          delete button.dataset.sakalaAssignmentId;
        }
      });
    };

    const observer = new MutationObserver(() => bind());
    observer.observe(root, { childList: true, subtree: true });
    bind();
    return () => {
      observer.disconnect();
      root.querySelectorAll<HTMLElement>("[data-sakala-drop]").forEach((td) => {
        td.removeEventListener("dragover", onDragOver);
        td.removeEventListener("drop", onDrop);
      });
      root.querySelectorAll<HTMLElement>("[data-sakala-assignment-id]").forEach((button) => {
        button.removeEventListener("dragstart", onDragStart);
        button.removeEventListener("dragend", onDragEnd);
      });
    };
  }, [academicContextId, assignments, scheduleModels, router, busy]);

  if (!notice && !busy) return null;
  return (
    <div className="fixed inset-x-0 top-4 z-[80] mx-auto flex max-w-3xl justify-center px-4" aria-live="polite">
      <div className={`flex w-full items-start gap-2 rounded-2xl border px-4 py-3 text-[12.5px] shadow-lg backdrop-blur ${notice?.tone === "danger" ? "border-rose-200 bg-rose-50/95 text-rose-800" : notice?.tone === "success" ? "border-emerald-200 bg-emerald-50/95 text-emerald-800" : "border-brand-600/20 bg-surface/95 text-ink-700"}`}>
        {busy ? <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" /> : notice?.tone === "danger" ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : notice?.tone === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <GripVertical size={16} className="mt-0.5 shrink-0" />}
        <span>{notice?.text}</span>
      </div>
    </div>
  );
}
