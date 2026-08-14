import { createClient } from "@/lib/supabase/server";
import { listAcademicContexts } from "@/lib/application/academicContext.usecases";
import { listScheduleModels } from "@/lib/application/scheduleModel.usecases";
import { listGuru } from "@/lib/application/guru.usecases";
import { listKelas } from "@/lib/application/kelas.usecases";
import { listMataPelajaran } from "@/lib/application/mata-pelajaran.usecases";
import { listRuangan } from "@/lib/application/ruangan.usecases";
import { listScheduleAssignments } from "@/lib/application/scheduleAssignment.usecases";
import JadwalCerdasWorkspace from "./JadwalCerdasWorkspace";
import { ErrorState } from "@/components/ui/primitives";

export default async function JadwalCerdasPage() {
  try {
    const supabase = await createClient();
    const contexts = await listAcademicContexts(supabase);
    const activeContext = contexts.find((c) => c.isActive) ?? null;

    if (!activeContext) {
      return (
        <JadwalCerdasWorkspace
          activeContext={null}
          scheduleModels={[]}
          guruList={[]}
          kelasList={[]}
          mapelList={[]}
          ruanganList={[]}
          candidateAssignments={[]}
        />
      );
    }

    const [scheduleModels, guruList, kelasList, mapelList, ruanganList, allAssignments] = await Promise.all([
      listScheduleModels(supabase, activeContext.id),
      listGuru(supabase),
      listKelas(supabase),
      listMataPelajaran(supabase),
      listRuangan(supabase),
      listScheduleAssignments(supabase, activeContext.id),
    ]);

    const candidateAssignments = allAssignments.filter((a) => a.status === "candidate");

    return (
      <JadwalCerdasWorkspace
        activeContext={activeContext}
        scheduleModels={scheduleModels}
        guruList={guruList}
        kelasList={kelasList}
        mapelList={mapelList}
        ruanganList={ruanganList}
        candidateAssignments={candidateAssignments}
      />
    );
  } catch {
    // Bagian 15.3 — server-side fetch gagal, tetap render UI dengan error state.
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat data Jadwal Cerdas dari Supabase. Cek koneksi dan environment variable kamu." />
      </div>
    );
  }
}
