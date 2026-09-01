-- Target JP is contextual and authoritative in public.target_jp.
-- Keep the old column temporarily so consumers can be migrated safely.

COMMENT ON COLUMN public.mata_pelajaran.target_jp_per_rombel IS
  'LEGACY/DEPRECATED: Target JP is contextual and authoritative in public.target_jp (academic_context_id, kelas_id, mata_pelajaran_id). Do not read or write this column.';
