# Canonical Source Consumer Migration — 2026-09-01

## Scope

Consumer migration pass for the academic foundation:

`ACADEMIC CONTEXT → KELAS → MATA PELAJARAN → GURU → TARGET JP → PEMBAGIAN MENGAJAR → SCHEDULE`

## MIG-001 — Kelas academic period

- Consumer: Kelas repository / Kelas UI / Kelas use cases / AI class consumers
- Legacy source: `kelas.tahun_ajaran`, `kelas.semester`
- Canonical source: `kelas.academic_context_id → academic_context`
- Change: Kelas reads and writes are scoped to the active Academic Context; academic year/semester are resolved from `academic_context` and are no longer written through the Kelas form.
- Verification evidence: production database currently has 3/3 Kelas rows with a non-null `academic_context_id`; all 3 belong to Academic Context `2026/2027 · ganjil`.
- Status: MIGRATED — final zero-reference scan and legacy column drop pending.

## MIG-002 — Target JP ownership

- Consumer: Mata Pelajaran repository/domain/UI/import
- Legacy source: `mata_pelajaran.target_jp_per_rombel`
- Canonical source: `target_jp(academic_context_id, kelas_id, mata_pelajaran_id, target_jp)`
- Change: Mata Pelajaran no longer reads or writes the legacy target field; the Mata Pelajaran UI no longer exposes JP as a subject-global property; imports no longer create target JP. Official Target JP remains in the Target JP workflow.
- Verification evidence: production database contains 45 `target_jp` rows totaling 120 JP. Legacy and canonical values are not identical for 6 target pairs, proving the old field cannot remain a source of truth.
- Status: MIGRATED — final zero-reference scan and legacy column drop pending.

## MIG-003 — AI class context consumer

- Consumer: `app/(shell)/ai/actions.ts`
- Legacy dependency: context-free `listKelas(supabase)` after Kelas became context-scoped
- Canonical dependency: `listKelas(supabase, active.id)`
- Change: AI Copilot now explicitly requests Kelas for the active Academic Context; the use case also retains canonical active-context resolution for any legacy caller during migration.
- Status: MIGRATED — build verification pending.

## Database-level verification

- No public view/function definition currently references the legacy academic fields searched during this pass.
- Legacy columns are intentionally retained until application references reach zero and final verification passes.

## Drop gate

Do **not** drop legacy columns until:

1. application references = 0
2. database references = 0
3. runtime references = 0
4. production build passes
5. runtime verification passes
6. regression verification passes

Only then:

`ZERO CONSUMERS → FINAL VERIFY → DROP LEGACY`
