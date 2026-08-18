import { NextResponse } from "next/server";
import { runSchedulingSolverRegression } from "@/lib/application/schedulingSolver";

export async function GET() {
  const result = runSchedulingSolverRegression();
  return NextResponse.json({
    service: "scheduling-solver",
    status: result.passed ? "PASS" : "FAIL",
    details: result.details,
    timestamp: new Date().toISOString(),
  }, { status: result.passed ? 200 : 500 });
}
