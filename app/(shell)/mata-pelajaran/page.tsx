import { createClient } from "@/lib/supabase/server";
import { listMataPelajaran } from "@/lib/application/mata-pelajaran.usecases";
import { getActiveAcademicContext } from "@/lib/application/academicContext.usecases";
import { listKelas } from "@/lib/application/kelas.usecases";
import { listCurriculumIntelligenceAction } from "../akademik/mata-pelajaran/curriculum-actions";
import { tingkatsMatch } from "@/lib/domain/kelas";
import MataPelajaranWorkspace from "./MataPelajaranWorkspace";
import { ErrorState } from "@/components/ui/primitives";

export default async function MataPelajaranPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  try {
    const supabase = await createClient();
    const data = await listMataPelajaran(supabase);
    const { q } = await searchParams;

    // Curriculum Alignment sebagai capability, bukan tombol yang selalu
    // tampil — Mata Pelajaran hanya perlu tahu APAKAH ada mata pelajaran
    // dari kurikulum resmi yang belum terhubung dengan data master saat ini,
    // supaya bisa menawarkan [Periksa Mapping] cuma saat memang relevan.
    let unmatchedCurriculumSubjects: string[] = [];
    const activeContext = await getActiveAcademicContext(supabase);
    if (activeContext) {
      const kelasList = await listKelas(supabase, activeContext.id);
      const classLevels = kelasList.map((k) => k.tingkat);
      const intelligence = await listCurriculumIntelligenceAction("all");
      if (intelligence.ok && classLevels.length > 0) {
        const officialVersionIds = new Set(
          intelligence.data.versions
            .filter((v) => v.verification_status === "verified")
            .filter((v) => intelligence.data.sources.some((s) => s.id === v.source_id && s.status === "official" && s.source_tier === 1))
            .map((v) => v.id)
        );
        const existingNames = new Set(data.map((m) => m.nama.trim().toLowerCase()));
        const relevantNames = new Set(
          intelligence.data.items
            .filter((item) => officialVersionIds.has(item.curriculum_version_id) && classLevels.some((t) => tingkatsMatch(t, item.class_level)))
            .map((item) => item.subject_name)
        );
        unmatchedCurriculumSubjects = Array.from(relevantNames).filter((name) => !existingNames.has(name.trim().toLowerCase()));
      }
    }

    return <MataPelajaranWorkspace initialData={data} initialQuery={q ?? ""} unmatchedCurriculumSubjects={unmatchedCurriculumSubjects} />;
  } catch {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat data mata pelajaran dari Supabase." />
      </div>
    );
  }
}
