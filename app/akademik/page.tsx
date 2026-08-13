import { createClient } from "@/lib/supabase/server";
import { getSchoolProfile } from "@/lib/application/schoolProfile.usecases";
import { listAcademicContexts } from "@/lib/application/academicContext.usecases";
import { listPeriodeAkademik } from "@/lib/application/periodeAkademik.usecases";
import { listJamPelajaran } from "@/lib/application/jamPelajaran.usecases";
import AkademikWorkspace from "./AkademikWorkspace";
import { ErrorState } from "@/components/ui/primitives";

export default async function AkademikPage() {
  try {
    const supabase = await createClient();
    const [profile, contexts] = await Promise.all([getSchoolProfile(supabase), listAcademicContexts(supabase)]);

    // Bagian 19/83 — Periode Akademik & Jam Pelajaran selalu dilihat dalam
    // konteks akademik yang sedang aktif (Bagian 8.2/77 — single source of truth).
    const activeContext = contexts.find((c) => c.isActive) ?? null;
    const [periodeList, jamList] = activeContext
      ? await Promise.all([
          listPeriodeAkademik(supabase, activeContext.id),
          listJamPelajaran(supabase, activeContext.id),
        ])
      : [[], []];

    return (
      <AkademikWorkspace
        initialProfile={profile}
        initialContexts={contexts}
        initialPeriodeList={periodeList}
        initialJamList={jamList}
      />
    );
  } catch {
    // Bagian 15.3 — server-side fetch gagal, tetap render UI dengan error state
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat data akademik dari Supabase. Cek koneksi dan environment variable kamu." />
      </div>
    );
  }
}
