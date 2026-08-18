import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import ReportDocument, { type PdfColumn, type PdfRow } from "@/lib/export/pdf/ReportDocument";

export const runtime = "nodejs";

function nowLabel() {
  return new Date().toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = String(body.title ?? "Laporan SAKALA");
    const schoolName = body.schoolName ? String(body.schoolName) : undefined;
    const periodLabel = body.periodLabel
      ? String(body.periodLabel)
      : body.context
        ? String(body.context)
        : undefined;
    const filterLabel = body.filterLabel ? String(body.filterLabel) : undefined;
    const columns: PdfColumn[] = Array.isArray(body.columns) ? body.columns : [];
    const rows: PdfRow[] = Array.isArray(body.rows) ? body.rows : [];
    const landscape = body.landscape !== undefined ? Boolean(body.landscape) : true;

    const buffer = await renderToBuffer(
      React.createElement(ReportDocument, {
        title,
        schoolName,
        periodLabel,
        filterLabel,
        generatedAt: nowLabel(),
        landscape,
        columns,
        rows,
      }),
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${title.replace(/[^a-z0-9]+/gi, "-")}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Export PDF gagal:", err);
    return NextResponse.json({ error: "PDF gagal dibuat" }, { status: 400 });
  }
}
