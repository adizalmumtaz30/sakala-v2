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

export interface SolverFailureReason {
  requirementId: string;
  code: "NO_SLOT" | "TEACHER_BUSY" | "CLASS_BUSY" | "ROOM_BUSY" | "DAILY_CAP" | "ROOM_REQUIRED" | "SEARCH_LIMIT";
  message: string;
  affectedSlots: number;
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
  failures: SolverFailureReason[];
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

type State = {
  teacherBusy: Set<string>;
  classBusy: Set<string>;
  roomBusy: Set<string>;
  classDayCount: Map<string, number>;
  subjectDayCount: Map<string, number>;
  placedByUnit: Map<string, SolverSlot>;
};

const DAY_ORDER: Record<HariSekolah, number> = {
  senin: 0,
  selasa: 1,
  rabu: 2,
  kamis: 3,
  jumat: 4,
  sabtu: 5,
  minggu: 6,
};

function key(id: string, day: HariSekolah, period: number): string {
  return `${id}:${day}:${period}`;
}

function slotKey(slot: SolverSlot): string {
  return `${slot.day}:${slot.period}`;
}

function compareSlots(a: SolverSlot, b: SolverSlot): number {
  return DAY_ORDER[a.day] - DAY_ORDER[b.day] || a.period - b.period;
}

function cloneState(state: State): State {
  return {
    teacherBusy: new Set(state.teacherBusy),
    classBusy: new Set(state.classBusy),
    roomBusy: new Set(state.roomBusy),
    classDayCount: new Map(state.classDayCount),
    subjectDayCount: new Map(state.subjectDayCount),
    placedByUnit: new Map(state.placedByUnit),
  };
}

function reserve(state: State, unit: Unit, slot: SolverSlot, roomEnabled: boolean): void {
  state.teacherBusy.add(key(unit.teacherId, slot.day, slot.period));
  state.classBusy.add(key(`class:${unit.classId}`, slot.day, slot.period));
  if (roomEnabled && unit.roomId) state.roomBusy.add(key(`room:${unit.roomId}`, slot.day, slot.period));
  const classDay = `${unit.classId}:${slot.day}`;
  state.classDayCount.set(classDay, (state.classDayCount.get(classDay) ?? 0) + 1);
  const subjectDay = `${unit.classId}:${unit.subjectId}:${slot.day}`;
  state.subjectDayCount.set(subjectDay, (state.subjectDayCount.get(subjectDay) ?? 0) + 1);
  state.placedByUnit.set(unit.unitId, slot);
}

function isFree(state: State, unit: Unit, slot: SolverSlot, options: SolverOptions): boolean {
  if (state.teacherBusy.has(key(unit.teacherId, slot.day, slot.period))) return false;
  if (state.classBusy.has(key(`class:${unit.classId}`, slot.day, slot.period))) return false;
  if (options.roomMode !== "tidak_dipakai" && unit.roomId && state.roomBusy.has(key(`room:${unit.roomId}`, slot.day, slot.period))) return false;
  if ((state.classDayCount.get(`${unit.classId}:${slot.day}`) ?? 0) >= options.maxPeriodsPerClassPerDay) return false;
  return true;
}

function explainEmptyDomain(unit: Unit, slots: SolverSlot[], state: State, options: SolverOptions): SolverFailureReason[] {
  const failures: SolverFailureReason[] = [];
  if (options.roomMode === "wajib" && !unit.roomId) {
    failures.push({ requirementId: unit.requirementId, code: "ROOM_REQUIRED", message: `Requirement ${unit.requirementId} membutuhkan ruangan karena mode ruangan = wajib.`, affectedSlots: slots.length });
    return failures;
  }
  let teacherBusy = 0;
  let classBusy = 0;
  let roomBusy = 0;
  let dailyCap = 0;
  for (const slot of slots) {
    if (state.teacherBusy.has(key(unit.teacherId, slot.day, slot.period))) teacherBusy += 1;
    else if (state.classBusy.has(key(`class:${unit.classId}`, slot.day, slot.period))) classBusy += 1;
    else if (options.roomMode !== "tidak_dipakai" && unit.roomId && state.roomBusy.has(key(`room:${unit.roomId}`, slot.day, slot.period))) roomBusy += 1;
    else if ((state.classDayCount.get(`${unit.classId}:${slot.day}`) ?? 0) >= options.maxPeriodsPerClassPerDay) dailyCap += 1;
  }
  const max = Math.max(1, slots.length);
  if (teacherBusy === slots.length) failures.push({ requirementId: unit.requirementId, code: "TEACHER_BUSY", message: `Semua ${max} slot kandidat berbenturan dengan guru ${unit.teacherId}.`, affectedSlots: teacherBusy });
  if (classBusy === slots.length) failures.push({ requirementId: unit.requirementId, code: "CLASS_BUSY", message: `Semua ${max} slot kandidat berbenturan dengan kelas ${unit.classId}.`, affectedSlots: classBusy });
  if (roomBusy === slots.length) failures.push({ requirementId: unit.requirementId, code: "ROOM_BUSY", message: `Semua ${max} slot kandidat berbenturan dengan ruangan ${unit.roomId}.`, affectedSlots: roomBusy });
  if (dailyCap > 0) failures.push({ requirementId: unit.requirementId, code: "DAILY_CAP", message: `${dailyCap} slot ditolak karena batas JP harian kelas ${unit.classId} tercapai.`, affectedSlots: dailyCap });
  if (failures.length === 0) failures.push({ requirementId: unit.requirementId, code: "NO_SLOT", message: `Tidak ada slot yang memenuhi seluruh constraint untuk requirement ${unit.requirementId}.`, affectedSlots: slots.length });
  return failures;
}

function buildInitialState(existing: SolverOccupancy[], roomEnabled: boolean): State {
  const state: State = {
    teacherBusy: new Set(),
    classBusy: new Set(),
    roomBusy: new Set(),
    classDayCount: new Map(),
    subjectDayCount: new Map(),
    placedByUnit: new Map(),
  };
  for (const item of existing) {
    for (let period = item.periodStart; period <= item.periodEnd; period += 1) {
      state.teacherBusy.add(key(item.teacherId, item.day, period));
      state.classBusy.add(key(`class:${item.classId}`, item.day, period));
      if (roomEnabled && item.roomId) state.roomBusy.add(key(`room:${item.roomId}`, item.day, period));
      const classDay = `${item.classId}:${item.day}`;
      state.classDayCount.set(classDay, (state.classDayCount.get(classDay) ?? 0) + 1);
    }
  }
  return state;
}

export function solveWeeklySchedule(requirements: SolverRequirement[], options: SolverOptions): SolverResult {
  const maxSearchNodes = options.maxSearchNodes ?? 200_000;
  const activeDays = new Set(options.activeDays);
  const slots = options.slots.filter((slot) => activeDays.has(slot.day)).sort(compareSlots);
  const roomEnabled = options.roomMode !== "tidak_dipakai";

  const emptyResult = (reason: string): SolverResult => ({
    complete: false,
    placements: [],
    outcomes: requirements.map((r) => ({ requirementId: r.id, placed: 0, unplaced: Math.max(0, r.jpTarget), placements: [] })),
    failures: requirements.map((r) => ({ requirementId: r.id, code: "NO_SLOT", message: reason, affectedSlots: slots.length })),
    searchNodes: 0,
    reason,
  });

  if (requirements.length === 0) return { complete: true, placements: [], outcomes: [], failures: [], searchNodes: 0, reason: null };
  if (options.maxPeriodsPerClassPerDay < 1) return emptyResult("Batas maksimum JP per hari harus minimal 1.");
  if (slots.length === 0) return emptyResult("Tidak ada slot pembelajaran aktif yang dapat digunakan.");

  const normalized = [...requirements].sort((a, b) => a.id.localeCompare(b.id));
  for (const req of normalized) {
    if (!Number.isInteger(req.jpTarget) || req.jpTarget < 1) return emptyResult(`Target JP tidak valid untuk requirement ${req.id}.`);
    if (options.roomMode === "wajib" && !req.roomId) return emptyResult(`Requirement ${req.id} tidak memiliki ruangan pada mode ruangan wajib.`);
  }

  const units: Unit[] = normalized.flatMap((req) =>
    Array.from({ length: req.jpTarget }, (_, index) => ({
      unitId: `${req.id}#${index + 1}`,
      requirementId: req.id,
      classId: req.classId,
      subjectId: req.subjectId,
      teacherId: req.teacherId,
      roomId: req.roomId,
      ordinal: index,
    }))
  );

  const initial = buildInitialState(options.existing, roomEnabled);
  const candidateDomain = (unit: Unit, state: State): SolverSlot[] => slots.filter((slot) => isFree(state, unit, slot, options));
  const score = (unit: Unit, slot: SolverSlot, state: State): number => {
    const subjectDay = state.subjectDayCount.get(`${unit.classId}:${unit.subjectId}:${slot.day}`) ?? 0;
    const classDay = state.classDayCount.get(`${unit.classId}:${slot.day}`) ?? 0;
    return subjectDay * 100 + classDay * 10;
  };

  let searchNodes = 0;
  let bestState: State | null = null;
  let bestPlaced = 0;
  let terminalFailures: SolverFailureReason[] = [];

  const search = (state: State, remaining: Unit[]): boolean => {
    if (remaining.length === 0) {
      bestState = state;
      return true;
    }
    if (searchNodes >= maxSearchNodes) return false;
    searchNodes += 1;

    const domains = remaining.map((unit) => ({ unit, domain: candidateDomain(unit, state) }));
    const empty = domains.find((entry) => entry.domain.length === 0);
    if (empty) {
      terminalFailures = explainEmptyDomain(empty.unit, slots, state, options);
      bestPlaced = Math.max(bestPlaced, units.length - remaining.length);
      return false;
    }

    domains.sort((a, b) => a.domain.length - b.domain.length || a.unit.unitId.localeCompare(b.unit.unitId));
    const selected = domains[0];
    const orderedSlots = [...selected.domain].sort((a, b) => score(selected.unit, a, state) - score(selected.unit, b, state) || compareSlots(a, b));

    for (const slot of orderedSlots) {
      if (searchNodes >= maxSearchNodes) return false;
      const next = cloneState(state);
      reserve(next, selected.unit, slot, roomEnabled);
      const nextRemaining = remaining.filter((u) => u.unitId !== selected.unit.unitId);
      const feasible = search(next, nextRemaining);
      if (feasible) return true;
      bestPlaced = Math.max(bestPlaced, units.length - nextRemaining.length);
    }
    return false;
  };

  const complete = search(initial, units);
  const finalState = complete ? bestState : null;
  const placements: SolverPlacement[] = [];
  if (finalState) {
    for (const unit of units) {
      const slot = finalState.placedByUnit.get(unit.unitId);
      if (slot) placements.push({ requirementId: unit.requirementId, day: slot.day, period: slot.period });
    }
  }

  const outcomes = normalized.map((req) => {
    const reqPlacements = placements.filter((placement) => placement.requirementId === req.id);
    return { requirementId: req.id, placed: reqPlacements.length, unplaced: req.jpTarget - reqPlacements.length, placements: reqPlacements };
  });

  if (complete) return { complete: true, placements, outcomes, failures: [], searchNodes, reason: null };

  const failures = searchNodes >= maxSearchNodes
    ? normalized.map((req) => ({ requirementId: req.id, code: "SEARCH_LIMIT" as const, message: `Batas pencarian ${maxSearchNodes.toLocaleString("id-ID")} node tercapai sebelum semua JP dapat ditempatkan.`, affectedSlots: slots.length }))
    : terminalFailures.length > 0 ? terminalFailures : normalized.map((req) => ({ requirementId: req.id, code: "NO_SLOT" as const, message: `Tidak ditemukan kombinasi slot yang memenuhi seluruh constraint.`, affectedSlots: slots.length }));

  return {
    complete: false,
    // Partial placements are diagnostic only. Candidate generation must reject them when incomplete.
    placements: [],
    outcomes: normalized.map((req) => ({ requirementId: req.id, placed: 0, unplaced: req.jpTarget, placements: [] })),
    failures,
    searchNodes,
    reason: searchNodes >= maxSearchNodes
      ? `Batas pencarian solver tercapai (${maxSearchNodes.toLocaleString("id-ID")} node). Jadwal tidak dianggap feasible.`
      : `Tidak ada solusi yang memenuhi seluruh hard constraint. ${failures.map((f) => f.message).join(" ")}`,
  };
}

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(`Scheduling solver regression failed: ${label}`);
}

