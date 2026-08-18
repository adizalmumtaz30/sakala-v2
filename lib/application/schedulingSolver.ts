import type { HariSekolah } from "@/lib/domain/jamPelajaran";

export interface SolverRequirement { id: string; classId: string; subjectId: string; teacherId: string; roomId: string | null; jpTarget: number; }
export interface SolverSlot { day: HariSekolah; period: number; }
export interface SolverOccupancy { teacherId: string; classId: string; roomId: string | null; day: HariSekolah; periodStart: number; periodEnd: number; }
export interface SolverOptions { activeDays: HariSekolah[]; slots: SolverSlot[]; existing: SolverOccupancy[]; roomMode: "wajib" | "opsional" | "tidak_dipakai"; maxPeriodsPerClassPerDay: number; maxSearchNodes?: number; }
export interface SolverPlacement extends SolverSlot { requirementId: string; }
export interface SolverFailureReason { requirementId: string; code: "NO_SLOT" | "TEACHER_BUSY" | "CLASS_BUSY" | "ROOM_BUSY" | "DAILY_CAP" | "ROOM_REQUIRED" | "SEARCH_LIMIT"; message: string; affectedSlots: number; }
export interface SolverOutcome { requirementId: string; placed: number; unplaced: number; placements: SolverPlacement[]; }
export interface SolverResult { complete: boolean; placements: SolverPlacement[]; outcomes: SolverOutcome[]; failures: SolverFailureReason[]; searchNodes: number; reason: string | null; }

type Unit = { unitId: string; requirementId: string; classId: string; subjectId: string; teacherId: string; roomId: string | null; };
type State = { teacher: Set<string>; class: Set<string>; room: Set<string>; dayLoad: Map<string, number>; subjectDay: Map<string, number>; placements: Map<string, SolverSlot>; };

const DAY: Record<HariSekolah, number> = { senin: 0, selasa: 1, rabu: 2, kamis: 3, jumat: 4, sabtu: 5, minggu: 6 };
const sk = (s: SolverSlot) => `${s.day}:${s.period}`;
const key = (id: string, day: HariSekolah, period: number) => `${id}:${day}:${period}`;
const compare = (a: SolverSlot, b: SolverSlot) => DAY[a.day] - DAY[b.day] || a.period - b.period;
const clone = (s: State): State => ({ teacher: new Set(s.teacher), class: new Set(s.class), room: new Set(s.room), dayLoad: new Map(s.dayLoad), subjectDay: new Map(s.subjectDay), placements: new Map(s.placements) });

function initialState(existing: SolverOccupancy[], roomEnabled: boolean): State {
  const s: State = { teacher: new Set(), class: new Set(), room: new Set(), dayLoad: new Map(), subjectDay: new Map(), placements: new Map() };
  for (const a of existing) for (let p = a.periodStart; p <= a.periodEnd; p++) {
    s.teacher.add(key(a.teacherId, a.day, p)); s.class.add(key(`class:${a.classId}`, a.day, p));
    if (roomEnabled && a.roomId) s.room.add(key(`room:${a.roomId}`, a.day, p));
    const k = `${a.classId}:${a.day}`; s.dayLoad.set(k, (s.dayLoad.get(k) ?? 0) + 1);
  }
  return s;
}

function free(s: State, u: Unit, slot: SolverSlot, o: SolverOptions): boolean {
  if (s.teacher.has(key(u.teacherId, slot.day, slot.period))) return false;
  if (s.class.has(key(`class:${u.classId}`, slot.day, slot.period))) return false;
  if (o.roomMode !== "tidak_dipakai" && u.roomId && s.room.has(key(`room:${u.roomId}`, slot.day, slot.period))) return false;
  return (s.dayLoad.get(`${u.classId}:${slot.day}`) ?? 0) < o.maxPeriodsPerClassPerDay;
}

