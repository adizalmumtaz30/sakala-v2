-- 0007_mapel_extended.sql
-- SAKALA V2.3 — Pack 09b (lanjutan): Mata Pelajaran diperkaya sesuai Bagian 29-34.
-- Semua kolom baru nullable — tidak boleh mengubah/menghapus target_jp_per_rombel
-- yang sudah dipakai lib/domain/candidateGeneration.ts (Bagian 32: field existing
-- tidak boleh dihilangkan sembarangan).

alter table mata_pelajaran
  add column if not exists kelompok text,
  add column if not exists warna_jadwal text,
  add column if not exists prioritas_penjadwalan text
    check (prioritas_penjadwalan is null or prioritas_penjadwalan in ('tinggi', 'normal', 'rendah')),
  add column if not exists jenis_mapel text
    check (
      jenis_mapel is null or jenis_mapel in ('akademik', 'muatan_lokal', 'ekstrakurikuler', 'bimbingan_konseling')
    );

comment on column mata_pelajaran.kelompok is 'Bagian 30: pengelompokan mapel, mis. Umum / Peminatan / Kejuruan. Bebas teks, tidak enum ketat supaya fleksibel per satuan pendidikan.';
comment on column mata_pelajaran.warna_jadwal is 'Bagian 30: kode warna hex (#RRGGBB) untuk badge/warna sel di grid jadwal.';
comment on column mata_pelajaran.prioritas_penjadwalan is 'Bagian 30: prioritas saat candidate generation mencari slot — tinggi/normal/rendah.';
comment on column mata_pelajaran.jenis_mapel is 'Bagian 30: klasifikasi domain mapel — BUKAN linearitas (Bagian 31, dihapus total).';
