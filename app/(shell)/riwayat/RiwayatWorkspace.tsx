"use client";

import { useState, useTransition } from "react";
import { History, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import type { AuditAction, AuditLogEntry } from "@/lib/domain/auditLog";
import { AUDIT_ACTION_LABEL, AUDIT_ENTITY_LABEL } from "@/lib/domain/auditLog";
import type { AcademicContext } from "@/lib/domain/academicContext";
import type { ScheduleVersion } from "@/lib/domain/scheduleVersion";
import { loadAuditLogAction, restoreScheduleVersionAction } from "./actions";
import Button from "@/components/ui/Button";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";

const ACTION_BADGE_TONE: Record<AuditAction, "success" | "warning" | "danger" | "info" | "neutral"> = {
  create: "success",
  edit: "info",
  move: "info",
  delete: "danger",
  generate: "info",
  optimize: "info",
  validate: "neutral",
  commit: "success",
  import: "neutral",
  restore: "warning",
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RiwayatWorkspace({
  activeContext,
  initialItems,
  total,
  pageSize,
  initialVersions,
}: {
  activeContext: AcademicContext | null;
  initialItems: AuditLogEntry[];
  total: number;
  pageSize: number;
  initialVersions: ScheduleVersion[];
}) {
  const [items, setItems] = useState<AuditLogEntry[]>(initialItems);
  const [totalCount, setTotalCount] = useState(total);
  const [versions, setVersions] = useState(initialVersions);
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasMore = items.length < totalCount;

  function applyFilter(next: AuditAction | "all") {
    setActionFilter(next);
    startTransition(async () => {
      const result = await loadAuditLogAction(
        activeContext?.id ?? null,
        next === "all" ? null : next,
        0,
        pageSize
      );
      if (result.ok) {
        setItems(result.data.items);
        setTotalCount(result.data.total);
      }
    });
  }

  function loadMore() {
    startTransition(async () => {
      const result = await loadAuditLogAction(
        activeContext?.id ?? null,
        actionFilter === "all" ? null : actionFilter,
        items.length,
        pageSize
      );
      if (result.ok) {
        setItems((prev) => [...prev, ...result.data.items]);
        setTotalCount(result.data.total);
      }
    });
  }

  function restoreVersion(version: ScheduleVersion) {
    if (!activeContext || version.status === "active") return;
    const confirmed = window.confirm(
      `Pulihkan versi "${version.label}"? Jadwal aktif saat ini akan disimpan sebagai versi historis dan tidak dihapus.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await restoreScheduleVersionAction(activeContext.id, version.id);
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      setVersions((prev) => prev.map((item) =>
        item.id === version.id
          ? { ...item, status: "active" }
          : item.status === "active"
            ? { ...item, status: "superseded" }
            : item
      ));
      window.alert(`Versi dipulihkan. ${result.data.restoredAssignments} assignment dikembalikan.`);
      window.location.reload();
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 pb-16 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-ink-900">Riwayat</h1>
          <p className="text-[13px] text-ink-500">
            Activity, perubahan, versi jadwal, dan pemulihan yang eksplisit.
          </p>
        </div>
        <select
          value={actionFilter}
          onChange={(e) => applyFilter(e.target.value as AuditAction | "all")}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-[13px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"
        >
          <option value="all">Semua aksi</option>
          {(Object.keys(AUDIT_ACTION_LABEL) as AuditAction[]).map((a) => (
            <option key={a} value={a}>
              {AUDIT_ACTION_LABEL[a]}
            </option>
          ))}
        </select>
      </div>

      <Card className="!p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-semibold text-ink-900">Versi Jadwal</h2>
            <p className="text-[12px] text-ink-500">Snapshot committed per perubahan. Versi lama tidak dihapus.</p>
          </div>
          <Badge tone="neutral">{versions.length} versi</Badge>
        </div>
        {versions.length === 0 ? (
          <p className="mt-3 text-[12px] text-ink-400">Belum ada versi jadwal pada konteks aktif.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {versions.map((version) => (
              <div key={version.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-ink-900">{version.label}</span>
                    <Badge tone={version.status === "active" ? "success" : version.status === "superseded" ? "neutral" : "warning"}>
                      {version.status === "active" ? "Aktif" : version.status === "superseded" ? "Historis" : "Arsip"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-ink-400">
                    {formatTimestamp(version.createdAt)}{version.changeSummary ? ` · ${version.changeSummary}` : ""}
                  </p>
                </div>
                {version.status !== "active" && (
                  <Button variant="secondary" size="sm" onClick={() => restoreVersion(version)} disabled={isPending}>
                    <RotateCcw size={14} />
                    Pulihkan
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="border-amber-200 bg-amber-50/60 !p-3.5">
        <p className="text-[12.5px] text-ink-600">
          <strong className="text-ink-900">Audit:</strong> mutation Jadwal, Guru, Mata Pelajaran, Kelas,
          Ruangan, dan Pembagian Mengajar dicatat dengan actor, waktu, context, before/after, source, dan reason.
          Pemulihan versi juga tercatat sebagai aksi <strong>restore</strong>.
        </p>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          title="Belum ada riwayat"
          description="Riwayat akan muncul di sini setelah ada perubahan data atau jadwal."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <Card key={entry.id} className="!p-4">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-400">
                      <History size={15} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={ACTION_BADGE_TONE[entry.action]}>{AUDIT_ACTION_LABEL[entry.action]}</Badge>
                        <span className="text-[13.5px] font-medium text-ink-900">
                          {AUDIT_ENTITY_LABEL[entry.entityType] ?? entry.entityType}
                        </span>
                        {entry.entityLabel && (
                          <span className="text-[12.5px] text-ink-500">— {entry.entityLabel}</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[12px] text-ink-400">
                        {formatTimestamp(entry.createdAt)} · {entry.actorEmail ?? "Sistem"}
                        {entry.reason && ` · ${entry.reason}`}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="mt-1 shrink-0 text-ink-300" /> : <ChevronDown size={16} className="mt-1 shrink-0 text-ink-300" />}
                </button>
                {isExpanded && (entry.before != null || entry.after != null) && (
                  <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2">
                    {entry.before != null && (
                      <div>
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">Sebelum</p>
                        <pre className="overflow-x-auto rounded-lg bg-surface-muted p-2.5 text-[11px] text-ink-600">{JSON.stringify(entry.before, null, 2)}</pre>
                      </div>
                    )}
                    {entry.after != null && (
                      <div>
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">Sesudah</p>
                        <pre className="overflow-x-auto rounded-lg bg-surface-muted p-2.5 text-[11px] text-ink-600">{JSON.stringify(entry.after, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" onClick={loadMore} disabled={isPending}>
            {isPending ? "Memuat..." : "Muat lebih banyak"}
          </Button>
        </div>
      )}
    </div>
  );
}
