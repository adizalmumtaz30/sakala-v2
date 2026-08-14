-- 0006_guru_extended.sql
-- SAKALA V2.3 — Pack 09: Guru disederhanakan + progressive disclosure.
-- Menambahkan field opsional (Bagian 11) dan Kode Guru auto-generated (Bagian 10).
-- Field opsional TIDAK BOLEH memblokir insert — semua nullable, tanpa NOT NULL.

alter table guru
  add column if not exists kode_guru text,
  add column if not exists nip text,
  add column if not exists nuptk text,
  add column if not exists email text,
  add column if not exists no_telepon text;

-- Sequence untuk auto-generate Kode Guru (format G-001, G-002, ...)
create sequence if not exists guru_kode_seq;

create or replace function guru_generate_kode()
returns trigger as $$
begin
  if new.kode_guru is null or btrim(new.kode_guru) = '' then
    new.kode_guru := 'G-' || lpad(nextval('guru_kode_seq')::text, 3, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_guru_generate_kode on guru;
create trigger trg_guru_generate_kode
  before insert on guru
  for each row execute function guru_generate_kode();

create unique index if not exists guru_kode_guru_key on guru (kode_guru) where kode_guru is not null;

-- Backfill kode_guru untuk baris lama (dibuat sebelum Pack 09) sesuai urutan created_at,
-- supaya data existing tetap konsisten dengan skema baru.
do $$
declare r record;
begin
  for r in select id from guru where kode_guru is null order by created_at asc loop
    update guru set kode_guru = 'G-' || lpad(nextval('guru_kode_seq')::text, 3, '0') where id = r.id;
  end loop;
end $$;
