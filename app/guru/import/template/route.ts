import { NextResponse } from "next/server";
import { buildTemplateWorkbook, type TemplateColumn } from "@/lib/import/template";

// Template resmi Guru (Bagian 19-22): kolom wajib hanya NamaLengkap, sisanya opsional.
const columns: TemplateColumn[] = [
  { key: "NamaLengkap", required: true, format: "Teks, minimal 3 karakter", example: "Ahmad Fauzan" },
  { key: "KodeGuru", required: false, format: "Kosongkan agar dibuat otomatis oleh SAKALA", example: "" },
  { key: "NIP", required: false, format: "Teks", example: "" },
  { key: "NUPTK", required: false, format: "Teks", example: "" },
  { key: "Email", required: false, format: "Alamat email", example: "ahmad@sekolah.sch.id" },
  { key: "NomorTelepon", required: false, format: "Teks", example: "" },
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
      "Content-Disposition": 'attachment; filename="Template_Guru_SAKALA_V2.3.xlsx"',
    },
  });
}

