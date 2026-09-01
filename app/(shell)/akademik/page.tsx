import { createClient } from "@/lib/supabase/server";
import { getSchoolProfile } from "@/lib/application/schoolProfile.usecases";
import { listAcademicContexts } from "@/lib/application/academicContext.usecases";
import { listPeriodeAkademik } from "@/lib/application/periodeAkademik.usecases";
import { listJamPelajaran } from "@/lib/application/jamPelajaran.usecases";
import { listScheduleModels } from "@/lib/application/scheduleModel.usecases";
import AcademicFoundationWorkspace from "./AcademicFoundationWorkspace";
import { ErrorState } from "@/components/ui/primitives";

export default async function AkademikPage() {
  try {
    const supabase = await createClient();
    const [profile, contexts] = await Promise.all([getSchoolProfile(supabase), listAcademicContexts(supabase)]);
    const activeContext = contexts.find((c) => c.isActive) ?? null;
    const [periodeList, jamList, scheduleModels] = activeContext
      ? await Promise.all([
          listPeriodeAkademik(supabase, activeContext.id),
          listJamPelajaran(supabase, activeContext.id),
          listScheduleModels(supabase, activeContext.id),
        ])
      : [[], [], []];

    return (
      <AcademicFoundationWorkspace
        initialProfile={profile}
        initialContexts={contexts}
        initialPeriodeList={periodeList}
        initialJamList={jamList}
        initialScheduleModels={scheduleModels}
      />
    );
  } catch {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat data akademik dari Supabase. Cek koneksi dan environment variable kamu." />
      </div>
    );
  }
}
