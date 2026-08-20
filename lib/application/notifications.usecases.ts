// Application layer — Notifikasi Terbaru (golden reference item 8) & badge
// bell di Header. Belum ada modul Notifikasi tersendiri (step 19 masih
// ComingSoon) dan tidak ada tabel notifikasi — supaya tidak menyajikan data
// palsu, sumbernya adalah audit_log yang sama dipakai "Aktivitas Terbaru" di
// Dashboard. "Belum dibaca" dihitung dari createdAt (real timestamp), bukan
// state baca/tulis yang belum ada.

import type { SupabaseClient } from "@supabase/supabase-js";
import { auditLogRepository } from "@/lib/data-access/auditLog.repository";
import { humanizeActivity } from "@/lib/application/dashboard.intelligence";

export type NotificationTone = "info" | "success" | "warning";

export interface NotificationEntry {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  tone: NotificationTone;
  unread: boolean;
}

const ACTION_TONE: Record<string, NotificationTone> = {
  create: "info", created: "info", insert: "info", import: "info",
  update: "info", updated: "info", edit: "info",
  delete: "warning", deleted: "warning", remove: "warning",
  commit: "success", committed: "success",
};

const UNREAD_WINDOW_MS = 60 * 60 * 1000; // 1 jam — belum ada state baca/tulis, jadi entri terbaru dianggap "baru".

export async function getRecentNotifications(supabase: SupabaseClient, contextId: string | null, limit = 8): Promise<NotificationEntry[]> {
  const audit = await auditLogRepository.findMany(supabase, { academicContextId: contextId ?? undefined, limit });
  const now = Date.now();
  return audit.items.map((i) => {
    const actionKey = i.action.trim().toLowerCase().replace(/[- ]+/g, "_");
    const title = humanizeActivity(i.action, i.entityType, null);
    const description = i.entityLabel?.trim() && !/^\d+$/.test(i.entityLabel.trim()) ? i.entityLabel.trim() : "";
    return {
      id: i.id,
      title,
      description,
      createdAt: i.createdAt,
      tone: ACTION_TONE[actionKey] ?? "info",
      unread: now - new Date(i.createdAt).getTime() <= UNREAD_WINDOW_MS,
    };
  });
}
