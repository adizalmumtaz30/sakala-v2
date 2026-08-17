-- 0014_guru_jenis_kelamin.sql
-- SAKALA V2.3 — Penyempurnaan #1: Icon & Avatar Premium.
-- Menambahkan field opsional Jenis Kelamin, dipakai untuk menentukan varian
-- ilustrasi avatar (wanita/pria). Optional, TIDAK BOLEH memblokir insert
-- (konsisten dengan pola Bagian 11 & 98 — field administratif selalu opsional).

alter table guru
  add column if not exists jenis_kelamin text;

alter table guru
  drop constraint if exists guru_jenis_kelamin_check;

alter table guru
  add constraint guru_jenis_kelamin_check
  check (jenis_kelamin is null or jenis_kelamin in ('L', 'P'));
