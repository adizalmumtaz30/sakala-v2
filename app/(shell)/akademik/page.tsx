import { createClient } from "@/lib/supabase/server";
import { getSchoolProfile } from "@/lib/application/schoolProfile.usecases";
import { listAcademicContexts } from "@/lib/application/academicContext.usecases";
import { listPeriodeAkademik } from "@/lib/application/periodeAkademik.usecases";
import { listJamPelajaran } from "@/lib/application/jamPelajaran.usecases";
import { listScheduleModels } from "@/lib/application/scheduleModel.usecases";
import { listKelas } from "@/lib/application/kelas.usecases";
import { listCurriculumIntelligenceAction } from "./mata-pelajaran/curriculum-actions";
import AkademikWorkspace from "./AkademikWorkspace";
import { ErrorState } from "@/components/ui/primitives";

export default async function AkademikPage() {
  try {
    const supabase = await createClient();
    const [profile, contexts] = await Promise.all([getSchoolProfile(supabase), listAcademicContexts(supabase)]);

    // Bagian 19/83 — Periode Akademik, Jam Pelajaran & Schedule Model selalu
    // dilihat dalam konteks akademik yang sedang aktif (Bagian 8.2/77 —
    // single source of truth).
    const activeContext = contexts.find((c) => c.isActive) ?? null;
    const [periodeList, jamList, scheduleModels, kelasList] = activeContext
      ? await Promise.all([
          listPeriodeAkademik(supabase, activeContext.id),
          listJamPelajaran(supabase, activeContext.id),
          listScheduleModels(supabase, activeContext.id),
          listKelas(supabase, activeContext.id),
        ])
      : [[], [], [], []];

    // Curriculum Intelligence sebagai capability, bukan destinasi — Konteks
    // Akademik hanya perlu tahu APAKAH kurikulum resmi terverifikasi sudah
    // tersedia untuk kelas-kelas di konteks aktif, supaya bisa menawarkan
    // [Siapkan Kurikulum] hanya saat memang belum ada (silent kalau sudah).
    let curriculumAvailable = true;
    if (activeContext) {
      const classLevels = new Set(kelasList.map((k) => k.tingkat));
      if (classLevels.size > 0) {
        const intelligence = await listCurriculumIntelligenceAction("all");
        curriculumAvailable = intelligence.ok
          ? intelligence.data.items.some((item) => {
              const version = intelligence.data.versions.find((v) => v.id === item.curriculum_version_id);
              if (!version || version.verification_status !== "verified") return false;
              const source = intelligence.data.sources.find((s) => s.id === version.source_id);
              if (!source || source.status !== "official" || source.source_tier !== 1) return false;
              return classLevels.has(item.class_level);
            })
          : true; // gagal cek → jangan tampilkan klaim "belum tersedia" yang keliru
      }
    }

    return (
      <AkademikWorkspace
        initialProfile={profile}
        initialContexts={contexts}
        initialPeriodeList={periodeList}
        initialJamList={jamList}
        initialScheduleModels={scheduleModels}
        curriculumAvailable={curriculumAvailable}
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
