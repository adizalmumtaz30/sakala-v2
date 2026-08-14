// Application layer — orchestration Jadwal Cerdas (Bagian 24/87). Menjalankan
// tahap Load Context → Select Scope → Load Constraints → Normalize →
// Generate Candidate → Validate → Conflict Detection dari pipeline; tahap
// Candidate Review/Commit ditangani scheduleAssignment.usecases.ts yang
// sudah ada (commitAssignments), dipanggil dari Presentation (step 14 UI).
//
// generateCandidatePreview() TIDAK menulis ke database — murni in-memory
// (Bagian 68: "Candidate tidak boleh mengubah committed schedule sebelum
// commit" — di sini malah belum menyentuh DB sama sekali sampai user
// eksplisit menekan "Simpan sebagai Candidate", lihat saveGeneratedCandidates).
//
// ALGORITMA (keputusan Claude, bukan dispesifikasikan detail-nya oleh
// dokumen): greedy round-robin per hari aktif Schedule Model, satu JP =
// satu unit periode (periodStart = periodEnd), menghormati occupancy
// guru/kelas/ruangan dari assignment aktif yang sudah ada + assignment yang
// baru saja ditempatkan dalam batch yang sama. BUKAN true optimal constraint
// solver (tidak backtrack lintas requirement, tidak reshuffle assignment
// yang sudah ditempatkan requirement sebelumnya) — cukup untuk baseline,
// di-flag untuk direview/ditingkatkan nanti kalau perlu.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HariSekolah } from "@/lib/domain/jamPelajaran";
import { jamPelajaranRepository } from "@/lib/data-access/jamPelajaran.repository";
import { slotTemplateRepository } from "@/lib/data-access/slotTemplate.repository";
import { scheduleModelRepository } from "@/lib/data-access/scheduleModel.repository";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import { isFixedSlot } from "@/lib/domain/slotTemplate";
import type { ScheduleAssignment, ScheduleAssignmentDraft } from "@/lib/domain/scheduleAssignment";
import { validateScheduleAssignmentDraft } from "@/lib/domain/scheduleAssignment";
import type { GenerationRequirement, RequirementGenerationOutcome } from "@/lib/domain/candidateGeneration";
import { validateGenerationRequirement } from "@/lib/domain/candidateGeneration";
import { validateAssignmentCandidate } from "@/lib/application/conflictEngine";
import type { ScheduleConflict } from "@/lib/domain/conflict";

export interface GeneratedCandidate {
  requirementId: string;
  draft: ScheduleAssignmentDraft;
}

export interface GenerationResult {
  candidates: GeneratedCandidate[];
  outcomes: RequirementGenerationOutcome[];
}

function buildAvailableSlots(
  hariAktif: HariSekolah[],
  jamPelajaranList: { hari: HariSekolah; nomorUrut: number; jenis: string; status: string }[],
  slotTemplates: { hari: HariSekolah; nomorUrut: number; jenisSlot: string }[]
): Map<HariSekolah, number[]> {
  const fixedSet = new Set(
    slotTemplates.filter((s) => isFixedSlot(s.jenisSlot as Parameters<typeof isFixedSlot>[0])).map((s) => `${s.hari}:${s.nomorUrut}`)
  );
  const slotsByDay = new Map<HariSekolah, number[]>();
  for (const day of hariAktif) {
    const periods = jamPelajaranList
      .filter((jp) => jp.hari === day && jp.jenis === "pembelajaran" && jp.status === "aktif")
      .filter((jp) => !fixedSet.has(`${day}:${jp.nomorUrut}`))
      .map((jp) => jp.nomorUrut)
      .sort((a, b) => a - b);
    slotsByDay.set(day, periods);
  }
  return slotsByDay;
}

function rotate<T>(arr: T[], n: number): T[] {
  if (arr.length === 0) return arr;
  const k = n % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}

/**
 * Preview murni — TIDAK menulis apa pun ke database. Dipanggil dari Server
 * Action generateCandidatesAction untuk ditampilkan di UI sebelum user
 * menekan "Simpan sebagai Candidate" (Bagian 24.2: Generate Candidate →
 * Validate → Conflict Detection → Candidate Review).
 */
