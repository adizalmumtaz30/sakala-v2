# SAKALA Akademik — Global Screen Migration Contract

This contract is the implementation gate for Akademik screens.

## Global list standard
- Multi-select screens expose Select All and selected count.
- View count is user-controlled from 1 through the actual item count.
- Presets are adaptive and never exceed total items.
- Pagination preserves selection and filters.
- Long content is presented as a compact preview with Lihat detail; stored/source text is never mutated.

## Academic integrity
- Active Academic Context is the single working context.
- Curriculum Intelligence is a reference/derivation layer and never silently mutates school data.
- Official allocation and derived weekly target remain separate.
- Overrides are explicit and traceable.
- Generate Curriculum does not run the scheduling solver.

## Screen order and acceptance gates
1. Academic Context — context selection/creation remains explicit; changing active context reloads dependent academic data.
2. Generate Kurikulum — official/verified source gating, curriculum version, regulation provenance, level/class selection, review list, Select All, flexible view count, explicit adoption.
3. Mata Pelajaran — adopted curriculum remains distinct from generated reference data; source/provenance stays traceable.
4. Target JP — consumes adopted weekly targets without silent replacement.
5. Jam Pelajaran — context-scoped scheduling periods and list controls.
6. Model Jadwal — context-scoped model/slot management and list controls.

## Direct-load/reload requirement
Curriculum Intelligence launcher must be rendered on direct navigation and reload, without query-string dependencies.

## Final gate
Migration is only READY after build PASS, production deployment, direct navigation/reload verification, and live functional audit of all six screens.
