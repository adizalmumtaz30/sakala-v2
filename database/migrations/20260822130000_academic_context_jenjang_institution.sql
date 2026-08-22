-- Laporan user: Jenjang (SD/MI/SMP/MTs/SMA/MA) dan Kementerian/Badan
-- (Kemenag/Kemendikdasmen) harus jadi field pilihan nyata per konteks
-- akademik, bukan teks "SMP/MTs · Kemenag" yang selama ini hardcoded di
-- banyak tempat (Header, Generate Kurikulum, dst).

alter table public.academic_context
  add column if not exists jenjang text,
  add column if not exists institution text;

-- Backfill: institution 'Kemenag' berpasangan dengan jenjang 'MTs' (bukan
-- 'SMP/MTs' gabungan — itu bukan nilai tunggal yang valid untuk field
-- pilihan). MTs adalah padanan Kemenag untuk jenjang SMP.
update public.academic_context set jenjang = 'MTs' where jenjang is null;
update public.academic_context set institution = 'Kemenag' where institution is null;

alter table public.academic_context
  alter column jenjang set not null,
  alter column institution set not null;

alter table public.academic_context
  add constraint academic_context_jenjang_check
    check (jenjang in ('SD','MI','SMP','MTs','SMA','MA')),
  add constraint academic_context_institution_check
    check (institution in ('Kemenag','Kemendikdasmen'));

comment on column public.academic_context.jenjang is 'Jenjang pendidikan konteks ini — dipilih dari daftar tetap, bukan diketik bebas.';
comment on column public.academic_context.institution is 'Kementerian/Badan yang menaungi kurikulum konteks ini.';