export async function generateCandidatePreview(
  supabase: SupabaseClient,
  academicContextId: string,
  scheduleModelId: string,
  requirements: GenerationRequirement[]
): Promise<GenerationResult> {
  if (requirements.length === 0) {
    return { candidates: [], outcomes: [] };
  }
  for (const req of requirements) validateGenerationRequirement(req);

  const [scheduleModel, jamPelajaranList, slotTemplates, existingAssignments] = await Promise.all([
    scheduleModelRepository.findById(supabase, scheduleModelId),
    jamPelajaranRepository.findByContext(supabase, academicContextId),
    slotTemplateRepository.findByModel(supabase, scheduleModelId),
    scheduleAssignmentRepository.findByContext(supabase, academicContextId),
  ]);

  if (!scheduleModel) {
    throw new Error("Schedule Model tidak ditemukan.");
  }
  if (scheduleModel.academicContextId !== academicContextId) {
    throw new Error("Schedule Model yang dipilih berasal dari konteks akademik yang berbeda.");
  }

  const slotsByDay = buildAvailableSlots(scheduleModel.hariAktif, jamPelajaranList, slotTemplates);

  // Occupancy tracker — mulai dari assignment aktif (draft/candidate/committed)
  // yang sudah ada, lalu ditambah tiap kali generator menempatkan assignment
  // baru dalam batch ini supaya tidak saling bentrok satu sama lain.
  const activeExisting = existingAssignments.filter((a) => a.status !== "archived" && a.status !== "cancelled");
  const teacherOccupied = new Set<string>();
  const classOccupied = new Set<string>();
  const roomOccupied = new Set<string>();
  for (const a of activeExisting) {
    for (let p = a.periodStart; p <= a.periodEnd; p += 1) {
      teacherOccupied.add(`${a.teacherId}:${a.day}:${p}`);
      classOccupied.add(`${a.classId}:${a.day}:${p}`);
      if (a.roomId) roomOccupied.add(`${a.roomId}:${a.day}:${p}`);
    }
  }

  const days = scheduleModel.hariAktif;
  const candidates: GeneratedCandidate[] = [];
  const outcomes: RequirementGenerationOutcome[] = [];

  requirements.forEach((req, reqIndex) => {
    const placements: { day: HariSekolah; period: number }[] = [];
    // Rotasi hari mulai per requirement supaya beban tidak selalu numpuk di
    // hari pertama saat banyak requirement diproses berurutan (heuristik
    // sederhana, bukan true load-balancing solver).
    const dayOrder = rotate(days, reqIndex % Math.max(days.length, 1));

    let remaining = req.jpTarget;
    for (const day of dayOrder) {
      if (remaining <= 0) break;
      const periods = slotsByDay.get(day) ?? [];
      for (const period of periods) {
        if (remaining <= 0) break;
        const tKey = `${req.teacherId}:${day}:${period}`;
        const cKey = `${req.classId}:${day}:${period}`;
        const rKey = req.roomId ? `${req.roomId}:${day}:${period}` : null;
        if (teacherOccupied.has(tKey)) continue;
        if (classOccupied.has(cKey)) continue;
        if (rKey && roomOccupied.has(rKey)) continue;

        teacherOccupied.add(tKey);
        classOccupied.add(cKey);
        if (rKey) roomOccupied.add(rKey);
        placements.push({ day, period });
        remaining -= 1;
      }
    }

    for (const placement of placements) {
      const draft: ScheduleAssignmentDraft = {
        academicContextId,
        scheduleModelId,
        classId: req.classId,
        subjectId: req.subjectId,
        teacherId: req.teacherId,
        roomId: req.roomId,
        day: placement.day,
        periodStart: placement.period,
        periodEnd: placement.period,
        activityType: req.activityType,
        status: "candidate",
        source: "generated",
        versionId: null,
      };
      validateScheduleAssignmentDraft(draft);
      candidates.push({ requirementId: req.id, draft });
    }

    outcomes.push({
      requirementId: req.id,
      classId: req.classId,
      subjectId: req.subjectId,
      teacherId: req.teacherId,
      jpTarget: req.jpTarget,
      placed: placements.length,
      unplaced: req.jpTarget - placements.length,
      placements: placements.map((p) => ({ day: p.day, periodStart: p.period, periodEnd: p.period })),
    });
  });

  return { candidates, outcomes };
}

