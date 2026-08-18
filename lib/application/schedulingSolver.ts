import type { HariSekolah } from "@/lib/domain/jamPelajaran";

export interface SolverRequirement {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  roomId: string | null;
  jpTarget: number;
}

export interface SolverSlot {
  day: HariSekolah;
  period: number;
}

export interface SolverOccupancy {
  teacherId: string;
  classId: string;
  roomId: string | null;
  day: HariSekolah;
  periodStart: number;
  periodEnd: number;
}

export interface SolverOptions {
  activeDays: HariSekolah[];
  slots: SolverSlot[];
  existing: SolverOccupancy[];
  roomMode: "wajib" | "opsional" | "tidak_dipakai";
  maxPeriodsPerClassPerDay: number;
  maxSearchNodes?: number;
}

export interface SolverPlacement extends SolverSlot {
  requirementId: string;
}

export interface SolverOutcome {
  requirementId: string;
  placed: number;
  unplaced: number;
  placements: SolverPlacement[];
}

export interface SolverResult {
  complete: boolean;
  placements: SolverPlacement[];
  outcomes: SolverOutcome[];
  searchNodes: number;
  reason: string | null;
}

type Unit = {
  unitId: string;
  requirementId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  roomId: string | null;
  ordinal: number;
};

function key(id: string, day: HariSekolah, period: number): string {
  return `${id}:${day}:${period}`;
}

function occupancyKeys(item: SolverOccupancy): string[] {
  const keys: string[] = [];
  for (let p = item.periodStart; p <= item.periodEnd; p += 1) {
    keys.push(key(item.teacherId, item.day, p));
    keys.push(key(`class:${item.classId}`, item.day, p));
    if (item.roomId) keys.push(key(`room:${item.roomId}`, item.day, p));
  }
  return keys;
}

function slotKey(slot: SolverSlot): string {
  return `${slot.day}:${slot.period}`;
}

function compareSlots(a: SolverSlot, b: SolverSlot): number {
  const dayOrder: Record<HariSekolah, number> = {
    senin: 0,
    selasa: 1,
    rabu: 2,
    kamis: 3,
    jumat: 4,
    sabtu: 5,
    minggu: 6,
  };
  return dayOrder[a.day] - dayOrder[b.day] || a.period - b.period;
}

/**
 * Full constraint solver for weekly scheduling.
 *
 * Hard constraints:
 * - only active teaching slots are supplied by the caller;
 * - teacher, class and (when enabled) room cannot overlap;
 * - class daily period cap is enforced;
 * - every requested JP is an individual scheduling unit;
 * - all requirements are solved together, with bounded backtracking and
 *   forward checking, so a late conflict can force an earlier choice to move.
 *
 * Soft objective, used only to order candidates:
 * - spread the same subject across days;
 * - balance each class across active days;
 * - avoid unnecessary consecutive periods for the same subject.
 */
