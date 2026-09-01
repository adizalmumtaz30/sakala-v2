-- School Profile is not the source of truth for academic period.
-- Keep these columns temporarily for migration compatibility, but explicitly
-- mark them as onboarding preferences only.

COMMENT ON COLUMN public.school_profile.tahun_pelajaran_default IS
  'LEGACY/DEPRECATED: onboarding preference only. Academic truth is public.academic_context.tahun_pelajaran.';
COMMENT ON COLUMN public.school_profile.semester_default IS
  'LEGACY/DEPRECATED: onboarding preference only. Academic truth is public.academic_context.semester.';
