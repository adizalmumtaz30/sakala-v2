// Application layer — use case / orchestration. Memanggil Domain untuk validasi
// dan Data Access untuk persistence. UI hanya boleh memanggil layer ini.
//
// Pembuatan version baru hanya lewat commitAssignments() di
// scheduleAssignment.usecases.ts (satu jalur commit, Bagian 68) — layer ini
// hanya menyediakan read + arsip, TIDAK ada createScheduleVersion langsung
// supaya tidak ada version "kosong" yang dibuat lepas dari proses commit.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduleVersion } from "@/lib/domain/scheduleVersion";
import { scheduleVersionRepository } from "@/lib/data-access/scheduleVersion.repository";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import type { ScheduleAssignment } from "@/lib/domain/scheduleAssignment";

export async function listScheduleVersions(supabase: SupabaseClient, academicContextId: string): Promise<ScheduleVersion[]> {
  return scheduleVersionRepository.findByContext(supabase, academicContextId);
}

export async function getScheduleVersion(supabase: SupabaseClient, id: string): Promise<ScheduleVersion | null> {
  return scheduleVersionRepository.findById(supabase, id);
}

export async function getScheduleVersionAssignments(supabase: SupabaseClient, versionId: string): Promise<ScheduleAssignment[]> {
  return scheduleAssignmentRepository.findByVersion(supabase, versionId);
}

/** Menandai version lama "superseded" ketika version baru dibuat untuk konteks yang sama — dipanggil manual oleh pemanggil yang perlu (mis. Jadwal Operational Workspace, step 15), bukan otomatis dari commitAssignments. */
export async function archiveScheduleVersion(supabase: SupabaseClient, id: string): Promise<ScheduleVersion> {
  return scheduleVersionRepository.setStatus(supabase, id, "archived");
}

export async function supersedeScheduleVersion(supabase: SupabaseClient, id: string): Promise<ScheduleVersion> {
  return scheduleVersionRepository.setStatus(supabase, id, "superseded");
}