export function solveWeeklySchedule(requirements: SolverRequirement[], options: SolverOptions): SolverResult {
  const maxSearchNodes = options.maxSearchNodes ?? 200_000;
  const activeDaySet = new Set(options.activeDays);
  const slots = options.slots.filter((s) => activeDaySet.has(s.day)).sort(compareSlots);
  const roomEnabled = options.roomMode !== "tidak_dipakai";

  if (requirements.length === 0) {
    return { complete: true, placements: [], outcomes: [], searchNodes: 0, reason: null };
  }
  if (slots.length === 0) {
    return {
      complete: false,
      placements: [],
      outcomes: requirements.map((r) => ({ requirementId: r.id, placed: 0, unplaced: r.jpTarget, placements: [] })),
      searchNodes: 0,
      reason: "Tidak ada slot pembelajaran aktif yang dapat digunakan.",
    };
  }

  const units: Unit[] = [];
  for (const req of requirements) {
    if (!Number.isInteger(req.jpTarget) || req.jpTarget < 1) {
      return {
        complete: false,
        placements: [],
        outcomes: requirements.map((r) => ({ requirementId: r.id, placed: 0, unplaced: Math.max(0, r.jpTarget), placements: [] })),
        searchNodes: 0,
        reason: `Target JP tidak valid untuk requirement ${req.id}.`,
      };
    }
    for (let ordinal = 0; ordinal < req.jpTarget; ordinal += 1) {
      units.push({
        unitId: `${req.id}#${ordinal + 1}`,
        requirementId: req.id,
        classId: req.classId,
        subjectId: req.subjectId,
        teacherId: req.teacherId,
        roomId: req.roomId,
        ordinal,
      });
    }
  }

  const teacherBusy = new Set<string>();
  const classBusy = new Set<string>();
  const roomBusy = new Set<string>();
  const classDayCount = new Map<string, number>();
  const subjectDayCount = new Map<string, number>();
  const placedByUnit = new Map<string, SolverSlot>();

  for (const existing of options.existing) {
    for (const occupied of occupancyKeys(existing)) {
      if (occupied.startsWith("class:")) classBusy.add(occupied);
      else if (occupied.startsWith("room:")) roomBusy.add(occupied);
      else teacherBusy.add(occupied);
    }
    for (let p = existing.periodStart; p <= existing.periodEnd; p += 1) {
      const classDayKey = `${existing.classId}:${existing.day}`;
      classDayCount.set(classDayKey, (classDayCount.get(classDayKey) ?? 0) + 1);
    }
  }

  const requirementById = new Map(requirements.map((r) => [r.id, r]));
  const domainCache = new Map<string, SolverSlot[]>();

  const isFree = (unit: Unit, slot: SolverSlot): boolean => {
    const teacherKey = key(unit.teacherId, slot.day, slot.period);
    const classKey = key(`class:${unit.classId}`, slot.day, slot.period);
    const roomKey = unit.roomId ? key(`room:${unit.roomId}`, slot.day, slot.period) : null;
    if (teacherBusy.has(teacherKey) || classBusy.has(classKey)) return false;
    if (roomEnabled && roomKey && roomBusy.has(roomKey)) return false;
    const classDayKey = `${unit.classId}:${slot.day}`;
    if ((classDayCount.get(classDayKey) ?? 0) >= options.maxPeriodsPerClassPerDay) return false;
    return true;
  };

  const scoreSlot = (unit: Unit, slot: SolverSlot): number => {
    let score = 0;
    const subjectDayKey = `${unit.classId}:${unit.subjectId}:${slot.day}`;
    const classDayKey = `${unit.classId}:${slot.day}`;
    const sameSubjectDay = subjectDayCount.get(subjectDayKey) ?? 0;
    const classDayLoad = classDayCount.get(classDayKey) ?? 0;
    score += sameSubjectDay * 100;
    score += classDayLoad * 8;

    const previous = placedByUnit.get(unit.unitId);
    if (previous && previous.day === slot.day && Math.abs(previous.period - slot.period) === 1) score += 15;

    const neighbors = slots.filter((candidate) => candidate.day === slot.day && Math.abs(candidate.period - slot.period) === 1);
    if (neighbors.some((neighbor) => {
      const match = [...placedByUnit.entries()].find(([, p]) => slotKey(p) === slotKey(neighbor));
      if (!match) return false;
      const matchedUnit = units.find((u) => u.unitId === match[0]);
      return matchedUnit?.classId === unit.classId && matchedUnit.subjectId === unit.subjectId;
    })) score += 20;

    return score;
  };

  const buildDomain = (unit: Unit): SolverSlot[] => {
    const cached = domainCache.get(unit.unitId);
    if (cached) return cached;
    const domain = slots.filter((slot) => isFree(unit, slot));
    domain.sort((a, b) => scoreSlot(unit, a) - scoreSlot(unit, b) || compareSlots(a, b));
    domainCache.set(unit.unitId, domain);
    return domain;
  };

  const assign = (unit: Unit, slot: SolverSlot) => {
    const teacherKey = key(unit.teacherId, slot.day, slot.period);
    const classKey = key(`class:${unit.classId}`, slot.day, slot.period);
    teacherBusy.add(teacherKey);
    classBusy.add(classKey);
    if (roomEnabled && unit.roomId) roomBusy.add(key(`room:${unit.roomId}`, slot.day, slot.period));
    const classDayKey = `${unit.classId}:${slot.day}`;
    classDayCount.set(classDayKey, (classDayCount.get(classDayKey) ?? 0) + 1);
    const subjectDayKey = `${unit.classId}:${unit.subjectId}:${slot.day}`;
    subjectDayCount.set(subjectDayKey, (subjectDayCount.get(subjectDayKey) ?? 0) + 1);
    placedByUnit.set(unit.unitId, slot);
  };

  const unassign = (unit: Unit, slot: SolverSlot) => {
    const teacherKey = key(unit.teacherId, slot.day, slot.period);
    const classKey = key(`class:${unit.classId}`, slot.day, slot.period);
    teacherBusy.delete(teacherKey);
    classBusy.delete(classKey);
    if (roomEnabled && unit.roomId) roomBusy.delete(key(`room:${unit.roomId}`, slot.day, slot.period));
    const classDayKey = `${unit.classId}:${slot.day}`;
    const classCount = (classDayCount.get(classDayKey) ?? 1) - 1;
    if (classCount > 0) classDayCount.set(classDayKey, classCount); else classDayCount.delete(classDayKey);
    const subjectDayKey = `${unit.classId}:${unit.subjectId}:${slot.day}`;
    const subjectCount = (subjectDayCount.get(subjectDayKey) ?? 1) - 1;
    if (subjectCount > 0) subjectDayCount.set(subjectDayKey, subjectCount); else subjectDayCount.delete(subjectDayKey);
    placedByUnit.delete(unit.unitId);
  };

  const remainingUnits = new Set(units.map((u) => u.unitId));
  let searchNodes = 0;

  const forwardCheck = (): boolean => {
    for (const unit of units) {
      if (!remainingUnits.has(unit.unitId)) continue;
      if (buildDomain(unit).length === 0) return false;
    }
    return true;
  };

  const chooseNextUnit = (): Unit | null => {
    let best: Unit | null = null;
    let bestSize = Number.POSITIVE_INFINITY;
    for (const unit of units) {
      if (!remainingUnits.has(unit.unitId)) continue;
      const size = buildDomain(unit).length;
      if (size < bestSize) {
        best = unit;
        bestSize = size;
        if (size <= 1) break;
      }
    }
    return best;
  };

  const search = (): boolean => {
    if (remainingUnits.size === 0) return true;
    if (searchNodes >= maxSearchNodes) return false;
    searchNodes += 1;

    const unit = chooseNextUnit();
    if (!unit) return true;
    const domain = buildDomain(unit);
    if (domain.length === 0) return false;

    for (const slot of domain) {
      if (searchNodes >= maxSearchNodes) return false;
      if (!isFree(unit, slot)) continue;
      assign(unit, slot);
      remainingUnits.delete(unit.unitId);
      domainCache.clear();

      if (forwardCheck() && search()) return true;

      remainingUnits.add(unit.unitId);
      unassign(unit, slot);
      domainCache.clear();
    }
    return false;
  };

  const complete = search();
  const placements: SolverPlacement[] = [];
  for (const unit of units) {
    const slot = placedByUnit.get(unit.unitId);
    if (slot) placements.push({ requirementId: unit.requirementId, day: slot.day, period: slot.period });
  }

  const outcomes: SolverOutcome[] = requirements.map((req) => {
    const reqPlacements = placements.filter((p) => p.requirementId === req.id);
    return { requirementId: req.id, placed: reqPlacements.length, unplaced: req.jpTarget - reqPlacements.length, placements: reqPlacements };
  });

  let reason: string | null = null;
  if (!complete) {
    const capacityFailures = outcomes.filter((o) => o.unplaced > 0).map((o) => `${o.requirementId}: kurang ${o.unplaced} JP`);
    reason = searchNodes >= maxSearchNodes
      ? `Batas pencarian solver tercapai (${maxSearchNodes.toLocaleString("id-ID")} node) sebelum solusi lengkap ditemukan.`
      : `Tidak ada solusi yang memenuhi seluruh hard constraint. ${capacityFailures.join("; ")}`;
  }

  return { complete, placements, outcomes, searchNodes, reason };
}

