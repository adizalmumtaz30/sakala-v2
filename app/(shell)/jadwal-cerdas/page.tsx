"use client";

// Halaman ini sebelumnya berisi implementasi Jadwal Cerdas (Generate &
// Kandidat) sebagai route terpisah. Sekarang digabung sebagai tab di dalam
// /jadwal (Core Consolidation -- Bagian 16, Minimum Page Switching).
// Redirect dipertahankan (bukan dihapus route-nya) supaya bookmark/tautan
// lama tetap sampai ke tempat yang benar.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyJadwalCerdasRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/jadwal?mode=cerdas");
  }, [router]);
  return null;
}
