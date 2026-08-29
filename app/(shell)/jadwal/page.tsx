import { createClient } from "@/lib/supabase/server";
import { listAcademicContexts } from "@/lib/application/academicContext.usecases";
import { listScheduleModels } from "@/lib/application/scheduleModel.usecases";
import { listSlotTemplate } from "@/lib/application/slotTemplate.usecases";
import { listJamPelajaran } from "@/lib/application/jamPelajaran.usecases";
import { listGuru } from "@/lib/application/guru.usecases";
import { listKelas } from "@/lib/application/kelas.usecases";
import { listMataPelajaran } from "@/lib/application/mata-pelajaran.usecases";
import { listRuangan } from "@/lib/application/ruangan.usecases";
import { listScheduleAssignments } from "@/lib/application/scheduleAssignment.usecases";
import { listPembagianMengajar } from "@/lib/application/pembagianMengajar.usecases";
import { getSchoolProfile } from "@/lib/application/schoolProfile.usecases";
import JadwalUnifiedWorkspace from "./JadwalUnifiedWorkspace";
import JadwalPointerDrag from "@/components/jadwal/JadwalPointerDrag";
import { ErrorState, EmptyState } from "@/components/ui/primitives";

export default async function JadwalPage() {
  try {
    const supabase = await createClient();
    const contexts = await listAcademicContexts(supabase);
    const activeContext = contexts.find((c) => c.isActive) ?? null;

    if (!activeContext) {
      return <div className="mx-auto max-w-6xl pt-10"><EmptyState title="Belum ada konteks akademik aktif" description="Aktifkan satu konteks akademik dulu di halaman Akademik sebelum membuka Jadwal." /></div>;
    }

    const [scheduleModels, jamPelajaranList, guruList, kelasList, mapelList, ruanganList, allAssignments, pembagianMengajarList, schoolProfile] = await Promise.all([
      listScheduleModels(supabase, activeContext.id),
      listJamPelajaran(supabase, activeContext.id),
      listGuru(supabase),
      listKelas(supabase),
      listMataPelajaran(supabase),
      listRuangan(supabase),
      listScheduleAssignments(supabase, activeContext.id),
      listPembagianMengajar(supabase, activeContext.id),
      getSchoolProfile(supabase),
    ]);

    const slotTemplateLists = await Promise.all(scheduleModels.map((m) => listSlotTemplate(supabase, m.id)));
    const slotTemplatesByModel: Record<string, Awaited<ReturnType<typeof listSlotTemplate>>> = {};
    scheduleModels.forEach((m, i) => { slotTemplatesByModel[m.id] = slotTemplateLists[i]; });
    const contextLabel = `${activeContext.tahunPelajaran} · ${activeContext.semester === "ganjil" ? "Ganjil" : "Genap"}`;
    const candidateAssignments = allAssignments.filter((a) => a.status === "candidate");

    return (
      <div data-sakala-jadwal-root>
        <h1 className="sr-only">Jadwal</h1>
        <JadwalPointerDrag academicContextId={activeContext.id} scheduleModels={scheduleModels} assignments={allAssignments} />
        <JadwalUnifiedWorkspace
          activeContext={activeContext}
          scheduleModels={scheduleModels}
          jamPelajaranList={jamPelajaranList}
          slotTemplatesByModel={slotTemplatesByModel}
          guruList={guruList}
          kelasList={kelasList}
          mapelList={mapelList}
          ruanganList={ruanganList}
          assignments={allAssignments}
          candidateAssignments={candidateAssignments}
          pembagianMengajarList={pembagianMengajarList.filter((p) => p.status === "aktif")}
          schoolName={schoolProfile?.namaSekolah}
          contextLabel={contextLabel}
        />
      </div>
    );
  } catch {
    return <div className="mx-auto max-w-3xl pt-10"><ErrorState message="Gagal memuat data Jadwal dari Supabase. Cek koneksi dan environment variable kamu." /></div>;
  }
}
