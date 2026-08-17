-- Bagian 40 Authentication — lanjutan migration 0009: tabel audit_log dibuat
-- belakangan (migration 0010, setelah 0009 ditulis) jadi TEMP_anon_*-nya
-- belum tercabut. Sudah ada policy authenticated_read/write_audit_log sejak
-- awal, jadi akses tetap jalan untuk user yang sudah login.
drop policy if exists "TEMP_anon_read_audit_log" on audit_log;
drop policy if exists "TEMP_anon_write_audit_log" on audit_log;
