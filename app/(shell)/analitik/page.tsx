import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicContext } from "@/lib/application/academicContext.usecases";
import { getAnalitikView } from "@/lib/application/analitik.usecases";
import { getSchoolProfile } from "@/lib/application/schoolProfile.usecases";
import AnalitikWorkspace from "./AnalitikWorkspace";
import { ErrorState, EmptyState } from "@/components/ui/primitives";

export default async function AnalitikPage() {
  try {
    const supabase = await createClient();
    const activeContext = await getActiveAcademicContext(supabase);

    if (!activeContext) {
      return (
        <div className="mx-auto max-w-lg pt-10">
          <EmptyState title="Belum ada konteks akademik aktif" description="Aktifkan Tahun Ajaran & Semester di halaman Akademik dulu sebelum melihat Analitik." />
        </div>
      );
    }

    const [view, schoolProfile] = await Promise.all([
      getAnalitikView(supabase, activeContext.id),
      getSchoolProfile(supabase),
    ]);
    const contextLabel = `${activeContext.tahunPelajaran} · ${activeContext.semester === "ganjil" ? "Ganjil" : "Genap"}`;

    return (
      <div className="w-full pb-12">
        <AnalitikWorkspace activeContextLabel={contextLabel} schoolName={schoolProfile?.namaSekolah} view={view} />
      </div>
    );
  } catch {
    return <div className="mx-auto max-w-3xl pt-10"><ErrorState message="Gagal memuat Analitik dari Supabase. Cek koneksi dan environment variable kamu." /></div>;
  }
}
