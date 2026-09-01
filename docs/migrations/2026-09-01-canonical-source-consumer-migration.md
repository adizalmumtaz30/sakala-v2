# Canonical Source Consumer Migration — 2026-09-01

## Scope

Consumer migration pass for the academic foundation:

`ACADEMIC CONTEXT → KELAS → MATA PELAJARAN → GURU → TARGET JP → PEMBAGIAN MENGAJAR → SCHEDULE`

## MIG-001 — Kelas academic period

- Consumer: Kelas repository / Kelas UI / Kelas use cases / AI class consumers
- Legacy source: `kelas.tahun_ajaran`, `kelas.semester`
- Canonical source: `kelas.academic_context_id → academic_context`
- Change: Kelas reads and writes are scoped to the active Academic Context; academic year/semester are resolved from `academic_context` and are no longer written through the Kelas form.
- Re-scan findings (2026-09-02): 2 remaining direct consumers were found and fixed —
  `getActiveAcademicContextAction` in `curriculum-actions.ts` (dead code, unused, removed) and
  `app/api/target-jp/import/route.ts` GET `mode=data` handler (filtered `kelas` by legacy
  `tahun_ajaran`/`semester` instead of `academic_context_id` — migrated). Its client,
  `generate-kurikulum/page.tsx`, was updated to stop re-filtering classes by legacy fields since
  the server now returns classes already scoped to the active context.
- Runtime bug found and fixed during verification: `kelasRepository.create()` did not write
  `tahun_ajaran`/`semester`, which were `NOT NULL` with no default/trigger — new Kelas creation
  would have failed. Resolved by dropping the legacy columns (see MIG-004) rather than
  reintroducing a write to them.
- Verification evidence: production database has 3/3 Kelas rows with a non-null `academic_context_id`, unchanged after drop.
- Status: MIGRATED — zero consumers confirmed, legacy columns dropped.

## MIG-002 — Target JP ownership

- Consumer: Mata Pelajaran repository/domain/UI/import
- Legacy source: `mata_pelajaran.target_jp_per_rombel`
- Canonical source: `target_jp(academic_context_id, kelas_id, mata_pelajaran_id, target_jp)`
- Change: Mata Pelajaran no longer reads or writes the legacy target field; the Mata Pelajaran UI no longer exposes JP as a subject-global property; imports no longer create target JP. Official Target JP remains in the Target JP workflow.
- Verification evidence: production database contains 45 `target_jp` rows totaling 120 JP, unchanged after drop. Legacy and canonical values were not identical for 6 target pairs pre-drop, confirming the old field was not a valid source of truth.
- Status: MIGRATED — zero consumers confirmed, legacy column dropped.

## MIG-003 — AI class context consumer

- Consumer: `app/(shell)/ai/actions.ts`
- Legacy dependency: context-free `listKelas(supabase)` after Kelas became context-scoped
- Canonical dependency: `listKelas(supabase, active.id)`
- Change: AI Copilot now explicitly requests Kelas for the active Academic Context.
- Status: MIGRATED — `tsc --noEmit` PASSED.

## MIG-004 — Legacy column drop

- Dropped: `kelas.tahun_ajaran`, `kelas.semester`, `mata_pelajaran.target_jp_per_rombel`.
- Pre-drop checks: 0 application references (full-repo re-grep), 0 function/view definitions, 0 indexes/RLS policies referencing the columns.
- Post-drop verification: `tsc --noEmit` PASSED; Kelas count (3) and Target JP count/sum (45 rows / 120 JP) unchanged.
- `next build` could not be completed in the migration sandbox (network egress to `fonts.googleapis.com` for `next/font/google` is blocked there); confirmed this failure is pre-existing and reproduces identically on the pre-migration commit, i.e. unrelated to this change. Run the real build in CI/deploy before merging to be certain.
- Status: DROPPED.

## Database-level verification

- No public view/function definition referenced the legacy academic fields.
- No index or RLS policy referenced the legacy columns.

## Outstanding before merge

- Run `next build` in an environment with normal network access (CI) to get a real build-pass signal — not verified in this session.
- PR #108 is still draft on `refactor/canonical-source-consumer-migration-01`; not yet merged to `main`.
