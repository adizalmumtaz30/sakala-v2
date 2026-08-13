// Domain layer — entity, value object, invariant. TIDAK BOLEH import Supabase atau React.
// Kontrak Bagian 3.1: Domain hanya berisi aturan bisnis murni.
// Bagian 8.1 / 78 — School Profile menyimpan DEFAULT context (Tahun Pelajaran
// + Semester default). Default context BUKAN active context (dua konsep terpisah).

import type { Semester } from "./academicContext";

export interface SchoolProfile {
  id: string;
  nama: string;
  jabatan: string;
  namaSekolah: string;
  tahunPelajaranDefault: string;
  semesterDefault: Semester;
}

export interface SchoolProfileDraft {
  nama: string;
  jabatan: string;
  namaSekolah: string;
  tahunPelajaranDefault: string;
  semesterDefault: Semester;
}

export class SchoolProfileValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "SchoolProfileValidationError";
  }
}

const TAHUN_PELAJARAN_PATTERN = /^(\d{4})\/(\d{4})$/;

/**
 * Invariant School Profile (Bagian 8.1): Nama, Jabatan, Nama Sekolah, Tahun
 * Pelajaran, dan Semester semua wajib diisi. Domain rule murni.
 */
export function validateSchoolProfileDraft(draft: SchoolProfileDraft): void {
  const nama = draft.nama.trim();
  if (nama.length < 3) {
    throw new SchoolProfileValidationError("nama", "Nama wajib diisi, minimal 3 karakter.");
  }

  const jabatan = draft.jabatan.trim();
  if (jabatan.length < 2) {
    throw new SchoolProfileValidationError("jabatan", "Jabatan wajib diisi.");
  }

  const namaSekolah = draft.namaSekolah.trim();
  if (namaSekolah.length < 3) {
    throw new SchoolProfileValidationError("namaSekolah", "Nama sekolah wajib diisi, minimal 3 karakter.");
  }

  const match = draft.tahunPelajaranDefault.trim().match(TAHUN_PELAJARAN_PATTERN);
  if (!match) {
    throw new SchoolProfileValidationError(
      "tahunPelajaranDefault",
      "Format tahun pelajaran wajib YYYY/YYYY, contoh 2025/2026."
    );
  }
  if (Number(match[2]) !== Number(match[1]) + 1) {
    throw new SchoolProfileValidationError(
      "tahunPelajaranDefault",
      "Tahun kedua harus tahun pertama + 1, contoh 2025/2026."
    );
  }

  if (draft.semesterDefault !== "ganjil" && draft.semesterDefault !== "genap") {
    throw new SchoolProfileValidationError("semesterDefault", "Semester wajib ganjil atau genap.");
  }
}
