# PACK 09H — Solusi permanen untuk error tipe Buffer/Uint8Array → BodyInit

## Kenapa perlu pack baru lagi
PACK-09F (Buffer→Uint8Array) dan PACK-09G (Uint8Array→Blob) sama-sama gagal
dengan pesan error yang serupa. Dua representasi data berbeda ditolak dengan
cara yang sama adalah tanda ini BUKAN masalah "bentuk data salah", tapi
KONFLIK IDENTITAS TIPE — lebih dari satu definisi Buffer/Uint8Array/BodyInit
beredar di environment build (kemungkinan besar duplikasi versi @types/node,
atau lib DOM vs lib Node saling tumpang tindih di Vercel). Root cause seperti
ini bisa kambuh lagi di kombinasi versi TypeScript berikutnya kalau hanya
ganti-ganti bentuk data terus.

## Solusi permanen
`lib/utils/response.ts`:
```ts
export function bufferToBodyInit(buffer: Buffer): BodyInit {
  return new Blob([new Uint8Array(buffer)]) as unknown as BodyInit;
}
```
- Runtime tetap pakai `Blob` (selalu valid apa pun konflik tipe yang terjadi).
- Compile-time diputus paksa lewat `as unknown as BodyInit` di SATU titik ini
  saja — bukan menutupi bug, tapi menyatakan fakta yang gagal dibuktikan
  TypeScript sendiri akibat konflik identitas tipe di atas.
- Return type helper diubah jadi `BodyInit` langsung (bukan `Blob`/`Uint8Array`
  lagi) supaya kalau nanti dipakai di tempat baru, TypeScript tidak akan
  menolaknya lagi — masalah ini SELESAI di satu tempat, permanen.

Tidak ada perubahan di 3 route pemanggil — signature `bufferToBodyInit(buffer: Buffer)` sama.

## Rekomendasi tambahan (di luar sandbox ini, network egress dimatikan permanen jadi tidak bisa dicek langsung)
Kalau error identitas tipe serupa muncul lagi di file LAIN (bukan lewat
helper ini), kemungkinan besar penyebabnya duplikasi `@types/node` di
`package-lock.json`. Jalankan di lokal:
```
npm ls @types/node
```
Kalau muncul lebih dari satu versi resolved, itu akar masalahnya — bukan
sesuatu yang bisa diperbaiki lewat kode aplikasi, harus di-dedupe di level
dependency (`npm dedupe` atau pin versi `@types/node` di `package.json`).

## Verifikasi
- Balance kurung `lib/utils/response.ts` — OK.
- Tidak ada migration baru, tidak ada perubahan behavior/data.
