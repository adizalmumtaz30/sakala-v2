import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listGuru } from "@/lib/application/guru.usecases";
import { listMataPelajaran } from "@/lib/application/mata-pelajaran.usecases";
import { listKelas } from "@/lib/application/kelas.usecases";
import { buildControlledTemplateWorkbook, type ControlledTemplateColumn } from "@/lib/import/controlled-template";
import { bufferToBodyInit } from "@/lib/utils/response";

const columns: ControlledTemplateColumn[] = [
  { key: "Guru", required: true, format: "Pilih/ikuti Guru Master SAKALA — lihat REFERENSI", example: "Ahmad Fauzan" },
  { key: "Mapel", required: true, format: "Pilih/ikuti Mata Pelajaran Master SAKALA — lihat REFERENSI", example: "Bahasa Indonesia" },
  { key: "Kelas", required: true, format: "Pilih/ikuti Kelas Master SAKALA — lihat REFERENSI", example: "7A" },
  { key: "JPPerMinggu", required: true, format: "Angka bulat lebih dari 0", example: "4" },
];

export async function GET() {
  try {
    const supabase = await createClient();
    const [guruList, mapelList, kelasList] = await Promise.all([listGuru(supabase), listMataPelajaran(supabase), listKelas(supabase)]);
    const referensiRows: string[][] = [
      ["Referensi Guru (Nama — Kode)"], ...guruList.map((g) => [`${g.namaGuru} — ${g.kodeGuru}`]), [],
      ["Referensi Mata Pelajaran (Nama — Kode)"], ...mapelList.map((m) => [`${m.nama}${m.kode ? ` — ${m.kode}` : ""}`]), [],
      ["Referensi Kelas"], ...kelasList.map((k) => [`${k.tingkat}${k.namaRombel}`]),
    ];
    const buffer = buildControlledTemplateWorkbook(columns, referensiRows, { module: "pembagian-mengajar", label: "Pembagian Mengajar", schemaVersion: "2.3" });
    return new NextResponse(bufferToBodyInit(buffer), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="Template_PembagianMengajar_SAKALA_V2.3.xlsx"' },
    });
  } catch {
    const buffer = buildControlledTemplateWorkbook(columns, [["Referensi tidak tersedia — cek koneksi Supabase."]], { module: "pembagian-mengajar", label: "Pembagian Mengajar", schemaVersion: "2.3" });
    return new NextResponse(bufferToBodyInit(buffer), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="Template_PembagianMengajar_SAKALA_V2.3.xlsx"' },
    });
  }
}
