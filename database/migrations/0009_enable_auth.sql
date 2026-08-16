-- Bagian 40 Authentication — setelah Auth aktif dan minimal 1 user admin bisa
-- login, SEMUA akses anon (TEMP_anon_*) dicabut. Policy "authenticated_*"
-- sudah ada sejak migration 0001-0008 (dipasang berdampingan dari awal),
-- jadi begitu policy anon ini di-drop, akses otomatis jalan untuk siapa pun
-- yang sudah login — tidak perlu policy baru.
--
-- PENTING: baru jalankan migration ini SETELAH dikonfirmasi minimal 1 user
-- bisa login sukses ke aplikasi (kalau dijalankan duluan, aplikasi langsung
-- terkunci total buat siapa pun sebelum ada user pertama).

drop policy if exists "TEMP_anon_all_guru" on guru;
drop policy if exists "TEMP_anon_all_mapel" on mata_pelajaran;
drop policy if exists "TEMP_anon_all_kelas" on kelas;
drop policy if exists "TEMP_anon_all_ruangan" on ruangan;
drop policy if exists "TEMP_anon_all_academic_context" on academic_context;
drop policy if exists "TEMP_anon_all_school_profile" on school_profile;
drop policy if exists "TEMP_anon_all_periode_akademik" on periode_akademik;
drop policy if exists "TEMP_anon_all_jam_pelajaran" on jam_pelajaran;
drop policy if exists "TEMP_anon_all_schedule_model" on schedule_model;
drop policy if exists "TEMP_anon_all_slot_template" on slot_template;
drop policy if exists "TEMP_anon_all_schedule_version" on schedule_version;
drop policy if exists "TEMP_anon_all_schedule_assignment" on schedule_assignment;
drop policy if exists "TEMP_anon_all_pembagian_mengajar" on pembagian_mengajar;
