import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listGuru } from "@/lib/application/guru.usecases";
import { listMataPelajaran } from "@/lib/application/mata-pelajaran.usecases";
import { listKelas } from "@/lib/application/kelas.usecases";
import { buildTemplateWorkbook, type TemplateColumn } from "@/lib/import/template";
import { bufferToBodyInit } from "@/lib/utils/response";

// Template resmi Pembagian Mengajar (Bagian 74-76). BEDA dari Guru/Mapel:
// sheet REFERENSI di sini DINAMIS — berisi daftar Guru/Mapel/Kelas yang
// sesungguhnya ada di database saat ini, supaya operator tahu persis ejaan
// nama/kode yang harus dipakai di kolom Guru/Mapel/Kelas (Bagian 21 & 75).
const columns: TemplateColumn[] = [
  { key: "Guru", required: true, format: "Nama lengkap ATAU Kode Guru — lihat sheet REFERENSI", example: "Ahmad Fauzan" },
  { key: "Mapel", required: true, format: "Nama ATAU Kode Mata Pelajaran — lihat sheet REFERENSI", example: "Bahasa Indonesia" },
  { key: "Kelas", required: true, format: "Gabungan Tingkat+Rombel, mis. 7A — lihat sheet REFERENSI", example: "7A" },
  { key: "JPPerMinggu", required: true, format: "Angka bulat lebih dari 0", example: "4" },
];

export async function GET() {
  try {
    const supabase = await createClient();
    const [guruList, mapelList, kelasList] = await Promise.all([
      listGuru(supabase),
      listMataPelajaran(supabase),
      listKelas(supabase),
    ]);

    const referensiRows: string[][] = [
      ["Referensi Guru (Nama — Kode)"],
      ...guruList.map((g) => [`${g.namaGuru} — ${g.kodeGuru}`]),
      [],
      ["Referensi Mata Pelajaran (Nama — Kode)"],
      ...mapelList.map((m) => [`${m.nama}${m.kode ? ` — ${m.kode}` : ""}`]),
      [],
      ["Referensi Kelas"],
      ...kelasList.map((k) => [`${k.tingkat}${k.namaRombel}`]),
    ];

    const buffer = buildTemplateWorkbook(columns, referensiRows);

    return new NextResponse(bufferToBodyInit(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Template_PembagianMengajar_SAKALA_V2.3.xlsx"',
      },
    });
  } catch {
    // Bagian 15.3 — kalau gagal fetch referensi (mis. belum ada Supabase),
    // tetap kirim template kosong (tanpa referensi dinamis) daripada gagal total.
    const buffer = buildTemplateWorkbook(columns, [["Referensi tidak tersedia — cek koneksi Supabase."]]);
    return new NextResponse(bufferToBodyInit(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Template_PembagianMengajar_SAKALA_V2.3.xlsx"',
      },
    });
  }
}
