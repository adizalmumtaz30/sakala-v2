"use client";

// Halaman ini sebelumnya berisi Import/Edit Massal Target JP sebagai route
// terpisah dari halaman Detail (drill-down status guru & jadwal). Sekarang
// digabung jadi satu halaman -- panel Import/Edit Massal bisa dibuka
// langsung dari /pembagian-mengajar/target-jp (Core Consolidation).
// Redirect dipertahankan (bukan dihapus route-nya) supaya bookmark/tautan
// lama tetap sampai ke tempat yang benar.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyTargetJpImportRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/pembagian-mengajar/target-jp");
  }, [router]);
  return null;
}