function reserve(s: State, u: Unit, slot: SolverSlot, roomEnabled: boolean): void {
  s.teacher.add(key(u.teacherId, slot.day, slot.period)); s.class.add(key(`class:${u.classId}`, slot.day, slot.period));
  if (roomEnabled && u.roomId) s.room.add(key(`room:${u.roomId}`, slot.day, slot.period));
  const d = `${u.classId}:${slot.day}`; s.dayLoad.set(d, (s.dayLoad.get(d) ?? 0) + 1);
  const sd = `${u.classId}:${u.subjectId}:${slot.day}`; s.subjectDay.set(sd, (s.subjectDay.get(sd) ?? 0) + 1); s.placements.set(u.unitId, slot);
}

function explain(u: Unit, slots: SolverSlot[], s: State, o: SolverOptions): SolverFailureReason[] {
  if (o.roomMode === "wajib" && !u.roomId) return [{ requirementId: u.requirementId, code: "ROOM_REQUIRED", message: `Requirement ${u.requirementId} tidak memiliki ruangan pada mode ruangan wajib.`, affectedSlots: slots.length }];
  let t = 0, c = 0, r = 0, d = 0;
  for (const slot of slots) {
    if (s.teacher.has(key(u.teacherId, slot.day, slot.period))) t++;
    if (s.class.has(key(`class:${u.classId}`, slot.day, slot.period))) c++;
    if (o.roomMode !== "tidak_dipakai" && u.roomId && s.room.has(key(`room:${u.roomId}`, slot.day, slot.period))) r++;
    if ((s.dayLoad.get(`${u.classId}:${slot.day}`) ?? 0) >= o.maxPeriodsPerClassPerDay) d++;
  }
  const out: SolverFailureReason[] = [];
  if (t === slots.length) out.push({ requirementId: u.requirementId, code: "TEACHER_BUSY", message: `Semua slot kandidat bentrok dengan guru ${u.teacherId}.`, affectedSlots: t });
  if (c === slots.length) out.push({ requirementId: u.requirementId, code: "CLASS_BUSY", message: `Semua slot kandidat bentrok dengan kelas ${u.classId}.`, affectedSlots: c });
  if (r === slots.length) out.push({ requirementId: u.requirementId, code: "ROOM_BUSY", message: `Semua slot kandidat bentrok dengan ruangan ${u.roomId}.`, affectedSlots: r });
  if (d === slots.length) out.push({ requirementId: u.requirementId, code: "DAILY_CAP", message: `Semua slot kandidat ditolak karena batas JP harian kelas ${u.classId} tercapai.`, affectedSlots: d });
  if (!out.length) out.push({ requirementId: u.requirementId, code: "NO_SLOT", message: `Tidak ada slot yang memenuhi seluruh constraint untuk ${u.requirementId}.`, affectedSlots: slots.length });
  return out;
}

