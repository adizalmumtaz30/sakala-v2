// Domain layer — validasi + reference resolution baris import Pembagian
// Mengajar (Bagian 74-76). BEDA dari guru-import/mapel-import: di sini kolom
// file berisi NAMA (Guru/Mapel/Kelas), bukan field entity itu sendiri — jadi
// perlu "resolve" ke ID lewat lookup yang disuplai Application layer (yang
// baca dari database). Domain tetap fungsi murni: lookup dikirim sebagai Map,
// bukan query di sini.

import type { PembagianMengajarDraft } from "./pembagianMengajar";

export interface PembagianMengajarImportIssue {
  column: string;
  message: string;
}

export interface PembagianMengajarImportRowResult {
  rowNumber: number;
  guruLabel: string;
  mapelLabel: string;
  kelasLabel: string;
  status: "valid" | "perlu_diperbaiki";
  issues: PembagianMengajarImportIssue[];
  draft: PembagianMengajarDraft | null;
}

export interface ReferenceEntry {
  id: string;
  label: string;
}

/** Normalisasi kunci pencarian: lowercase + rapatkan spasi berlebih, TIDAK menghapus semua spasi
 * supaya "7 A" vs "7A" tetap bisa dua-duanya cocok lewat normalizeKelasKey terpisah. */
function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Kelas dicocokkan lebih longgar: "7A", "7 A", "7-A" semua dianggap sama. */
function normalizeKelasKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "");
}

export function buildGuruLookup(entries: { id: string; namaGuru: string; kodeGuru: string }[]) {
  const byName = new Map<string, string>();
  const byKode = new Map<string, string>();
  for (const g of entries) {
    byName.set(normalizeKey(g.namaGuru), g.id);
    byKode.set(normalizeKey(g.kodeGuru), g.id);
  }
  return { byName, byKode };
}

export function buildMapelLookup(entries: { id: string; nama: string; kode: string | null }[]) {
  const byName = new Map<string, string>();
  const byKode = new Map<string, string>();
  for (const m of entries) {
    byName.set(normalizeKey(m.nama), m.id);
    if (m.kode) byKode.set(normalizeKey(m.kode), m.id);
  }
  return { byName, byKode };
}

export function buildKelasLookup(entries: { id: string; tingkat: string; namaRombel: string }[]) {
  const byLabel = new Map<string, string>();
  for (const k of entries) {
    byLabel.set(normalizeKelasKey(`${k.tingkat}${k.namaRombel}`), k.id);
    byLabel.set(normalizeKelasKey(`${k.tingkat} ${k.namaRombel}`), k.id);
  }
  return byLabel;
}

export function validatePembagianMengajarImportRows(
  rows: Record<string, string>[],
  academicContextId: string,
  guruLookup: ReturnType<typeof buildGuruLookup>,
  mapelLookup: ReturnType<typeof buildMapelLookup>,
  kelasLookup: ReturnType<typeof buildKelasLookup>,
  existingCombos: Set<string>
): PembagianMengajarImportRowResult[] {
  const seenCombos = new Set<string>();

  return rows.map((raw, index) => {
    const rowNumber = index + 1;
    const guruRaw = (raw["Guru"] ?? "").trim();
    const mapelRaw = (raw["Mapel"] ?? raw["MataPelajaran"] ?? "").trim();
    const kelasRaw = (raw["Kelas"] ?? "").trim();
    const jpRaw = (raw["JPPerMinggu"] ?? raw["JP"] ?? "").trim();

    const issues: PembagianMengajarImportIssue[] = [];

    const guruId = guruLookup.byName.get(normalizeKey(guruRaw)) ?? guruLookup.byKode.get(normalizeKey(guruRaw));
    if (!guruRaw) {
      issues.push({ column: "Guru", message: "Wajib diisi." });
    } else if (!guruId) {
      issues.push({ column: "Guru", message: `Guru "${guruRaw}" tidak ditemukan di data Guru. Tambahkan gurunya dulu.` });
    }

    const mapelId = mapelLookup.byName.get(normalizeKey(mapelRaw)) ?? mapelLookup.byKode.get(normalizeKey(mapelRaw));
    if (!mapelRaw) {
      issues.push({ column: "Mapel", message: "Wajib diisi." });
    } else if (!mapelId) {
      issues.push({ column: "Mapel", message: `Mata pelajaran "${mapelRaw}" tidak ditemukan. Tambahkan mapelnya dulu.` });
    }

    const kelasId = kelasLookup.get(normalizeKelasKey(kelasRaw));
    if (!kelasRaw) {
      issues.push({ column: "Kelas", message: "Wajib diisi." });
    } else if (!kelasId) {
      issues.push({ column: "Kelas", message: `Kelas "${kelasRaw}" tidak ditemukan. Format: gabungan Tingkat+Rombel, mis. "7A".` });
    }

    let jpPerMinggu = 0;
    if (!jpRaw) {
      issues.push({ column: "JPPerMinggu", message: "Wajib diisi." });
    } else {
      const parsed = Number(jpRaw);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        issues.push({ column: "JPPerMinggu", message: `"${jpRaw}" harus bilangan bulat lebih dari 0.` });
      } else {
        jpPerMinggu = parsed;
      }
    }

    if (guruId && mapelId && kelasId) {
      const comboKey = `${guruId}|${mapelId}|${kelasId}`;
      if (existingCombos.has(comboKey)) {
        issues.push({
          column: "Kombinasi",
          message: `Kombinasi Guru "${guruRaw}" + Mapel "${mapelRaw}" + Kelas "${kelasRaw}" sudah terdaftar di database.`,
        });
      } else if (seenCombos.has(comboKey)) {
        issues.push({
          column: "Kombinasi",
          message: `Kombinasi ini duplikat pada baris lain di file ini.`,
        });
      } else {
        seenCombos.add(comboKey);
      }
    }

    const isValid = issues.length === 0;
    return {
      rowNumber,
      guruLabel: guruRaw || "(kosong)",
      mapelLabel: mapelRaw || "(kosong)",
      kelasLabel: kelasRaw || "(kosong)",
      status: isValid ? "valid" : "perlu_diperbaiki",
      issues,
      draft: isValid
        ? {
            academicContextId,
            guruId: guruId!,
            mataPelajaranId: mapelId!,
            kelasId: kelasId!,
            jpPerMinggu,
            status: "aktif",
          }
        : null,
    };
  });
}
