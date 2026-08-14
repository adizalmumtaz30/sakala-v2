import { NextResponse } from "next/server";
import { buildTemplateWorkbook, type TemplateColumn } from "@/lib/import/template";

// Template resmi Mata Pelajaran (Bagian 33-34).
const columns: TemplateColumn[] = [
  { key: "NamaMapel", required: true, format: "Teks, minimal 2 karakter", example: "Matematika" },
  { key: "KodeMapel", required: false, format: "Teks, unik jika diisi", example: "MAT" },
  { key: "TargetJPPerRombel", required: false, format: "Angka (jam pelajaran per minggu)", example: "4" },
  { key: "StatusAktif", required: false, format: '"aktif" atau "nonaktif" (default aktif)', example: "aktif" },
];

export async function GET() {
  const buffer = buildTemplateWorkbook(columns, [
    ["Referensi StatusAktif"],
    ["aktif"],
    ["nonaktif"],
  ]);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Template_Mapel_SAKALA_V2.3.xlsx"',
    },
  });
}