/** Deterministic regression fixture used by the production diagnostic endpoint. */
export function runSchedulingSolverSelfTest(): { passed: boolean; details: string[] } {
  const slots: SolverSlot[] = [];
  for (const day of ["senin", "selasa", "rabu"] as HariSekolah[]) {
    for (let period = 1; period <= 4; period += 1) slots.push({ day, period });
  }
  const result = solveWeeklySchedule(
    [
      { id: "r1", classId: "7A", subjectId: "math", teacherId: "t1", roomId: "r1", jpTarget: 3 },
      { id: "r2", classId: "7A", subjectId: "indo", teacherId: "t2", roomId: "r2", jpTarget: 3 },
      { id: "r3", classId: "8A", subjectId: "math", teacherId: "t1", roomId: "r3", jpTarget: 3 },
    ],
    { activeDays: ["senin", "selasa", "rabu"], slots, existing: [], roomMode: "wajib", maxPeriodsPerClassPerDay: 4 }
  );

  const conflictFree = result.complete && result.placements.length === 9;
  const teacherSlots = new Set(result.placements.map((p) => `${p.day}:${p.period}`));
  const noTeacherOverlap = teacherSlots.size === result.placements.length;

  const impossible = solveWeeklySchedule(
    [{ id: "impossible", classId: "7A", subjectId: "math", teacherId: "t1", roomId: null, jpTarget: 5 }],
    { activeDays: ["senin"], slots: [
      { day: "senin", period: 1 },
      { day: "senin", period: 2 },
    ], existing: [], roomMode: "tidak_dipakai", maxPeriodsPerClassPerDay: 2 }
  );

  const impossibleDetected = !impossible.complete && impossible.outcomes[0]?.unplaced === 5;
  return {
    passed: conflictFree && noTeacherOverlap && impossibleDetected,
    details: [
      `complete-fixture=${conflictFree ? "PASS" : "FAIL"}`,
      `teacher-overlap-check=${noTeacherOverlap ? "PASS" : "FAIL"}`,
      `infeasible-fixture=${impossibleDetected ? "PASS" : "FAIL"}`,
      `search-nodes=${result.searchNodes}`,
    ],
  };
}
