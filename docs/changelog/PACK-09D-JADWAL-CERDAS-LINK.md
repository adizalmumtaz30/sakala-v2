# SAKALA V2.3 — Pack 09d: Pembagian Mengajar Disambungkan ke Jadwal Cerdas

Melengkapi Bagian 37-53/73: "Tambah Jadwal sebaiknya memilih Assignment"
(Pembagian Mengajar) daripada operator memilih Guru/Mapel/Kelas mentah
satu-satu.

## Pendekatan: additive, bukan mengganti
Entri manual (dropdown Kelas/Mapel/Guru/Ruangan per baris) di Tab Generate
Jadwal Cerdas **tetap ada** — dibutuhkan untuk activityType non
belajar-mengajar (Upacara/Religi/Custom) yang tidak selalu punya Pembagian
Mengajar. Yang ditambahkan adalah **lapisan quick-add** di atasnya.

## Perubahan
- `app/jadwal-cerdas/page.tsx`: fetch tambahan `listPembagianMengajar()`,
  difilter status aktif, dikirim sebagai prop baru `pembagianMengajarList`.
- `app/jadwal-cerdas/JadwalCerdasWorkspace.tsx`:
  - Section baru "2. Pilih dari Pembagian Mengajar (opsional)" — daftar
    Pembagian Mengajar aktif dengan badge **JP tersisa** dan tombol "Pakai".
  - Klik "Pakai" → `addRowFromPembagianMengajar()` menambah baris kebutuhan
    dengan Kelas/Mapel/Guru terisi otomatis, **Target JP diambil dari JP
    TERSISA** (bukan total JP) supaya generator tidak mengusulkan ulang
    porsi yang sudah dijadwalkan. Item yang JP tersisanya 0 ("Penuh") tombol
    "Pakai"-nya disabled.
  - `addRow()` sekarang menerima parameter `prefill` opsional — dipakai
    quick-add, tombol manual ("Tambah Baris Manual") tetap sama seperti
    sebelumnya (`addRow()` tanpa argumen).
  - Penomoran section 2/3/4 disesuaikan mengikuti section baru yang disisipkan.

## Verifikasi
`tsc --noEmit` — error yang muncul di file ini semuanya pola noise
environmental yang sama dengan pack-pack sebelumnya (Cannot find module
karena tidak ada node_modules, JSX-children-noise). Brace/paren balance
dicek otomatis — OK.

## Sengaja belum dikerjakan
- JP_MISMATCH reconciliation di Conflict Engine belum otomatis membaca
  `jpPerMinggu` dari Pembagian Mengajar (datanya sekarang tersedia, tinggal
  disambung — flag untuk pack berikutnya).
- Jadwal Operational Workspace (`/jadwal`, bukan Jadwal Cerdas) belum punya
  quick-add serupa — di sana penambahan assignment memang per-slot manual
  by design (klik sel kosong di grid), jadi kebutuhannya berbeda dari
  Jadwal Cerdas.