/**
 * Simpan hasil preview ke database sebagai baris status="candidate" —
 * transisi eksplisit dari "Generate Candidate" ke "Candidate Review"
 * (Bagian 24.2/68 — tidak ada silent mutation, user yang menekan tombol).
 * Tiap draft divalidasi ULANG lewat Conflict Engine sebelum insert (state DB
 * bisa berubah antara preview dan klik simpan) — draft dengan blocking
 * conflict DILEWATI (bukan membatalkan seluruh batch), supaya sisanya yang
 * bersih tetap tersimpan; yang dilewati dilaporkan ke pemanggil untuk
 * ditampilkan ke user.
 */
export async function saveGeneratedCandidates(
  supabase: SupabaseClient,
  drafts: ScheduleAssignmentDraft[]
): Promise<{ saved: ScheduleAssignment[]; skipped: { draft: ScheduleAssignmentDraft; conflicts: ScheduleConflict[] }[] }> {
  const saved: ScheduleAssignment[] = [];
  const skipped: { draft: ScheduleAssignmentDraft; conflicts: ScheduleConflict[] }[] = [];

  for (const draft of drafts) {
    const conflicts = await validateAssignmentCandidate(supabase, draft);
    const blocking = conflicts.filter((c) => c.blocking);
    if (blocking.length > 0) {
      skipped.push({ draft, conflicts: blocking });
      continue;
    }
    const created = await scheduleAssignmentRepository.create(supabase, draft);
    saved.push(created);
  }

  return { saved, skipped };
}

// --- OPTIMIZATION (Bagian 24.4/87) ---

export interface OptimizationChange {
  assignmentId: string;
  from: { day: HariSekolah; periodStart: number; periodEnd: number };
  to: { day: HariSekolah; periodStart: number; periodEnd: number } | null;
}

export interface OptimizationPreview {
  beforeConflictCount: number;
  afterConflictCount: number;
  changes: OptimizationChange[];
  remainingConflicts: Record<string, ScheduleConflict[]>;
}

function assignmentToDraft(a: ScheduleAssignment): ScheduleAssignmentDraft {
  return {
    academicContextId: a.academicContextId,
    scheduleModelId: a.scheduleModelId,
    classId: a.classId,
    subjectId: a.subjectId,
    teacherId: a.teacherId,
    roomId: a.roomId,
    day: a.day,
    periodStart: a.periodStart,
    periodEnd: a.periodEnd,
    activityType: a.activityType,
    status: a.status,
    source: a.source,
    versionId: a.versionId,
  };
}

/**
 * Optimasi (Bagian 24.4) — HANYA memproses assignment candidate yang SAAT
 * INI punya blocking conflict (bukan re-generate semuanya dari nol):
 * mencoba memindahkan tiap assignment bermasalah ke slot lain yang bebas
 * dalam hari aktif Schedule Model yang sama, sambil mempertahankan
 * assignment yang sudah bersih di posisinya. Preview saja — TIDAK menulis
 * ke database (lihat applyOptimization untuk penerapan eksplisit).
 */
