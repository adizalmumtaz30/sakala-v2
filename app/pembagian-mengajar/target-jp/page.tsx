import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicContext } from "@/lib/application/academicContext.usecases";
import { getTargetJpView } from "@/lib/application/targetJp.usecases";
import TargetJpWorkspace from "./TargetJpWorkspace";
import { ErrorState, EmptyState } from "@/components/ui/primitives";

// Regulation / Target JP View (Bagian 29) — drill-down dari Pembagian
// Mengajar, sama seperti "Model Jadwal" adalah drill-down dari Akademik.
// Selalu terikat SATU Academic Context aktif (Bagian 8.2/77).
export default async function TargetJpPage() {
  try {
    const supabase = await createClient();
    const activeContext = await getActiveAcademicContext(supabase);

    if (!activeContext) {
      return (
        <div className="mx-auto max-w-lg pt-10">
          <EmptyState
            title="Belum ada konteks akademik aktif"
            description="Aktifkan Tahun Ajaran & Semester di halaman Akademik dulu sebelum melihat Target JP."
          />
        </div>
      );
    }

    const view = await getTargetJpView(supabase, activeContext.id);

    return (
      <TargetJpWorkspace
        activeContextLabel={`${activeContext.tahunPelajaran} · ${activeContext.semester === "ganjil" ? "Ganjil" : "Genap"}`}
        view={view}
      />
    );
  } catch {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat Target JP dari Supabase. Cek koneksi dan environment variable kamu." />
      </div>
    );
  }
}
