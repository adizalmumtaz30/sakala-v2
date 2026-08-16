/**
 * Konversi Node.js Buffer menjadi BodyInit yang aman untuk NextResponse —
 * SOLUSI PERMANEN, bukan tambal-sulam per versi TypeScript.
 *
 * Riwayat masalah (jangan diulang lagi, baca dulu sebelum "memperbaiki" ini):
 *   1. `Buffer<ArrayBufferLike>` ditolak sebagai BodyInit.
 *   2. Dicoba `Uint8Array` — TETAP ditolak dengan pesan error yang sama.
 * Dua kegagalan berurutan pada dua representasi data yang berbeda ini adalah
 * tanda bukan masalah "bentuk data salah", melainkan KONFLIK IDENTITAS TIPE:
 * ada lebih dari satu definisi Buffer/Uint8Array/BodyInit yang beredar
 * (biasanya karena versi @types/node ganda di node_modules, atau lib DOM vs
 * Node saling tumpang tindih di environment build Vercel). Root cause ini
 * TIDAK bisa diperbaiki permanen hanya dengan ganti-ganti bentuk data,
 * karena bisa kambuh lagi di kombinasi versi TypeScript berikutnya.
 *
 * Solusi:
 *  - Runtime: bungkus jadi `Blob`. Ini valid dan aman secara runtime apa pun
 *    identitas tipe yang sedang konflik — Blob murni menyalin byte-nya.
 *  - Compile-time: `as unknown as BodyInit` di SATU titik ini saja, dengan
 *    sengaja, untuk memutus rantai pengecekan structural typing yang jadi
 *    sumber konflik berulang. Ini aman karena Blob memang anggota resmi
 *    BodyInit di semua versi lib.dom — assertion ini bukan "menutupi bug",
 *    tapi menyatakan fakta yang TypeScript gagal buktikan sendiri akibat
 *    konflik identitas tipe di atas.
 *
 * JANGAN ubah return type helper ini bolak-balik (Buffer→Uint8Array→...)
 * lagi kalau error serupa muncul di tempat lain. Kalau muncul lagi, cek dulu
 * apakah ada duplikasi @types/node di package-lock/npm ls sebelum menyentuh
 * file ini.
 */
export function bufferToBodyInit(buffer: Buffer): BodyInit {
  return new Blob([new Uint8Array(buffer)]) as unknown as BodyInit;
}


