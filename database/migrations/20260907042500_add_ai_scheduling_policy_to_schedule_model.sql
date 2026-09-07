-- SS3 masukan operator (PRACTICAL UI & OPERATOR EXPERIENCE lanjutan): AI
-- penyusun jadwal butuh variasi metode, bukan cuma "isi yang kosong" satu
-- gaya. Solver (lib/application/schedulingSolver.ts) sudah mendukung
-- `spread` (sebar/padat) dan `maxConsecutiveSamePerDay` sebagai hard
-- constraint, tapi belum ada tempat menyimpan preferensi operator -- diatur
-- SEKALI per Schedule Model (bukan ditanya tiap kali AI jalan), konsisten
-- dengan pola Active Context: atur sekali, dipakai otomatis di mana-mana.
alter table schedule_model
  add column if not exists sebaran_jp text not null default 'sebar' check (sebaran_jp in ('sebar', 'padat')),
  add column if not exists maks_jp_beruntun_sama integer;

comment on column schedule_model.sebaran_jp is 'Preferensi AI menyusun JP mapel yang sama: sebar ke banyak hari, atau padat di hari yang sama dulu.';
comment on column schedule_model.maks_jp_beruntun_sama is 'Batas keras JP berurutan tanpa jeda untuk mapel yang sama di hari yang sama. NULL = tidak dibatasi.';
