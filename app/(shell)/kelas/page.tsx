import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicContext } from "@/lib/application/academicContext.usecases";
import { listKelas } from "@/lib/application/kelas.usecases";
import KelasWorkspace from "./KelasWorkspace";
import { ErrorState, EmptyState } from "@/components/ui/primitives";

export default async function KelasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  try {
    const supabase = await createClient();
    const activeContext = await getActiveAcademicContext(supabase);
    if (!activeContext) {
      return (
        <div className="mx-auto max-w-lg pt-10">
          <EmptyState
            title="Belum ada konteks akademik aktif"
            description="Aktifkan Tahun Ajaran & Semester di halaman Akademik dulu sebelum mengelola kelas."
          />
        </div>
      );
    }
    const data = await listKelas(supabase, activeContext.id);
    const { q } = await searchParams;
    return (
      <KelasWorkspace
        initialData={data}
        initialQuery={q ?? ""}
        activeContextLabel={`${activeContext.tahunPelajaran} · ${activeContext.semester === "ganjil" ? "Ganjil" : "Genap"}`}
      />
    );
  } catch {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat data kelas dari Supabase." />
      </div>
    );
  }
}
