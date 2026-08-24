import { NextResponse } from "next/server";
import { buildControlledTemplateWorkbook, type ControlledTemplateColumn } from "@/lib/import/controlled-template";
import { bufferToBodyInit } from "@/lib/utils/response";

// Jadwal: template impor jadwal. Kolom sama persis dgn "Unduh Data Real"
// supaya round-trip (unduh -> edit -> impor) bekerja tanpa perlu ubah header.
const columns: ControlledTemplateColumn[] = [
  { key: "Hari", required: true, format: "Senin/Selasa/Rabu/Kamis/Jumat/Sabtu", example: "Senin" },
  { key: "JP", required: true, format: 'Nomor jam pelajaran, mis. "1" atau rentang "1-2"', example: "1-2" },
  { key: "Kelas", required: true, format: "Harus cocok nama kelas yang sudah ada di SAKALA", example: "VII A" },
  { key: "MataPelajaran", required: true, format: "Harus cocok nama mata pelajaran yang sudah ada", example: "Matematika" },
  { key: "Guru", required: true, format: "Harus cocok nama guru yang sudah ada", example: "Ahmad Fauzi" },
  { key: "Ruangan", required: false, format: "Kosongkan kalau belum ditentukan", example: "R.01" },
];

export async function GET() {
  const buffer = buildControlledTemplateWorkbook(columns, [
    ["Catatan"],
    ["Baris yang lolos validasi akan masuk sebagai KANDIDAT (belum jadi jadwal resmi)."],
    ["Tinjau & terapkan kandidat lewat halaman Jadwal Cerdas sebelum aktif."],
  ], { module: "jadwal", label: "Jadwal", schemaVersion: "2.3" });

  return new NextResponse(bufferToBodyInit(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Template_Jadwal_SAKALA_V2.3.xlsx"',
    },
  });
}
