# TIER B — B-06 Release Gate

## Scope

Jam Pelajaran interaction and operational integrity.

## Acceptance criteria

- Jam Ke is the only user-facing period label; internal persistence may continue using `nomorUrut`.
- Jam Ke can be typed manually and selected from a dropdown list 1–20.
- Existing Jam Ke for the selected day is rejected with a clear Indonesian message.
- Empty grid slots accept drag-and-drop.
- Dropping onto an occupied Jam Ke is rejected without silent mutation.
- Import accepts XLSX, XLS, and CSV.
- SAKALA template is downloadable with a clean column layout.
- Import validation reports invalid day, Jam Ke, name, and time values before applying rows.
- Active academic context remains the source of truth.

## Release rule

B-06 is PASS only after GitHub implementation, Vercel production build/deployment, LIVE verification, and runtime audit are all green.
