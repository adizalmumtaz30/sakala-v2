-- Revert Bagian 40 (Authentication) — permintaan eksplisit user, dihapus total.
-- Pulihkan semua policy TEMP_anon_* yang dicabut migration 0009 dan 0012,
-- persis dengan definisi aslinya di migration 0001-0008 dan 0010.
create policy "TEMP_anon_all_guru" on guru for all to anon using (true) with check (true);
create policy "TEMP_anon_all_mapel" on mata_pelajaran for all to anon using (true) with check (true);
create policy "TEMP_anon_all_kelas" on kelas for all to anon using (true) with check (true);
create policy "TEMP_anon_all_ruangan" on ruangan for all to anon using (true) with check (true);
create policy "TEMP_anon_all_academic_context" on academic_context for all to anon using (true) with check (true);
create policy "TEMP_anon_all_school_profile" on school_profile for all to anon using (true) with check (true);
create policy "TEMP_anon_all_periode_akademik" on periode_akademik for all to anon using (true) with check (true);
create policy "TEMP_anon_all_jam_pelajaran" on jam_pelajaran for all to anon using (true) with check (true);
create policy "TEMP_anon_all_schedule_model" on schedule_model for all to anon using (true) with check (true);
create policy "TEMP_anon_all_slot_template" on slot_template for all to anon using (true) with check (true);
create policy "TEMP_anon_all_schedule_version" on schedule_version for all to anon using (true) with check (true);
create policy "TEMP_anon_all_schedule_assignment" on schedule_assignment for all to anon using (true) with check (true);
create policy "TEMP_anon_all_pembagian_mengajar" on pembagian_mengajar for all to anon using (true) with check (true);
create policy "TEMP_anon_read_audit_log" on audit_log for select to anon using (true);
create policy "TEMP_anon_write_audit_log" on audit_log for insert to anon with check (true);
