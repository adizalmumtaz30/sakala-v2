// Utility layer — Language Rules (PRODUCTION FLOW, AUTHORITY & AI ACTION
// CONTRACT: "bahasa operator, bukan istilah teknis").
//
// Server action mengembalikan error.message dari Supabase/Postgres LANGSUNG
// ke operator di banyak tempat — operator melihat teks seperti
// 'duplicate key value violates unique constraint "curriculum_source_..."'
// atau 'insert or update on table "x" violates foreign key constraint'.
// Fungsi ini menerjemahkan kode error Postgres yang paling umum jadi bahasa
// Indonesia biasa; error yang tidak dikenali TETAP tidak pernah menampilkan
// teks driver mentah — jatuh ke pesan generik yang aman.

interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
}

const CODE_MESSAGE: Record<string, string> = {
  "23505": "Data ini sudah ada sebelumnya — tidak bisa disimpan dua kali.",
  "23503": "Data ini masih terpakai di tempat lain, jadi belum bisa diubah atau dihapus.",
  "23502": "Ada bagian yang wajib diisi tapi masih kosong.",
  "23514": "Nilai yang dimasukkan tidak sesuai aturan yang diizinkan.",
  "22P02": "Format data yang dikirim tidak sesuai — coba periksa lagi isiannya.",
  "42501": "Kamu tidak punya izin untuk melakukan perubahan ini.",
};

/**
 * Terjemahkan error Postgres/Supabase jadi bahasa operator. Selalu dipakai
 * di titik yang error-nya bakal ditampilkan ke user — jangan pernah
 * mengembalikan error.message driver mentah langsung.
 */
export function toPlainDatabaseError(error: PostgrestLikeError | Error | unknown, fallback = "Terjadi kendala saat menyimpan data. Coba lagi, atau hubungi admin kalau berulang."): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as PostgrestLikeError).code;
    if (code && CODE_MESSAGE[code]) return CODE_MESSAGE[code];
  }
  return fallback;
}