export async function optimizeCandidateBatch(
  supabase: SupabaseClient,
  academicContextId: string,
  scheduleModelId: string,
  candidateIds: string[]
): Promise<OptimizationPreview> {
  const [scheduleModel, jamPelajaranList, slotTemplates, allAssignments] = await Promise.all([
    scheduleModelRepository.findById(supabase, scheduleModelId),
    jamPelajaranRepository.findByContext(supabase, academicContextId),
    slotTemplateRepository.findByModel(supabase, scheduleModelId),
    scheduleAssignmentRepository.findByContext(supabase, academicContextId),
  ]);
  if (!scheduleModel) throw new Error("Schedule Model tidak ditemukan.");

  const target = allAssignments.filter((a) => candidateIds.includes(a.id));
  const others = allAssignments.filter((a) => a.status !== "archived" && a.status !== "cancelled" && !candidateIds.includes(a.id));

  // Conflict awal per candidate — pakai Conflict Engine asli (akurat, sama
  // seperti yang dipakai Candidate Review).
  const beforeConflicts: Record<string, ScheduleConflict[]> = {};
  for (const a of target) {
    beforeConflicts[a.id] = await validateAssignmentCandidate(supabase, assignmentToDraft(a), a.id);
  }
  const beforeConflictCount = Object.values(beforeConflicts).reduce((sum, c) => sum + c.filter((x) => x.blocking).length, 0);

  const slotsByDay = buildAvailableSlots(scheduleModel.hariAktif, jamPelajaranList, slotTemplates);

  const teacherOccupied = new Set<string>();
  const classOccupied = new Set<string>();
  const roomOccupied = new Set<string>();
  for (const a of others) {
    for (let p = a.periodStart; p <= a.periodEnd; p += 1) {
      teacherOccupied.add(`${a.teacherId}:${a.day}:${p}`);
      classOccupied.add(`${a.classId}:${a.day}:${p}`);
      if (a.roomId) roomOccupied.add(`${a.roomId}:${a.day}:${p}`);
    }
  }

  const problematic = target.filter((a) => beforeConflicts[a.id].some((c) => c.blocking));
  const clean = target.filter((a) => !beforeConflicts[a.id].some((c) => c.blocking));
  // Assignment target yang bersih tetap dikunci di posisinya.
  for (const a of clean) {
    for (let p = a.periodStart; p <= a.periodEnd; p += 1) {
      teacherOccupied.add(`${a.teacherId}:${a.day}:${p}`);
      classOccupied.add(`${a.classId}:${a.day}:${p}`);
      if (a.roomId) roomOccupied.add(`${a.roomId}:${a.day}:${p}`);
    }
  }

  const changes: OptimizationChange[] = [];
  const relocated = new Map<string, { day: HariSekolah; period: number }>();

  for (const a of problematic) {
    let placed = false;
    for (const day of scheduleModel.hariAktif) {
      const periods = slotsByDay.get(day) ?? [];
      for (const period of periods) {
        const tKey = `${a.teacherId}:${day}:${period}`;
        const cKey = `${a.classId}:${day}:${period}`;
        const rKey = a.roomId ? `${a.roomId}:${day}:${period}` : null;
        if (teacherOccupied.has(tKey) || classOccupied.has(cKey) || (rKey && roomOccupied.has(rKey))) continue;
        teacherOccupied.add(tKey);
        classOccupied.add(cKey);
        if (rKey) roomOccupied.add(rKey);
        relocated.set(a.id, { day, period });
        changes.push({
          assignmentId: a.id,
          from: { day: a.day, periodStart: a.periodStart, periodEnd: a.periodEnd },
          to: { day, periodStart: period, periodEnd: period },
        });
        placed = true;
        break;
      }
      if (placed) break;
    }
    if (!placed) {
      changes.push({ assignmentId: a.id, from: { day: a.day, periodStart: a.periodStart, periodEnd: a.periodEnd }, to: null });
    }
  }

  // Conflict SETELAH relokasi — divalidasi ulang lewat Conflict Engine asli
  // terhadap draft yang sudah dipindah (untuk yang gagal direlokasi, posisi
  // lama dipakai lagi supaya conflict lama tetap terlihat di summary).
  const remainingConflicts: Record<string, ScheduleConflict[]> = {};
  for (const a of target) {
    const moved = relocated.get(a.id);
    const draft = moved
      ? { ...assignmentToDraft(a), day: moved.day, periodStart: moved.period, periodEnd: moved.period }
      : assignmentToDraft(a);
    remainingConflicts[a.id] = await validateAssignmentCandidate(supabase, draft, a.id);
  }
  const afterConflictCount = Object.values(remainingConflicts).reduce((sum, c) => sum + c.filter((x) => x.blocking).length, 0);

  return { beforeConflictCount, afterConflictCount, changes, remainingConflicts };
}

/**
 * Menerapkan hasil optimizeCandidateBatch ke database — dipanggil TERPISAH,
 * hanya setelah user eksplisit memilih "Apply Optimization" (Bagian 24.4:
 * "User must explicitly choose: Keep Current / Apply Optimization").
 */
export async function applyOptimization(supabase: SupabaseClient, changes: OptimizationChange[]): Promise<void> {
  for (const change of changes) {
    if (!change.to) continue;
    const existing = await scheduleAssignmentRepository.findById(supabase, change.assignmentId);
    if (!existing) continue;
    const draft: ScheduleAssignmentDraft = {
      ...assignmentToDraft(existing),
      day: change.to.day,
      periodStart: change.to.periodStart,
      periodEnd: change.to.periodEnd,
    };
    await scheduleAssignmentRepository.update(supabase, change.assignmentId, draft);
  }
}
