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
import { recordAuditEvent } from "@/lib/application/auditLog.usecases";
import type { AuditSource } from "@/lib/domain/auditLog";
import { validateGenerationRequirement } from "@/lib/domain/candidateGeneration";
import { validateAssignmentCandidate } from "@/lib/application/conflictEngine";
import type { ScheduleConflict } from "@/lib/domain/conflict";
import type { SolverFailureReason } from "@/lib/application/schedulingSolver";
import { solveWeeklySchedule } from "@/lib/application/schedulingSolver";

export interface GeneratedCandidate {
  requirementId: string;
  draft: ScheduleAssignmentDraft;
}

export interface GenerationResult {
  candidates: GeneratedCandidate[];
  outcomes: RequirementGenerationOutcome[];
  solver: { complete: boolean; searchNodes: number; reason: string | null; failures: SolverFailureReason[] };
}

function buildAvailableSlots(
  hariAktif: HariSekolah[],
  jamPelajaranList: { hari: HariSekolah; nomorUrut: number; jenis: string; status: string }[],
  slotTemplates: { hari: HariSekolah; nomorUrut: number; jenisSlot: string }[]
): { day: HariSekolah; period: number }[] {
  const fixedSet = new Set(
    slotTemplates
      .filter((s) => isFixedSlot(s.jenisSlot as Parameters<typeof isFixedSlot>[0]))
      .map((s) => `${s.hari}:${s.nomorUrut}`)
  );
  return hariAktif.flatMap((day) =>
    jamPelajaranList
      .filter((jp) => jp.hari === day && jp.jenis === "pembelajaran" && jp.status === "aktif")
      .filter((jp) => !fixedSet.has(`${day}:${jp.nomorUrut}`))
      .map((jp) => ({ day, period: jp.nomorUrut }))
  );
}

/** Full weekly CSP preview. Read-only: no committed/candidate row is mutated here. */
export async function generateCandidatePreview(
  supabase: SupabaseClient,
  academicContextId: string,
  scheduleModelId: string,
  requirements: GenerationRequirement[],
  options?: { includeActiveExisting?: boolean; committedOnly?: boolean }
): Promise<GenerationResult> {
  if (requirements.length === 0) {
    return { candidates: [], outcomes: [], solver: { complete: true, searchNodes: 0, reason: null, failures: [] } };
  }
  for (const req of requirements) validateGenerationRequirement(req);

  const [scheduleModel, jamPelajaranList, slotTemplates, existingAssignments] = await Promise.all([
    scheduleModelRepository.findById(supabase, scheduleModelId),
    jamPelajaranRepository.findByContext(supabase, academicContextId),
    slotTemplateRepository.findByModel(supabase, scheduleModelId),
    scheduleAssignmentRepository.findByContext(supabase, academicContextId),
  ]);

  if (!scheduleModel) throw new Error("Schedule Model tidak ditemukan.");
  if (scheduleModel.academicContextId !== academicContextId) {
    throw new Error("Schedule Model yang dipilih berasal dari konteks akademik yang berbeda.");
  }

  const slots = buildAvailableSlots(scheduleModel.hariAktif, jamPelajaranList, slotTemplates);
  const activeExisting = options?.includeActiveExisting === false
    ? []
    : existingAssignments.filter((a) => {
        if (a.status === "archived" || a.status === "cancelled") return false;
        if (options?.committedOnly) return a.status === "committed";
        return true;
      });

  const solverResult = solveWeeklySchedule(
    requirements.map((r) => ({
      id: r.id,
      classId: r.classId,
      subjectId: r.subjectId,
      teacherId: r.teacherId,
      roomId: r.roomId,
      jpTarget: r.jpTarget,
    })),
    {
      activeDays: scheduleModel.hariAktif,
      slots,
      existing: activeExisting.map((a) => ({
        teacherId: a.teacherId,
        classId: a.classId,
        roomId: a.roomId,
        day: a.day,
        periodStart: a.periodStart,
        periodEnd: a.periodEnd,
      })),
      roomMode: scheduleModel.modeRuangan,
      maxPeriodsPerClassPerDay: scheduleModel.maksJamPerHari,
      maxSearchNodes: 250_000,
    }
  );

  // Exact-JP invariant: an incomplete solve produces diagnostics only, never a partial candidate batch.
  const candidates: GeneratedCandidate[] = [];
  if (solverResult.complete) {
    for (const placement of solverResult.placements) {
      const req = requirements.find((r) => r.id === placement.requirementId);
      if (!req) continue;
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
  }

  const outcomes: RequirementGenerationOutcome[] = requirements.map((req) => {
    const result = solverResult.outcomes.find((o) => o.requirementId === req.id);
    const placements = (result?.placements ?? []).map((p) => ({ day: p.day, periodStart: p.period, periodEnd: p.period }));
    return {
      requirementId: req.id,
      classId: req.classId,
      subjectId: req.subjectId,
      teacherId: req.teacherId,
      jpTarget: req.jpTarget,
      placed: solverResult.complete ? placements.length : 0,
      unplaced: solverResult.complete ? req.jpTarget - placements.length : req.jpTarget,
      placements: solverResult.complete ? placements : [],
    };
  });

  return {
    candidates,
    outcomes,
    solver: {
      complete: solverResult.complete,
      searchNodes: solverResult.searchNodes,
      reason: solverResult.reason,
      failures: solverResult.failures,
    },
  };
}

/** Save is still an explicit transition for non-AI/manual workflows. */
export async function saveGeneratedCandidates(
  supabase: SupabaseClient,
  drafts: ScheduleAssignmentDraft[],
  source: AuditSource = "manual",
  reason?: string | null
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
    await recordAuditEvent({
      supabase,
      academicContextId: created.academicContextId,
      action: "create",
      entityType: "schedule_assignment",
      entityId: created.id,
      entityLabel: null,
      after: created,
      source,
      reason: reason ?? null,
    });
    saved.push(created);
  }
  return { saved, skipped };
}

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

