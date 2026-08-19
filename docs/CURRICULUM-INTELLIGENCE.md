# SAKALA V2 — Curriculum Intelligence

## North Star

`SOURCE = OFFICIAL` · `CURRICULUM = IDENTIFIED` · `REGULATION = TRACEABLE` · `ALLOCATION = OFFICIAL` · `WEEKLY TARGET = DERIVED WHEN VALID` · `SELECTION = USER CONTROLLED` · `OVERRIDE = EXPLICIT` · `SCHEDULE = DOWNSTREAM` · `AI = INTERPRETER, NOT AUTHORITY`

## Hard rules

1. Kementerian/instansi bukan nama kurikulum.
2. Regulasi wajib berasal dari dokumen resmi dan memiliki provenance.
3. SAKALA tidak boleh menebak nama kurikulum, nomor regulasi, struktur mata pelajaran, atau JP.
4. `official_allocation` dan `weekly_target` selalu disimpan terpisah.
5. Target mingguan hanya dihitung bila unit alokasi dan minggu efektif membuat derivasi valid.
6. Hasil generate masuk ke `REVIEW`, bukan langsung menjadi kurikulum sekolah.
7. Adopsi hanya boleh ke Active Academic Context.
8. Academic Context, kelas, mata pelajaran, dan curriculum version membentuk boundary data.
9. Override sekolah harus eksplisit dan dapat dilacak.
10. Regulasi baru membuat candidate version; tidak pernah silent overwrite terhadap kurikulum sekolah aktif.
11. Jadwal Cerdas hanya menggunakan hasil yang sudah diadopsi sebagai downstream input.

## Data lifecycle

`OFFICIAL SOURCE → REGULATION DOCUMENT → VERIFY → EXTRACT → VALIDATE → NORMALIZE → REVIEW → SELECTED → ACTIVE → TARGET JP → JADWAL CERDAS`

## Source tiers

- Tier 1: JDIH kementerian, situs kementerian, direktorat/unit resmi, keputusan/peraturan resmi.
- Tier 2: Kanwil/Kankemenag/unit pemerintah terkait.
- Tier 3: sumber mainstream untuk cross-check saja.

## Block conditions

Generate wajib berhenti jika:

- dokumen authority tidak dapat diverifikasi;
- curriculum version belum verified;
- extraction item belum verified;
- weekly target tidak dapat diturunkan secara valid;
- Active Academic Context tidak tersedia;
- kelas tidak cocok dengan class level item.

## Current implementation boundary

The first vertical slice intentionally ships the schema, official-source registry, domain rules, review wizard, and adoption bridge. The database starts with **no hard-coded regulation facts**. This keeps the feature truthful until a verified regulation document is ingested and stored as a `curriculum_version` with provenance.

## Integration

Adoption creates/reuses `mata_pelajaran`, records `curriculum_adoption`, and upserts `target_jp` for the selected Academic Context and class. It does not invoke the schedule solver.
