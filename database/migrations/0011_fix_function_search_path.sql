-- 0011_fix_function_search_path.sql
-- Fix Supabase security linter warning "function_search_path_mutable" untuk
-- set_updated_at() (0001/0006_database_repair) dan guru_generate_kode()
-- (0006_guru_extended) — set search_path eksplisit ke 'public' supaya tidak
-- mengikuti search_path pemanggil (mencegah potensi schema hijacking).
-- Perilaku fungsi TIDAK berubah, hanya mengunci search_path.
-- Sudah diterapkan langsung ke Supabase (lihat migration history), file ini
-- untuk menjaga repo tetap sinkron dengan database.

alter function public.set_updated_at() set search_path = public;
alter function public.guru_generate_kode() set search_path = public;
