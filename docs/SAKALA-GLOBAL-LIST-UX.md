# SAKALA Global List UX Standard

## Scope
All SAKALA features that render collections, tables, directories, search results, or multi-select lists must use the same list interaction model.

## Required controls
- `Pilih semua` when the list supports multi-selection.
- Selected-count feedback.
- `Tampilkan` page-size control with 10 / 20 / 30 / 40 / 50.
- Pagination when the collection exceeds the selected page size.
- Selection must survive page changes.
- Changing page size must not silently clear selection.
- Search/filter changes must preserve selected records unless the user explicitly clears them.

## Context placement
`Generate Kurikulum` belongs to the Academic Context flow. The information architecture is:

`Akademik → Konteks Akademik → Curriculum Intelligence → Generate Kurikulum → Review → Mata Pelajaran → Target JP → Jadwal Cerdas`

The generator must inherit the active Academic Context and must never silently write into another context.

## Empty and error states
List controls are hidden when there are no records. The empty state remains primary. Verification failures must block official curriculum generation rather than inventing data.
