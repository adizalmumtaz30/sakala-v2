import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicContext } from "@/lib/application/academicContext.usecases";
import { getAnalitikView } from "@/lib/application/analitik.usecases";
import AnalitikWorkspace from "./AnalitikWorkspace";
import { ErrorState, EmptyState } from "@/components/ui/primitives";

// Analitik (step 17) — snapshot kondisi saat ini (beban mengajar, JP,
// konflik), TIDAK ada histori/tren antar waktu (sengaja, demi hemat
// limit/resource — lihat lib/application/analitik.usecases.ts). Selalu
// terikat SATU Academic Context aktif, sama seperti Target JP.
export default async function AnalitikPage() {
  try {
    const supabase = await createClient();
    const activeContext = await getActiveAcademicContext(supabase);

    if (!activeContext) {
      return (
        <div className="mx-auto max-w-lg pt-10">
          <EmptyState
            title="Belum ada konteks akademik aktif"
            description="Aktifkan Tahun Ajaran & Semester di halaman Akademik dulu sebelum melihat Analitik."
          />
        </div>
      );
    }

    const view = await getAnalitikView(supabase, activeContext.id);

    return (
      <AnalitikWorkspace
        activeContextLabel={`${activeContext.tahunPelajaran} · ${activeContext.semester === "ganjil" ? "Ganjil" : "Genap"}`}
        view={view}
      />
    );
  } catch {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat Analitik dari Supabase. Cek koneksi dan environment variable kamu." />
      </div>
    );
  }
}
