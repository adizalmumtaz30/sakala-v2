# PACK 09F — Fix tipe Buffer→BodyInit di route template import

## Masalah
`tsc --noEmit` gagal build dengan error:
```
Type 'Buffer<ArrayBufferLike>' is not assignable to parameter of type 'BodyInit | null | undefined'.
```
Muncul di semua route `GET` yang mengembalikan file Excel lewat `new NextResponse(buffer, { ... })`,
karena tipe `Buffer` dari `@types/node` versi tertentu tidak otomatis dianggap assignable ke `BodyInit`.

## Perbaikan
- Tambah helper baru `lib/utils/response.ts` — `bufferToBodyInit(buffer: Buffer): Uint8Array`.
  Aman karena `Buffer` adalah subclass `Uint8Array`; tidak mengubah isi data, hanya melepas
  tipe `Buffer<ArrayBufferLike>` yang bikin TypeScript menolak.
- Diterapkan di 3 route (4 lokasi, karena route Pembagian Mengajar punya 2 return — jalur sukses & fallback):
  - `app/guru/import/template/route.ts`
  - `app/mata-pelajaran/import/template/route.ts`
  - `app/pembagian-mengajar/import/template/route.ts`

## Verifikasi
- Grep ulang `new NextResponse(buffer` di `app/` dan `lib/` — 0 hasil (semua sudah lewat `bufferToBodyInit()`).
- Balance kurung dicek otomatis (Python script) di ke-4 file — OK.
- Tidak ada migration baru, tidak ada perubahan behavior/data — murni fix tipe TypeScript.

Tidak ada file lain yang perlu diubah untuk isu ini.