/** Preview-only repair of currently conflicting candidate assignments. */
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
  const beforeConflicts: Record<string, ScheduleConflict[]> = {};
  for (const a of target) beforeConflicts[a.id] = await validateAssignmentCandidate(supabase, assignmentToDraft(a), a.id);
  const beforeConflictCount = Object.values(beforeConflicts).reduce((sum, c) => sum + c.filter((x) => x.blocking).length, 0);

  const slots = buildAvailableSlots(scheduleModel.hariAktif, jamPelajaranList, slotTemplates);
  const occupied = new Set<string>();
  const reserve = (a: ScheduleAssignment) => {
    for (let p = a.periodStart; p <= a.periodEnd; p += 1) {
      occupied.add(`${a.teacherId}:${a.day}:${p}`);
      occupied.add(`class:${a.classId}:${a.day}:${p}`);
      if (a.roomId && scheduleModel.modeRuangan !== "tidak_dipakai") occupied.add(`room:${a.roomId}:${a.day}:${p}`);
    }
  };
  others.forEach(reserve);
  target.filter((a) => !beforeConflicts[a.id]?.some((c) => c.blocking)).forEach(reserve);

  const changes: OptimizationChange[] = [];
  for (const a of target.filter((x) => beforeConflicts[x.id]?.some((c) => c.blocking))) {
    let moved: OptimizationChange["to"] = null;
    for (const slot of slots) {
      const keys = [
        `${a.teacherId}:${slot.day}:${slot.period}`,
        `class:${a.classId}:${slot.day}:${slot.period}`,
        ...(a.roomId && scheduleModel.modeRuangan !== "tidak_dipakai" ? [`room:${a.roomId}:${slot.day}:${slot.period}`] : []),
      ];
      if (keys.some((k) => occupied.has(k))) continue;
      moved = { day: slot.day, periodStart: slot.period, periodEnd: slot.period };
      keys.forEach((k) => occupied.add(k));
      break;
    }
    changes.push({ assignmentId: a.id, from: { day: a.day, periodStart: a.periodStart, periodEnd: a.periodEnd }, to: moved });
  }

  const remainingConflicts: Record<string, ScheduleConflict[]> = {};
  for (const a of target) {
    const change = changes.find((c) => c.assignmentId === a.id)?.to;
    const draft = change ? { ...assignmentToDraft(a), ...change } : assignmentToDraft(a);
    remainingConflicts[a.id] = await validateAssignmentCandidate(supabase, draft, a.id);
  }
  const afterConflictCount = Object.values(remainingConflicts).reduce((sum, c) => sum + c.filter((x) => x.blocking).length, 0);
  return { beforeConflictCount, afterConflictCount, changes, remainingConflicts };
}

/** Apply is deliberately separate from preview; never silently mutates committed state. */
export async function applyOptimization(supabase: SupabaseClient, changes: OptimizationChange[]): Promise<void> {
  for (const change of changes) {
    if (!change.to) continue;
    const existing = await scheduleAssignmentRepository.findById(supabase, change.assignmentId);
    if (!existing) continue;
    await scheduleAssignmentRepository.update(supabase, change.assignmentId, {
      ...assignmentToDraft(existing),
      day: change.to.day,
      periodStart: change.to.periodStart,
      periodEnd: change.to.periodEnd,
    });
  }
}
