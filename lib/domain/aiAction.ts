// Domain layer — AI Action Contract.
//
// SAKALA MASTER RULE (Production Flow, Authority & AI Action Contract):
// setiap tindakan yang diusulkan AI harus bisa dijelaskan sebagai satu objek
// terstruktur — bukan cuma sebuah tombol dengan fungsi tersembunyi di baliknya.
// Field-field di bawah ini memetakan langsung ke kontrak: source, context,
// target_entity/record, destination, current_value/proposed_value, reason,
// evidence, risk, dan payload eksekusi yang eksplisit (bukan implisit lewat
// closure). Ini dipakai untuk menyusun antrean multi-aksi yang bisa disetujui
// sebagian/semua sekaligus dalam satu dialog, dikelompokkan per destination.

export type AiActionType = "tetapkan_guru" | "kurangi_jp";

export type AiActionPayload =
  | { kind: "tetapkan_guru"; kelasId: string; subjectId: string; guruId: string; jpPerMinggu: number }
  | { kind: "kurangi_jp"; assignmentId: string };

export interface AiAction {
  /** Stabil & unik dalam satu antrean — dipakai sebagai React key dan untuk melacak hasil eksekusi. */
  actionId: string;
  type: AiActionType;
  source: "ai";
  /** Konteks manusiawi tempat aksi ini muncul, mis. label kelas. */
  context: string;
  targetEntity: "pembagian_mengajar" | "jadwal";
  targetRecordId: string | null;
  /** Label destinasi untuk pengelompokan di dialog persetujuan — "Pembagian Mengajar" | "Jadwal". */
  destination: string;
  currentValue: string;
  proposedValue: string;
  reason: string;
  evidence: string;
  riskLevel: "rendah" | "sedang";
  payload: AiActionPayload;
}

export type AiActionOutcome =
  | { actionId: string; status: "success"; message: string }
  | { actionId: string; status: "failed"; message: string };
