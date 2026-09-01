import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import { getActiveAcademicContext } from "@/lib/application/academicContext.usecases";
import { listPembagianMengajar } from "@/lib/application/pembagianMengajar.usecases";
import { listGuru } from "@/lib/application/guru.usecases";
import { listMataPelajaran } from "@/lib/application/mata-pelajaran.usecases";
import { listKelas } from "@/lib/application/kelas.usecases";
import PembagianMengajarWorkspace from "./PembagianMengajarWorkspace";
import { ErrorState, EmptyState } from "@/components/ui/primitives";

// Pembagian Mengajar (Bagian 35-36 / 72-75) — selalu terikat SATU Academic
// Context aktif (Bagian 8.2/77), sama seperti Schedule Model & Jadwal Cerdas.
export default async function PembagianMengajarPage() {
  try {
    const supabase = await createClient();
    const activeContext = await getActiveAcademicContext(supabase);

    if (!activeContext) {
      return (
        <div className="mx-auto max-w-lg pt-10">
          <EmptyState
            title="Belum ada konteks akademik aktif"
            description="Aktifkan Tahun Ajaran & Semester di halaman Akademik dulu sebelum mengelola Pembagian Mengajar."
          />
        </div>
      );
    }

    const [items, guruList, mapelList, kelasList] = await Promise.all([
      listPembagianMengajar(supabase, activeContext.id),
      listGuru(supabase),
      listMataPelajaran(supabase),
      listKelas(supabase),
    ]);

    return (
      <Suspense fallback={null}>
        <PembagianMengajarWorkspace
          activeContextId={activeContext.id}
          activeContextLabel={`${activeContext.tahunPelajaran} · ${activeContext.semester === "ganjil" ? "Ganjil" : "Genap"}`}
          initialData={items}
          guruList={guruList.filter((g) => g.status === "aktif")}
          mapelList={mapelList.filter((m) => m.status === "aktif")}
          kelasList={kelasList.filter((k) => k.status === "aktif")}
        />
      </Suspense>
    );
  } catch {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat data Pembagian Mengajar dari Supabase. Cek koneksi dan environment variable kamu." />
      </div>
    );
  }
}
