"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Eye, GripVertical, MoreVertical, Pencil, Trash2 } from "lucide-react";
import type { ScheduleAssignment } from "@/lib/domain/scheduleAssignment";

export default function ScheduleCard({
  assignment,
  subjectLabel,
  entityLabel,
  roomLabel,
  teacherColor,
  conflict,
  onClick,
  onDetail,
  onEdit,
  onDuplicate,
  onDelete,
  onDragStart,
  onDragTargetChange,
  onDrop,
  onDragCancel,
}: {
  assignment: ScheduleAssignment;
  subjectLabel?: string;
  entityLabel?: string;
  roomLabel?: string;
  teacherColor?: { tint: string; accent: string; text: string };
  conflict?: boolean;
  onClick: () => void;
  onDetail: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragTargetChange: (day: string, period: number) => void;
  onDrop: (day: string, period: number) => void;
  onDragCancel: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const pointerRef = useRef<number | null>(null);
  const startRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!draggingRef.current) return;

    const move = (event: PointerEvent) => {
      if (pointerRef.current !== event.pointerId) return;
      const dx = event.clientX - startRef.current.x;
      const dy = event.clientY - startRef.current.y;
      if (!movedRef.current && Math.hypot(dx, dy) < 8) return;
      movedRef.current = true;
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const cell = element?.closest<HTMLElement>("[data-sakala-schedule-cell]");
      if (!cell) return;
      const day = cell.dataset.sakalaScheduleCellDay;
      const period = Number(cell.dataset.sakalaScheduleCellPeriod);
      if (day && Number.isFinite(period)) onDragTargetChange(day, period);
    };

    const up = (event: PointerEvent) => {
      if (pointerRef.current !== event.pointerId) return;
      const wasMoved = movedRef.current;
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const cell = element?.closest<HTMLElement>("[data-sakala-schedule-cell]");
      const day = cell?.dataset.sakalaScheduleCellDay;
      const period = Number(cell?.dataset.sakalaScheduleCellPeriod);
      draggingRef.current = false;
      pointerRef.current = null;
      movedRef.current = false;
      document.body.classList.remove("sakala-dragging");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      if (wasMoved && day && Number.isFinite(period)) onDrop(day, period);
      else if (wasMoved) onDragCancel();
    };

    const cancel = () => {
      draggingRef.current = false;
      pointerRef.current = null;
      movedRef.current = false;
      document.body.classList.remove("sakala-dragging");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      onDragCancel();
    };

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up, { passive: false });
    window.addEventListener("pointercancel", cancel, { passive: false });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [onDragCancel, onDragTargetChange, onDrop]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || menuOpen) return;
    pointerRef.current = event.pointerId;
    startRef.current = { x: event.clientX, y: event.clientY };
    movedRef.current = false;
    draggingRef.current = true;
    setMenuOpen(false);
    onDragStart();
  };

  const finishClick = () => {
    if (!movedRef.current) onClick();
  };

  return (
    <div className="relative h-full w-full">
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onClick={finishClick}
        className={`group relative flex min-h-16 w-full touch-none select-none flex-col justify-center gap-0.5 rounded-xl border px-2 py-1.5 pr-8 text-left text-[11.5px] shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md ${
          conflict
            ? "border-rose bg-rose-50 hover:bg-rose-50/70"
            : teacherColor
              ? "hover:brightness-95"
              : "border-brand-600/20 bg-brand-50 hover:bg-brand-50/70"
        }`}
        style={
          !conflict && teacherColor
            ? { backgroundColor: teacherColor.tint, borderColor: `${teacherColor.accent}33`, borderLeft: `3px solid ${teacherColor.accent}` }
            : undefined
        }
        aria-label={`Jadwal ${subjectLabel ?? ""}. Tekan dan geser untuk memindahkan.`}
      >
        <span className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden="true">
          <GripVertical size={13} />
        </span>
        <span className="break-words font-semibold leading-snug text-ink-900">{subjectLabel ?? "-"}</span>
        <span className="break-words leading-snug" style={!conflict && teacherColor ? { color: teacherColor.text } : undefined}>
          {entityLabel ?? "-"}
        </span>
        {roomLabel && <span className="break-words leading-snug text-ink-400">{roomLabel}</span>}
        <span className={`mt-0.5 inline-flex w-fit rounded-full px-1.5 py-0.5 text-[9px] font-medium ${conflict ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
          {conflict ? "Konflik" : `${assignment.periodEnd - assignment.periodStart + 1} JP`}
        </span>
      </button>

      <button
        type="button"
        aria-label="Menu aksi jadwal"
        aria-expanded={menuOpen}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen((value) => !value);
        }}
        className="absolute right-1.5 top-1.5 z-20 rounded-lg p-1 text-ink-500 opacity-70 transition hover:bg-white/80 hover:text-ink-900 group-hover:opacity-100"
      >
        <MoreVertical size={15} />
      </button>

      {menuOpen && (
        <>
          <button className="fixed inset-0 z-30 cursor-default" aria-label="Tutup menu" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-1 top-8 z-40 min-w-44 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-xl" role="menu">
            <Action icon={<Eye size={14} />} label="Lihat Detail" onClick={() => { setMenuOpen(false); onDetail(); }} />
            <Action icon={<Pencil size={14} />} label="Edit" onClick={() => { setMenuOpen(false); onEdit(); }} />
            <Action icon={<GripVertical size={14} />} label="Pindahkan" onClick={() => { setMenuOpen(false); onEdit(); }} />
            <Action icon={<Copy size={14} />} label="Duplikat" onClick={() => { setMenuOpen(false); onDuplicate(); }} />
            <Action danger icon={<Trash2 size={14} />} label="Arsipkan / Hapus" onClick={() => { setMenuOpen(false); onDelete(); }} />
          </div>
        </>
      )}
    </div>
  );
}

function Action({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition ${danger ? "text-rose-700 hover:bg-rose-50" : "text-ink-700 hover:bg-surface-muted"}`}>
      {icon}
      {label}
    </button>
  );
}
