export type CurriculumInstitution = "kementerian_agama" | "kemendikdasmen";
export type CurriculumSourceStatus = "official" | "unverified" | "stale" | "blocked";
export type CurriculumVerificationStatus = "verified" | "unverified" | "blocked" | "stale";
export type CurriculumAllocationType = "weekly" | "annual" | "semester" | "other";
export type CurriculumDerivationStatus = "official" | "derived" | "not_derived" | "blocked";
export type CurriculumCategory = "wajib" | "pilihan" | "muatan_lokal" | "kokurikuler" | "lainnya";

export type CurriculumSource = {
  id: string;
  institution: CurriculumInstitution;
  source_tier: number;
  source_type: string;
  name: string;
  official_url: string;
  status: CurriculumSourceStatus;
  last_checked_at: string | null;
  last_verified_at: string | null;
};

export type CurriculumVersion = {
  id: string;
  source_id: string;
  curriculum_name: string;
  regulation_number: string | null;
  regulation_year: number | null;
  regulation_title: string | null;
  issuing_institution: string;
  effective_status: "berlaku" | "dicabut" | "diubah" | "unknown";
  effective_date: string | null;
  retrieved_at: string;
  verified_at: string | null;
  version_key: string;
  document_url: string | null;
  verification_status: CurriculumVerificationStatus;
};

export type CurriculumItem = {
  id: string;
  curriculum_version_id: string;
  subject_name: string;
  subject_code: string | null;
  class_level: string;
  allocation_type: CurriculumAllocationType;
  official_allocation: number | null;
  allocation_unit: string | null;
  effective_weeks: number | null;
  weekly_target: number | null;
  derivation_status: CurriculumDerivationStatus;
  derivation_method: string | null;
  category: CurriculumCategory;
  extraction_status: CurriculumVerificationStatus;
  source_locator: string | null;
};

export function institutionLabel(value: CurriculumInstitution) {
  return value === "kementerian_agama"
    ? "Kementerian Agama Republik Indonesia"
    : "Kementerian Pendidikan Dasar dan Menengah Republik Indonesia";
}

export function statusLabel(value: CurriculumVerificationStatus | CurriculumSourceStatus) {
  if (value === "verified" || value === "official") return "Official";
  if (value === "stale") return "Verification Required";
  return "Blocked / Unverified";
}

export function canGenerate(version: CurriculumVersion | null) {
  return Boolean(version && version.verification_status === "verified");
}

export function deriveWeeklyTarget(officialAllocation: number | null, allocationType: CurriculumAllocationType, effectiveWeeks: number | null) {
  if (officialAllocation == null) return { weeklyTarget: null, status: "not_derived" as const, method: null };
  if (allocationType === "weekly") return { weeklyTarget: officialAllocation, status: "official" as const, method: "Official weekly allocation" };
  if ((allocationType === "annual" || allocationType === "semester") && effectiveWeeks && effectiveWeeks > 0) {
    return {
      weeklyTarget: Number((officialAllocation / effectiveWeeks).toFixed(2)),
      status: "derived" as const,
      method: `${officialAllocation} ${allocationType} ÷ ${effectiveWeeks} effective weeks`,
    };
  }
  return { weeklyTarget: null, status: "not_derived" as const, method: null };
}
