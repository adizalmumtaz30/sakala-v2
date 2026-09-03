-- Root fix (bukan cuma tambal titik baca): normalisasi class_level yang
-- SUDAH ADA di database ke bentuk kanonik Arab, konsisten dengan
-- normalizeTingkat() di kode aplikasi. Sebelum ini, curriculum_item.class_level
-- tersimpan angka Romawi (VII/VIII/IX) sementara kelas.tingkat pakai Arab
-- (7/8/9) — kode sekarang menormalkan SEMUA tulisan baru ke Arab, jadi data
-- lama ini disamakan juga supaya tidak ada dua bentuk berbeda tersisa di DB.
update public.curriculum_item
set class_level = case upper(trim(class_level))
  when 'I' then '1' when 'II' then '2' when 'III' then '3' when 'IV' then '4'
  when 'V' then '5' when 'VI' then '6' when 'VII' then '7' when 'VIII' then '8'
  when 'IX' then '9' when 'X' then '10' when 'XI' then '11' when 'XII' then '12'
  else class_level
end
where upper(trim(class_level)) in ('I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII');
