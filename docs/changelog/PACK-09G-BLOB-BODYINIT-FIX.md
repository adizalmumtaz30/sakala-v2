# PACK 09G — Fix lanjutan: Uint8Array<ArrayBufferLike> masih ditolak BodyInit

## Masalah
Setelah PACK-09F (fix Buffer→Uint8Array), build Next.js tetap gagal dengan error baru:
```
Type 'Uint8Array<ArrayBufferLike>' is not assignable to type 'BodyInit | null | undefined'.
```
Penyebab: pada versi TypeScript/@types/node yang dipakai environment build, `Uint8Array` sendiri
sudah generic (`Uint8Array<ArrayBufferLike>`), sementara definisi `BodyInit` di lib DOM yang dipakai
masih mengharapkan bentuk non-generic. Jadi konversi Buffer→Uint8Array saja belum cukup.

## Perbaikan
- `lib/utils/response.ts` — `bufferToBodyInit()` diubah agar mengembalikan `Blob`, bukan `Uint8Array`:
  ```ts
  export function bufferToBodyInit(buffer: Buffer): Blob {
    return new Blob([new Uint8Array(buffer)]);
  }
  ```
  `Blob` dipilih karena `BlobPart` (parameter constructor-nya) menerima `ArrayBufferView` apa pun
  tanpa peduli parameter generic, dan `Blob` sudah lama menjadi anggota resmi `BodyInit` — jadi
  solusi ini tahan terhadap perubahan generic `Uint8Array` di versi TypeScript berikutnya.
- Tidak ada perubahan di 3 route pemanggil (`app/guru/import/template/route.ts`,
  `app/mata-pelajaran/import/template/route.ts`, `app/pembagian-mengajar/import/template/route.ts`)
  karena signature fungsi `bufferToBodyInit(buffer: Buffer)` tetap sama — cukup ganti isi helper-nya.

## Verifikasi
- Balance kurung `lib/utils/response.ts` — OK.
- Grep pemakaian `bufferToBodyInit` di 4 lokasi — konsisten, tidak ada yang kelewat.
- Tidak ada migration baru, tidak ada perubahan behavior/data.