export function solveWeeklySchedule(requirements: SolverRequirement[], options: SolverOptions): SolverResult {
  const limit = options.maxSearchNodes ?? 200_000;
  const active = new Set(options.activeDays);
  const slots = options.slots.filter((s) => active.has(s.day)).sort(compare);
  const roomEnabled = options.roomMode !== "tidak_dipakai";
  const failAll = (message: string): SolverResult => ({ complete: false, placements: [], outcomes: requirements.map(r => ({ requirementId: r.id, placed: 0, unplaced: Math.max(0, r.jpTarget), placements: [] })), failures: requirements.map(r => ({ requirementId: r.id, code: "NO_SLOT", message, affectedSlots: slots.length })), searchNodes: 0, reason: message });
  if (!requirements.length) return { complete: true, placements: [], outcomes: [], failures: [], searchNodes: 0, reason: null };
  if (options.maxPeriodsPerClassPerDay < 1) return failAll("Batas maksimum JP per hari harus minimal 1.");
  if (!slots.length) return failAll("Tidak ada slot pembelajaran aktif yang dapat digunakan.");

  const reqs = [...requirements].sort((a, b) => a.id.localeCompare(b.id));
  for (const r of reqs) {
    if (!Number.isInteger(r.jpTarget) || r.jpTarget < 1) return failAll(`Target JP tidak valid untuk requirement ${r.id}.`);
    if (options.roomMode === "wajib" && !r.roomId) return failAll(`Requirement ${r.id} tidak memiliki ruangan pada mode ruangan wajib.`);
  }
  const units: Unit[] = reqs.flatMap(r => Array.from({ length: r.jpTarget }, (_, i) => ({ unitId: `${r.id}#${i + 1}`, requirementId: r.id, classId: r.classId, subjectId: r.subjectId, teacherId: r.teacherId, roomId: r.roomId })));
  const start = initialState(options.existing, roomEnabled);
  const domain = (u: Unit, s: State) => slots.filter(slot => free(s, u, slot, options));
  const score = (u: Unit, slot: SolverSlot, s: State) => (s.subjectDay.get(`${u.classId}:${u.subjectId}:${slot.day}`) ?? 0) * 100 + (s.dayLoad.get(`${u.classId}:${slot.day}`) ?? 0) * 10;
  let nodes = 0; let terminal: SolverFailureReason[] = [];

  const search = (state: State, remaining: Unit[]): State | null => {
    if (!remaining.length) return state;
    if (nodes >= limit) return null;
    nodes++;
    const domains = remaining.map(u => ({ u, d: domain(u, state) }));
    const empty = domains.find(x => !x.d.length);
    if (empty) { terminal = explain(empty.u, slots, state, options); return null; }
    domains.sort((a, b) => a.d.length - b.d.length || a.u.unitId.localeCompare(b.u.unitId));
    const chosen = domains[0];
    const ordered = [...chosen.d].sort((a, b) => score(chosen.u, a, state) - score(chosen.u, b, state) || compare(a, b));
    for (const slot of ordered) {
      if (nodes >= limit) return null;
      const next = clone(state); reserve(next, chosen.u, slot, roomEnabled);
      const result = search(next, remaining.filter(u => u.unitId !== chosen.u.unitId));
      if (result) return result;
    }
    return null;
  };

  const solved = search(start, units);
  if (!solved) {
    const failures = nodes >= limit ? reqs.map(r => ({ requirementId: r.id, code: "SEARCH_LIMIT" as const, message: `Batas pencarian ${limit.toLocaleString("id-ID")} node tercapai.`, affectedSlots: slots.length })) : (terminal.length ? terminal : reqs.map(r => ({ requirementId: r.id, code: "NO_SLOT" as const, message: "Tidak ditemukan kombinasi slot yang memenuhi seluruh hard constraint.", affectedSlots: slots.length })));
    return { complete: false, placements: [], outcomes: reqs.map(r => ({ requirementId: r.id, placed: 0, unplaced: r.jpTarget, placements: [] })), failures, searchNodes: nodes, reason: failures.map(f => f.message).join(" ") };
  }

  const placements: SolverPlacement[] = units.map(u => ({ requirementId: u.requirementId, ...(solved.placements.get(u.unitId) as SolverSlot) }));
  const outcomes = reqs.map(r => { const p = placements.filter(x => x.requirementId === r.id); return { requirementId: r.id, placed: p.length, unplaced: r.jpTarget - p.length, placements: p }; });
  return { complete: true, placements, outcomes, failures: [], searchNodes: nodes, reason: null };
}

function assert(condition: boolean, label: string): void { if (!condition) throw new Error(`FAIL: ${label}`); }
function regressionSlots(days: HariSekolah[] = ["senin", "selasa", "rabu"]): SolverSlot[] { return days.flatMap(day => [1,2,3,4].map(period => ({ day, period }))); }

