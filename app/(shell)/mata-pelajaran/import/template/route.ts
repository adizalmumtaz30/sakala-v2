import { NextResponse } from "next/server";
import { buildTemplateWorkbook, type TemplateColumn } from "@/lib/import/template";
import { bufferToBodyInit } from "@/lib/utils/response";

// Template resmi Mata Pelajaran (Bagian 33-34), diperluas Pack 09b (lanjutan)
// dengan Kelompok, WarnaJadwal, PrioritasPenjadwalan, JenisMapel — semua opsional.
const columns: TemplateColumn[] = [
  { key: "NamaMapel", required: true, format: "Teks, minimal 2 karakter", example: "Matematika" },
  { key: "KodeMapel", required: false, format: "Teks, unik jika diisi", example: "MAT" },
  { key: "TargetJPPerRombel", required: false, format: "Angka (jam pelajaran per minggu)", example: "4" },
  { key: "Kelompok", required: false, format: "Teks bebas, mis. Umum / Peminatan", example: "Umum" },
  { key: "WarnaJadwal", required: false, format: "Hex #RRGGBB — lihat sheet REFERENSI", example: "#6366F1" },
  {
    key: "PrioritasPenjadwalan",
    required: false,
    format: "tinggi / normal / rendah (default normal)",
    example: "normal",
  },
  {
    key: "JenisMapel",
    required: false,
    format: "akademik / muatan_lokal / ekstrakurikuler / bimbingan_konseling",
    example: "akademik",
  },
  { key: "StatusAktif", required: false, format: '"aktif" atau "nonaktif" (default aktif)', example: "aktif" },
];

export async function GET() {
  const buffer = buildTemplateWorkbook(columns, [
    ["Referensi StatusAktif"],
    ["aktif"],
    ["nonaktif"],
    [],
    ["Referensi PrioritasPenjadwalan"],
    ["tinggi"],
    ["normal"],
    ["rendah"],
    [],
    ["Referensi JenisMapel"],
    ["akademik"],
    ["muatan_lokal"],
    ["ekstrakurikuler"],
    ["bimbingan_konseling"],
    [],
    ["Referensi WarnaJadwal (contoh preset)"],
    ["#6366F1"],
    ["#0EA5E9"],
    ["#10B981"],
    ["#F59E0B"],
    ["#EF4444"],
    ["#8B5CF6"],
  ]);

  return new NextResponse(bufferToBodyInit(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Template_Mapel_SAKALA_V2.3.xlsx"',
    },
  });
}
