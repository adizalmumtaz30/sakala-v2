import { NextResponse } from "next/server";
import { solveWeeklySchedule } from "@/lib/application/schedulingSolver";
import type { HariSekolah } from "@/lib/domain/jamPelajaran";

export async function GET() {
  const slots = (["senin", "selasa", "rabu"] as HariSekolah[]).flatMap((day) =>
    [1, 2, 3, 4].map((period) => ({ day, period }))
  );
  const requirements = [
    { id: "r1", classId: "7A", subjectId: "math", teacherId: "t1", roomId: "r1", jpTarget: 3 },
    { id: "r2", classId: "7A", subjectId: "indo", teacherId: "t2", roomId: "r2", jpTarget: 3 },
    { id: "r3", classId: "8A", subjectId: "math", teacherId: "t1", roomId: "r3", jpTarget: 3 },
  ];
  const result = solveWeeklySchedule(requirements, {
    activeDays: ["senin", "selasa", "rabu"],
    slots,
    existing: [],
    roomMode: "wajib",
    maxPeriodsPerClassPerDay: 4,
  });

  const reqById = new Map(requirements.map((r) => [r.id, r]));
  const teacherKeys = result.placements.map((p) => {
    const req = reqById.get(p.requirementId)!;
    return `${req.teacherId}:${p.day}:${p.period}`;
  });
  const classKeys = result.placements.map((p) => {
    const req = reqById.get(p.requirementId)!;
    return `${req.classId}:${p.day}:${p.period}`;
  });
  const roomKeys = result.placements.map((p) => {
    const req = reqById.get(p.requirementId)!;
    return `${req.roomId}:${p.day}:${p.period}`;
  });
  const unique = (values: string[]) => new Set(values).size === values.length;

  const impossible = solveWeeklySchedule(
    [{ id: "impossible", classId: "7A", subjectId: "math", teacherId: "t1", roomId: null, jpTarget: 5 }],
    {
      activeDays: ["senin"],
      slots: [{ day: "senin", period: 1 }, { day: "senin", period: 2 }],
      existing: [],
      roomMode: "tidak_dipakai",
      maxPeriodsPerClassPerDay: 2,
    }
  );

  const checks = [
    ["complete-fixture", result.complete && result.placements.length === 9],
    ["teacher-overlap", unique(teacherKeys)],
    ["class-overlap", unique(classKeys)],
    ["room-overlap", unique(roomKeys)],
    ["infeasible-detected", !impossible.complete && impossible.outcomes[0]?.unplaced === 5],
  ] as const;
  const passed = checks.every(([, ok]) => ok);

  return NextResponse.json({
    service: "scheduling-solver",
    status: passed ? "PASS" : "FAIL",
    checks: Object.fromEntries(checks.map(([name, ok]) => [name, ok ? "PASS" : "FAIL"])),
    searchNodes: result.searchNodes,
    timestamp: new Date().toISOString(),
  }, { status: passed ? 200 : 500 });
}
