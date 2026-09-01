-- Academic Foundation Reset
-- Kelas is contextual data. Tahun pelajaran + semester belong to academic_context,
-- not to each kelas row. This migration is intentionally additive: legacy
-- tahun_ajaran/semester columns remain temporarily so production can migrate
-- consumers before they are removed.

ALTER TABLE public.kelas
  ADD COLUMN IF NOT EXISTS academic_context_id uuid;

UPDATE public.kelas k
SET academic_context_id = ac.id
FROM public.academic_context ac
WHERE ac.is_active = true
  AND k.academic_context_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.kelas WHERE academic_context_id IS NULL) THEN
    RAISE EXCEPTION 'Academic Foundation migration stopped: ada kelas tanpa academic_context_id.';
  END IF;
END $$;

ALTER TABLE public.kelas
  ALTER COLUMN academic_context_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kelas_academic_context_id_fkey'
  ) THEN
    ALTER TABLE public.kelas
      ADD CONSTRAINT kelas_academic_context_id_fkey
      FOREIGN KEY (academic_context_id)
      REFERENCES public.academic_context(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kelas_academic_context_id
  ON public.kelas (academic_context_id);

-- A/B/C may legitimately repeat across different grade levels. The contextual
-- identity is therefore (context, tingkat, nama_rombel), not (context, name).
CREATE UNIQUE INDEX IF NOT EXISTS uq_kelas_context_tingkat_rombel
  ON public.kelas (academic_context_id, tingkat, nama_rombel);

COMMENT ON COLUMN public.kelas.tahun_ajaran IS
  'LEGACY/DEPRECATED: authoritative academic period is academic_context_id.';
COMMENT ON COLUMN public.kelas.semester IS
  'LEGACY/DEPRECATED: authoritative academic period is academic_context_id.';
