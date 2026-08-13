// Domain layer — Ruangan (Bagian 17.4 / Bagian 82).

export type StatusAktif = "aktif" | "nonaktif";

export interface Ruangan {
  id: string;
  nama: string;
  kapasitas: number | null;
  tipeRuangan: string | null;
  status: StatusAktif;
}

export interface RuanganDraft {
  nama: string;
  kapasitas: number | null;
  tipeRuangan: string;
  status: StatusAktif;
}

export class RuanganValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "RuanganValidationError";
  }
}

export function validateRuanganDraft(draft: RuanganDraft): void {
  if (draft.nama.trim().length === 0) {
    throw new RuanganValidationError("nama", "Nama ruangan wajib diisi.");
  }
  if (draft.kapasitas != null && draft.kapasitas <= 0) {
    throw new RuanganValidationError("kapasitas", "Kapasitas harus lebih dari 0.");
  }
}