export function runSchedulingSolverRegression(): { passed: boolean; details: string[] } {
  const details: string[] = [];
  const test = (name: string, fn: () => void) => { try { fn(); details.push(`${name}=PASS`); } catch (e) { details.push(`${name}=FAIL:${e instanceof Error ? e.message : String(e)}`); } };
  test("feasible-exact-jp", () => { const r = solveWeeklySchedule([{id:"a",classId:"7A",subjectId:"m",teacherId:"t1",roomId:"r1",jpTarget:3},{id:"b",classId:"8A",subjectId:"i",teacherId:"t2",roomId:"r2",jpTarget:2}],{activeDays:["senin","selasa","rabu"],slots:regressionSlots(),existing:[],roomMode:"wajib",maxPeriodsPerClassPerDay:4}); assert(r.complete && r.outcomes.every(x=>x.unplaced===0),"exact JP"); });
  test("teacher-clash", () => { const r = solveWeeklySchedule([{id:"a",classId:"7A",subjectId:"m",teacherId:"t1",roomId:"r1",jpTarget:2},{id:"b",classId:"8A",subjectId:"i",teacherId:"t1",roomId:"r2",jpTarget:2}],{activeDays:["senin"],slots:regressionSlots(["senin"]),existing:[],roomMode:"wajib",maxPeriodsPerClassPerDay:4}); assert(r.complete,"teacher clash"); const k=r.placements.map(p=>`t1:${sk(p)}`); assert(new Set(k).size===k.length,"teacher overlap"); });
  test("class-clash", () => { const r = solveWeeklySchedule([{id:"a",classId:"7A",subjectId:"m",teacherId:"t1",roomId:"r1",jpTarget:2},{id:"b",classId:"7A",subjectId:"i",teacherId:"t2",roomId:"r2",jpTarget:2}],{activeDays:["senin"],slots:regressionSlots(["senin"]),existing:[],roomMode:"wajib",maxPeriodsPerClassPerDay:4}); assert(r.complete,"class clash"); const k=r.placements.map(p=>`7A:${sk(p)}`); assert(new Set(k).size===k.length,"class overlap"); });
  test("room-clash", () => { const r = solveWeeklySchedule([{id:"a",classId:"7A",subjectId:"m",teacherId:"t1",roomId:"r1",jpTarget:2},{id:"b",classId:"8A",subjectId:"i",teacherId:"t2",roomId:"r1",jpTarget:2}],{activeDays:["senin"],slots:regressionSlots(["senin"]),existing:[],roomMode:"wajib",maxPeriodsPerClassPerDay:4}); assert(r.complete,"room clash"); const k=r.placements.map(p=>`r1:${sk(p)}`); assert(new Set(k).size===k.length,"room overlap"); });
  test("daily-cap", () => { const r=solveWeeklySchedule([{id:"a",classId:"7A",subjectId:"m",teacherId:"t1",roomId:"r1",jpTarget:3}],{activeDays:["senin"],slots:regressionSlots(["senin"]),existing:[],roomMode:"wajib",maxPeriodsPerClassPerDay:2}); assert(!r.complete && r.failures.length>0,"daily cap"); });
  test("insufficient-slots", () => { const r=solveWeeklySchedule([{id:"a",classId:"7A",subjectId:"m",teacherId:"t1",roomId:null,jpTarget:3}],{activeDays:["senin"],slots:[{day:"senin",period:1},{day:"senin",period:2}],existing:[],roomMode:"tidak_dipakai",maxPeriodsPerClassPerDay:4}); assert(!r.complete && r.outcomes[0].unplaced===3,"insufficient slots"); });
  test("existing-occupancy", () => { const r=solveWeeklySchedule([{id:"a",classId:"7A",subjectId:"m",teacherId:"t1",roomId:"r1",jpTarget:1}],{activeDays:["senin"],slots:regressionSlots(["senin"]),existing:[{teacherId:"t1",classId:"8A",roomId:"r1",day:"senin",periodStart:1,periodEnd:1}],roomMode:"wajib",maxPeriodsPerClassPerDay:4}); assert(r.complete && r.placements[0].period!==1,"existing occupancy"); });
  test("backtracking", () => { const r=solveWeeklySchedule([{id:"a",classId:"7A",subjectId:"m",teacherId:"t1",roomId:"r1",jpTarget:2},{id:"b",classId:"8A",subjectId:"i",teacherId:"t1",roomId:"r2",jpTarget:2}],{activeDays:["senin","selasa"],slots:[{day:"senin",period:1},{day:"senin",period:2},{day:"selasa",period:1},{day:"selasa",period:2}],existing:[],roomMode:"wajib",maxPeriodsPerClassPerDay:2}); assert(r.complete && r.placements.length===4,"backtracking"); });
  return { passed: details.length === 8 && details.every(x=>x.includes("=PASS")), details };
}
