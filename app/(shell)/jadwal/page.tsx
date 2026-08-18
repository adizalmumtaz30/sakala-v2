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
import JadwalWorkspace from "./JadwalWorkspace";
import JadwalDragDrop from "@/components/jadwal/JadwalDragDrop";
import { ErrorState } from "@/components/ui/primitives";

export default async function JadwalPage() {
  try {
    const supabase = await createClient();
    const contexts = await listAcademicContexts(supabase);
    const activeContext = contexts.find((c) => c.isActive) ?? null;

    if (!activeContext) {
      return (
        <JadwalWorkspace
          activeContext={null}
          scheduleModels={[]}
          jamPelajaranList={[]}
          slotTemplatesByModel={{}}
          guruList={[]}
          kelasList={[]}
          mapelList={[]}
          ruanganList={[]}
          assignments={[]}
        />
      );
    }

    const [scheduleModels, jamPelajaranList, guruList, kelasList, mapelList, ruanganList, allAssignments] = await Promise.all([
      listScheduleModels(supabase, activeContext.id),
      listJamPelajaran(supabase, activeContext.id),
      listGuru(supabase),
      listKelas(supabase),
      listMataPelajaran(supabase),
      listRuangan(supabase),
      listScheduleAssignments(supabase, activeContext.id),
    ]);

    const slotTemplateLists = await Promise.all(scheduleModels.map((m) => listSlotTemplate(supabase, m.id)));
    const slotTemplatesByModel: Record<string, Awaited<ReturnType<typeof listSlotTemplate>>> = {};
    scheduleModels.forEach((m, i) => {
      slotTemplatesByModel[m.id] = slotTemplateLists[i];
    });

    const classNames = Object.fromEntries(kelasList.map((k) => [k.id, `${k.tingkat} ${k.namaRombel}`]));
    const subjectNames = Object.fromEntries(mapelList.map((m) => [m.id, m.nama]));
    const teacherNames = Object.fromEntries(guruList.map((g) => [g.id, g.namaGuru]));

    return (
      <div className="space-y-4">
        <JadwalDragDrop
          scheduleModels={scheduleModels}
          jamPelajaranList={jamPelajaranList}
          assignments={allAssignments}
          classNames={classNames}
          subjectNames={subjectNames}
          teacherNames={teacherNames}
        />
        <JadwalWorkspace
          activeContext={activeContext}
          scheduleModels={scheduleModels}
          jamPelajaranList={jamPelajaranList}
          slotTemplatesByModel={slotTemplatesByModel}
          guruList={guruList}
          kelasList={kelasList}
          mapelList={mapelList}
          ruanganList={ruanganList}
          assignments={allAssignments}
        />
      </div>
    );
  } catch {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat data Jadwal dari Supabase. Cek koneksi dan environment variable kamu." />
      </div>
    );
  }
}
