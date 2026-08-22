"use client";

// Halaman ini sebelumnya berisi implementasi Generate Kurikulum versi lama (pre-V4).
// Implementasi lengkap (32/38 poin spec V4) sekarang ada di /akademik/generate-kurikulum.
// Redirect dipertahankan (bukan dihapus route-nya) supaya bookmark/tautan lama tetap sampai ke tempat yang benar.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyMataPelajaranCurriculumRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/akademik/generate-kurikulum");
  }, [router]);
  return null;
}
