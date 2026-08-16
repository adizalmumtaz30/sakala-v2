# PACK 09I — Fix teks kepotong di sel grid Jadwal (`/jadwal`)

## Masalah
Di grid Jadwal (`/jadwal`), sel yang sudah terisi (status committed) memaksa tinggi tetap
`h-16` (64px) sementara isinya bisa 3 baris teks (Mapel, Guru/Kelas, Ruangan opsional) + 1
badge status ("Committed"/"Konflik") — total bisa 4 baris. Ditambah tiap baris teks pakai
`truncate` (potong 1 baris + ellipsis). Kombinasi keduanya bikin badge status numpuk/overlap
di atas teks yang sudah kepotong duluan saat nama guru atau mapel panjang (lihat screenshot:
"H. AHMAD JALALUDDIN KAMAL, M.Pd.I" ketutupan badge "Committed").

## Perbaikan
`app/jadwal/JadwalWorkspace.tsx`, komponen `JadwalCell` (return untuk `cell.state` occupied/conflict):
- `h-16` → `min-h-16`: sel sekarang boleh tumbuh lebih tinggi dari 64px kalau kontennya butuh,
  bukan dipaksa pas 64px.
- `truncate` (tiap span Mapel/Guru-Kelas/Ruangan) → `break-words leading-snug`: teks membungkus
  ke baris berikutnya alih-alih dipotong ellipsis, jadi selalu terbaca penuh berapa pun panjangnya.
- Parent-nya HTML `<table>` asli dengan `<td align-top>` tanpa tinggi tetap di level manapun —
  jadi begitu sel individual boleh tumbuh, behavior native table (baris otomatis menyesuaikan ke
  sel tertinggi di baris itu) langsung bekerja tanpa perubahan tambahan di level `<tr>`/`<td>`.

Sel lain (`empty`/`fixed_activity`, isinya cuma 1-2 baris teks pendek seperti "Istirahat"/
"Tambah Jadwal") sengaja TIDAK diubah — `h-16` di situ aman karena kontennya selalu muat.

## Verifikasi
- Balance kurung `app/jadwal/JadwalWorkspace.tsx` — OK.
- Perubahan hanya className (styling), tidak ada perubahan logic/props/data — risiko regresi rendah.
