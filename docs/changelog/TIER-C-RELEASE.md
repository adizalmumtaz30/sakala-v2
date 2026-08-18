# TIER C — RELEASE GATE

Status: execution gate

## Scope

- C-1 Target JP: manual edit, native template, XLSX/XLS/CSV import, drag-and-drop, validation preview, explicit commit.
- C-2 Import/Template hardening: import/template actions remain contextual, validation blocks invalid rows, successful rows persist only after explicit confirmation.
- C-3 Jadwal operational interaction: slot/grid pointer drag interaction with conflict-safe move workflow and contextual actions.
- C-4 Jadwal Cerdas release flow: Generate Candidate → Review/Conflict → optional Optimization → explicit Commit, with committed schedule protected from silent mutation.

## Release gates

1. Repository source is authoritative.
2. Production build must pass.
3. Target JP and schedule routes must be reachable.
4. Production deployment must reach READY.
5. Production smoke verification must return HTTP 200 for the core routes.
6. No claim of PASS/READY/LIVE is valid without deployment evidence.
