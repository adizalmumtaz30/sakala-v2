-- Canonical Source Consumer Migration — final drop.
--
-- Preconditions confirmed before this migration:
--   application references = 0 (kelas.tahun_ajaran, kelas.semester, mata_pelajaran.target_jp_per_rombel)
--   database references (functions/views) = 0
--   runtime references = 0
--   typecheck PASSED
--
-- Canonical sources going forward:
--   kelas.academic_context_id -> academic_context   (tahun_pelajaran, semester)
--   target_jp(academic_context_id, kelas_id, mata_pelajaran_id, target_jp)

alter table public.kelas drop column tahun_ajaran;
alter table public.kelas drop column semester;
alter table public.mata_pelajaran drop column target_jp_per_rombel;
