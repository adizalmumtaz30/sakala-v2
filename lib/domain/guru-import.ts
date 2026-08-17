// Domain layer — validasi baris import Guru. Fungsi murni, tidak menyentuh Supabase,
// supaya bisa dipanggil ulang persis sama saat validate (preview) dan commit (server
// re-validate, tidak pernah percaya hasil validasi client — Bagian 78).

import type { StatusAktif, JenisKelamin, GuruDraft } from "./guru";

export interface GuruImportIssue {
  column: string;
  message: string;
}

export interface GuruImportRowResult {
  rowNumber: number;
  namaGuru: string;
  kodeGuru: string;
  status: "valid" | "perlu_diperbaiki";
  issues: GuruImportIssue[];
  draft: GuruDraft;
}

/**
 * Validasi satu batch baris hasil parse file terhadap kode/nama yang sudah ada di
 * database (existingKodes/existingNames) DAN terhadap baris lain di file yang sama
 * (duplicate detection lintas baris — Bagian 27-28).
 *
 * Catatan penting: kolom KodeGuru pada file HANYA dipakai untuk deteksi duplikat.
 * Kode Guru yang sesungguhnya tetap di-generate otomatis oleh database saat insert
 * (konsisten dengan keputusan Pack 09 — Guru tidak pernah diberi kode manual dari UI).
 */
export function validateGuruImportRows(
  rows: Record<string, string>[],
  existingKodes: Set<string>,
  existingNames: Set<string>
): GuruImportRowResult[] {
  const seenKodes = new Set<string>();
  const seenNames = new Set<string>();

  return rows.map((raw, index) => {
    const rowNumber = index + 1;
    const namaGuru = (raw["NamaLengkap"] ?? raw["Nama"] ?? "").trim();
    const kodeGuru = (raw["KodeGuru"] ?? "").trim();
    const nip = (raw["NIP"] ?? "").trim();
    const nuptk = (raw["NUPTK"] ?? "").trim();
    const email = (raw["Email"] ?? "").trim();
    const noTelepon = (raw["NomorTelepon"] ?? "").trim();
    const statusRaw = (raw["StatusAktif"] ?? "aktif").trim().toLowerCase();
    const status: StatusAktif = statusRaw === "nonaktif" ? "nonaktif" : "aktif";
    const jenisKelaminRaw = (raw["JenisKelamin"] ?? "").trim().toLowerCase();
    let jenisKelamin: JenisKelamin | undefined;

    const issues: GuruImportIssue[] = [];

    if (jenisKelaminRaw) {
      if (jenisKelaminRaw === "l" || jenisKelaminRaw === "laki-laki" || jenisKelaminRaw === "pria") {
        jenisKelamin = "L";
      } else if (jenisKelaminRaw === "p" || jenisKelaminRaw === "perempuan" || jenisKelaminRaw === "wanita") {
        jenisKelamin = "P";
      } else {
        issues.push({ column: "JenisKelamin", message: 'Isi "L" (Laki-laki) atau "P" (Perempuan), atau kosongkan.' });
      }
    }

    if (namaGuru.length < 3) {
      issues.push({ column: "NamaLengkap", message: "Wajib diisi, minimal 3 karakter." });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      issues.push({ column: "Email", message: "Format email tidak valid." });
    }

    if (kodeGuru) {
      const key = kodeGuru.toUpperCase();
      if (existingKodes.has(key)) {
        issues.push({ column: "KodeGuru", message: `"${kodeGuru}" sudah digunakan guru lain di database.` });
      } else if (seenKodes.has(key)) {
        issues.push({ column: "KodeGuru", message: `"${kodeGuru}" duplikat pada baris lain di file ini.` });
      } else {
        seenKodes.add(key);
      }
    }

    if (namaGuru) {
      const nameKey = namaGuru.toLowerCase();
      if (seenNames.has(nameKey)) {
        issues.push({ column: "NamaLengkap", message: `"${namaGuru}" duplikat pada baris lain di file ini.` });
      } else {
        seenNames.add(nameKey);
        if (existingNames.has(nameKey)) {
          issues.push({
            column: "NamaLengkap",
            message: `Guru "${namaGuru}" kemungkinan sudah terdaftar. Periksa dulu sebelum impor.`,
          });
        }
      }
    }

    return {
      rowNumber,
      namaGuru: namaGuru || "(tanpa nama)",
      kodeGuru,
      status: issues.length === 0 ? "valid" : "perlu_diperbaiki",
      issues,
      draft: {
        namaGuru,
        status,
        nip: nip || undefined,
        nuptk: nuptk || undefined,
        email: email || undefined,
        noTelepon: noTelepon || undefined,
        jenisKelamin,
      },
    };
  });
}
