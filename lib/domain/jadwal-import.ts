// Domain layer — parsing struktural baris impor Jadwal. Murni (tanpa Supabase/DB),
// hanya menguraikan teks mentah dari spreadsheet jadi bentuk terstruktur +
// validasi format dasar. Resolusi nama->ID (Guru/Kelas/Mapel/Ruangan) dan
// pengecekan bentrok dilakukan di Application layer (butuh akses DB).

import { URUTAN_HARI, type HariSekolah } from "@/lib/domain/jamPelajaran";

export interface JadwalImportIssue {
  column: string;
  message: string;
}

export interface JadwalImportRowParsed {
  rowNumber: number;
  day: HariSekolah | null;
  periodStart: number | null;
  periodEnd: number | null;
  kelasNama: string;
  mapelNama: string;
  guruNama: string;
  ruanganNama: string;
  issues: JadwalImportIssue[];
}

export function parseJadwalImportRow(raw: Record<string, string>, rowNumber: number): JadwalImportRowParsed {
  const hariRaw = (raw["Hari"] ?? "").trim().toLowerCase();
  const day = (URUTAN_HARI as string[]).includes(hariRaw) ? (hariRaw as HariSekolah) : null;

  const jpRaw = (raw["JP"] ?? raw["JamKe"] ?? "").trim();
  const jpMatch = jpRaw.match(/^(\d+)\s*(?:[-–]\s*(\d+))?$/);
  const periodStart = jpMatch ? parseInt(jpMatch[1], 10) : null;
  const periodEnd = jpMatch ? (jpMatch[2] ? parseInt(jpMatch[2], 10) : periodStart) : null;

  const kelasNama = (raw["Kelas"] ?? "").trim();
  const mapelNama = (raw["MataPelajaran"] ?? raw["Mapel"] ?? "").trim();
  const guruNama = (raw["Guru"] ?? "").trim();
  const ruanganNama = (raw["Ruangan"] ?? "").trim();

  const issues: JadwalImportIssue[] = [];
  if (!day) issues.push({ column: "Hari", message: "Isi salah satu: Senin/Selasa/Rabu/Kamis/Jumat/Sabtu." });
  if (periodStart === null) issues.push({ column: "JP", message: 'Isi nomor jam pelajaran, mis. "1" atau rentang "1-2".' });
  if (!kelasNama) issues.push({ column: "Kelas", message: "Wajib diisi, harus cocok nama kelas yang sudah ada di SAKALA." });
  if (!mapelNama) issues.push({ column: "MataPelajaran", message: "Wajib diisi, harus cocok nama mata pelajaran yang sudah ada." });
  if (!guruNama) issues.push({ column: "Guru", message: "Wajib diisi, harus cocok nama guru yang sudah ada." });

  return { rowNumber, day, periodStart, periodEnd, kelasNama, mapelNama, guruNama, ruanganNama, issues };
}
