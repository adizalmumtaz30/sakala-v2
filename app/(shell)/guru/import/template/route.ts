import { NextResponse } from "next/server";
import { buildControlledTemplateWorkbook, type ControlledTemplateColumn } from "@/lib/import/controlled-template";
import { bufferToBodyInit } from "@/lib/utils/response";

// Guru: template khusus Guru. Hanya struktur/format yang wajib dikontrol.
const columns: ControlledTemplateColumn[] = [
  { key: "NamaLengkap", required: true, format: "Teks, minimal 3 karakter", example: "Ahmad Fauzan" },
  { key: "KodeGuru", required: false, format: "Kosongkan agar dibuat otomatis oleh SAKALA", example: "" },
  { key: "NIP", required: false, format: "Teks", example: "" },
  { key: "NUPTK", required: false, format: "Teks", example: "" },
  { key: "Email", required: false, format: "Alamat email", example: "ahmad@sekolah.sch.id" },
  { key: "NomorTelepon", required: false, format: "Teks", example: "" },
  { key: "StatusAktif", required: false, format: '"aktif" atau "nonaktif" (default aktif)', example: "aktif" },
  { key: "JenisKelamin", required: false, format: '"L" (Laki-laki) atau "P" (Perempuan)', example: "" },
];

export async function GET() {
  const buffer = buildControlledTemplateWorkbook(columns, [
    ["Referensi StatusAktif"], ["aktif"], ["nonaktif"], [],
    ["Referensi JenisKelamin"], ["L"], ["P"],
  ], { module: "guru", label: "Guru", schemaVersion: "2.3" });

  return new NextResponse(bufferToBodyInit(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Template_Guru_SAKALA_V2.3.xlsx"',
    },
  });
}
