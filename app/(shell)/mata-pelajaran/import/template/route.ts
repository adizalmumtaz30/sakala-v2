import { NextResponse } from "next/server";
import { buildControlledTemplateWorkbook, type ControlledTemplateColumn } from "@/lib/import/controlled-template";
import { bufferToBodyInit } from "@/lib/utils/response";

const columns: ControlledTemplateColumn[] = [
  { key: "NamaMapel", required: true, format: "Teks, minimal 2 karakter", example: "Matematika" },
  { key: "KodeMapel", required: false, format: "Teks, unik jika diisi", example: "MAT" },
  { key: "TargetJPPerRombel", required: false, format: "Angka (jam pelajaran per minggu)", example: "4" },
  { key: "Kelompok", required: false, format: "Pilihan sesuai klasifikasi SAKALA", example: "Umum" },
  { key: "WarnaJadwal", required: false, format: "Hex #RRGGBB — preset tersedia di REFERENSI", example: "#6366F1" },
  { key: "PrioritasPenjadwalan", required: false, format: "tinggi / normal / rendah", example: "normal" },
  { key: "JenisMapel", required: false, format: "akademik / muatan_lokal / ekstrakurikuler / bimbingan_konseling", example: "akademik" },
  { key: "StatusAktif", required: false, format: '"aktif" atau "nonaktif"', example: "aktif" },
];

export async function GET() {
  const buffer = buildControlledTemplateWorkbook(columns, [
    ["Referensi StatusAktif"], ["aktif"], ["nonaktif"], [],
    ["Referensi PrioritasPenjadwalan"], ["tinggi"], ["normal"], ["rendah"], [],
    ["Referensi JenisMapel"], ["akademik"], ["muatan_lokal"], ["ekstrakurikuler"], ["bimbingan_konseling"], [],
    ["Referensi WarnaJadwal"], ["#6366F1"], ["#0EA5E9"], ["#10B981"], ["#F59E0B"], ["#EF4444"], ["#8B5CF6"],
  ], { module: "mata-pelajaran", label: "Mata Pelajaran", schemaVersion: "2.3" });

  return new NextResponse(bufferToBodyInit(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Template_Mapel_SAKALA_V2.3.xlsx"',
    },
  });
}
