// Skema AiAction formal — §46 (MASTER UI/UX CONTRACT) & §47 (PRODUCTION FLOW,
// AUTHORITY & AI ACTION CONTRACT). Setiap tindakan yang diusulkan SAKALA AI
// (Tambah JP, Kurangi JP, Tetapkan Guru) dibungkus sebagai AiAction eksplisit
// SEBELUM dieksekusi — bukan langsung memanggil server action mentah dari UI
// tanpa jejak siapa/apa/kenapa. Field reason & evidence dialirkan ke audit
// trail (recordAuditEvent) yang sudah ada, supaya setiap perubahan data yang
// diinisiasi AI benar-benar bisa ditelusuri asalnya — bukan cuma type yang
// didefinisikan tapi tidak pernah dipakai.

export type AiActionType = "tambah_jp" | "kurangi_jp" | "tetapkan_guru";
export type AiActionDestination = "jadwal" | "pembagian_mengajar";
export type AiActionRisk = "rendah" | "sedang" | "tinggi";

export interface AiAction {
  actionId: string;
  /** Selalu "sakala-ai" — dipakai di source AuditSource yang sudah ada di skema audit log. */
  source: "sakala-ai";
  actionType: AiActionType;
  /** Fitur tujuan tempat perubahan ini benar-benar mendarat — bukan AI yang menirunya. */
  destination: AiActionDestination;
  targetEntity: { classId: string; subjectId: string; teacherId?: string };
  currentValue: unknown;
  proposedValue: unknown;
  /** Kalimat manusiawi kenapa AI mengusulkan ini — masuk ke kolom `reason` audit log. */
  reason: string;
  /** Sumber data yang diperiksa AI sebelum mengusulkan — bukan diklaim tanpa dasar. */
  evidence: string[];
  risk: AiActionRisk;
  /** Selalu true — SAKALA AI tidak pernah eksekusi tanpa persetujuan eksplisit (§01). */
  approvalRequired: true;
  createdAt: string;
}

export function buildAiAction(
  input: Omit<AiAction, "actionId" | "source" | "approvalRequired" | "createdAt">
): AiAction {
  return {
    actionId: crypto.randomUUID(),
    source: "sakala-ai",
    approvalRequired: true,
    createdAt: new Date().toISOString(),
    ...input,
  };
}

/** Ringkas AiAction jadi satu kalimat untuk kolom `reason` audit log (sudah ada di skema). */
export function summarizeAiAction(action: AiAction): string {
  const base = `[SAKALA AI] ${action.reason}`;
  return action.evidence.length > 0 ? `${base} — dasar: ${action.evidence.join(", ")}.` : `${base}.`;
}