function baseSlots(days: HariSekolah[] = ["senin", "selasa", "rabu"]): SolverSlot[] {
  return days.flatMap((day) => [1, 2, 3, 4].map((period) => ({ day, period })));
}

export function runSchedulingSolverRegression(): { passed: boolean; details: string[] } {
  const details: string[] = [];
  const run = (label: string, fn: () => void) => {
    try { fn(); details.push(`${label}=PASS`); } catch (error) { details.push(`${label}=FAIL:${error instanceof Error ? error.message : String(error)}`); }
  };

  run("feasible-exact-jp", () => {
    const result = solveWeeklySchedule([
      { id: "a", classId: "7A", subjectId: "math", teacherId: "t1", roomId: "r1", jpTarget: 3 },
      { id: "b", classId: "8A", subjectId: "indo", teacherId: "t2", roomId: "r2", jpTarget: 2 },
    ], { activeDays: ["senin", "selasa", "rabu"], slots: baseSlots(), existing: [], roomMode: "wajib", maxPeriodsPerClassPerDay: 4 });
    assert(result.complete && result.outcomes.every((o) => o.unplaced === 0), "exact JP");
  });

  run("teacher-clash", () => {
    const result = solveWeeklySchedule([
      { id: "a", classId: "7A", subjectId: "math", teacherId: "t1", roomId: "r1", jpTarget: 2 },
      { id: "b", classId: "8A", subjectId: "indo", teacherId: "t1", roomId: "r2", jpTarget: 2 },
    ], { activeDays: ["senin"], slots: [{ day: "senin", period: 1 }, { day: "senin", period: 2 }, { day: "senin", period: 3 }, { day: "senin", period: 4 }], existing: [], roomMode: "wajib", maxPeriodsPerClassPerDay: 4 });
    assert(result.complete, "teacher clash solved without overlap");
    const used = result.placements.map((p) => { const r = p.requirementId === "a" ? "t1" : "t1"; return `${r}:${slotKey(p)}`; });
    assert(new Set(used).size === used.length, "teacher uniqueness");
  });

  run("class-clash", () => {
    const result = solveWeeklySchedule([
      { id: "a", classId: "7A", subjectId: "math", teacherId: "t1", roomId: "r1", jpTarget: 2 },
      { id: "b", classId: "7A", subjectId: "indo", teacherId: "t2", roomId: "r2", jpTarget: 2 },
    ], { activeDays: ["senin"], slots: baseSlots(["senin"]), existing: [], roomMode: "wajib", maxPeriodsPerClassPerDay: 4 });
    assert(result.complete, "class clash solved");
    const used = result.placements.map((p) => `7A:${slotKey(p)}`);
    assert(new Set(used).size === used.length, "class uniqueness");
  });

  run("room-clash", () => {
    const result = solveWeeklySchedule([
      { id: "a", classId: "7A", subjectId: "math", teacherId: "t1", roomId: "r1", jpTarget: 2 },
      { id: "b", classId: "8A", subjectId: "indo", teacherId: "t2", roomId: "r1", jpTarget: 2 },
    ], { activeDays: ["senin"], slots: baseSlots(["senin"]), existing: [], roomMode: "wajib", maxPeriodsPerClassPerDay: 4 });
    assert(result.complete, "room clash solved");
    const used = result.placements.map((p) => `r1:${slotKey(p)}`);
    assert(new Set(used).size === used.length, "room uniqueness");
  });

  run("daily-cap", () => {
    const result = solveWeeklySchedule([{ id: "a", classId: "7A", subjectId: "math", teacherId: "t1", roomId: "r1", jpTarget: 3 }], { activeDays: ["senin"], slots: baseSlots(["senin"]), existing: [], roomMode: "wajib", maxPeriodsPerClassPerDay: 2 });
    assert(!result.complete && result.failures.some((f) => f.code === "DAILY_CAP" || f.code === "NO_SLOT"), "daily cap detected");
  });

  run("insufficient-slots", () => {
    const result = solveWeeklySchedule([{ id: "a", classId: "7A", subjectId: "math", teacherId: "t1", roomId: null, jpTarget: 3 }], { activeDays: ["senin"], slots: [{ day: "senin", period: 1 }, { day: "senin", period: 2 }], existing: [], roomMode: "tidak_dipakai", maxPeriodsPerClassPerDay: 4 });
    assert(!result.complete && result.outcomes[0].unplaced === 3, "insufficient slots detected");
  });

  run("existing-occupancy", () => {
    const result = solveWeeklySchedule([{ id: "a", classId: "7A", subjectId: "math", teacherId: "t1", roomId: "r1", jpTarget: 1 }], { activeDays: ["senin"], slots: baseSlots(["senin"]), existing: [{ teacherId: "t1", classId: "8A", roomId: "r1", day: "senin", periodStart: 1, periodEnd: 1 }], roomMode: "wajib", maxPeriodsPerClassPerDay: 4 });
    assert(result.complete && result.placements[0].period !== 1, "existing occupancy respected");
  });

  run("backtracking", () => {
    const result = solveWeeklySchedule([
      { id: "a", classId: "7A", subjectId: "math", teacherId: "t1", roomId: "r1", jpTarget: 2 },
      { id: "b", classId: "8A", subjectId: "indo", teacherId: "t1", roomId: "r2", jpTarget: 2 },
    ], { activeDays: ["senin", "selasa"], slots: [{ day: "senin", period: 1 }, { day: "senin", period: 2 }, { day: "selasa", period: 1 }, { day: "selasa", period: 2 }], existing: [], roomMode: "wajib", maxPeriodsPerClassPerDay: 2 });
    assert(result.complete && result.placements.length === 4, "backtracking finds complete solution");
  });

  return { passed: details.length > 0 && details.every((detail) => detail.includes("=PASS")), details };
}
