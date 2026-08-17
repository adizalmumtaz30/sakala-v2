import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getGuruById } from "@/lib/application/guru.usecases";
import { listAcademicContexts } from "@/lib/application/academicContext.usecases";
import { listScheduleModels } from "@/lib/application/scheduleModel.usecases";
import { listSlotTemplate } from "@/lib/application/slotTemplate.usecases";
import { listJamPelajaran } from "@/lib/application/jamPelajaran.usecases";
import { listKelas } from "@/lib/application/kelas.usecases";
import { listMataPelajaran } from "@/lib/application/mata-pelajaran.usecases";
import { listRuangan } from "@/lib/application/ruangan.usecases";
import { listScheduleAssignments } from "@/lib/application/scheduleAssignment.usecases";
import { ErrorState, EmptyState } from "@/components/ui/primitives";
import TeacherJadwalView from "./TeacherJadwalView";

// Data > Guru > 👁 — Teacher Schedule View (Bagian 8-9 spesifikasi V2.3).
// View-only, disederhanakan dari Jadwal Utama (Bagian 9.4 — TIDAK BOLEH
// mengubah desain/logic Jadwal Utama, cukup reshape data yang SAMA lewat
// buildJadwalGrid() yang sudah ada). Hanya menampilkan status "committed"
// (Master Schedule View tetap satu-satunya sumber kebenaran jadwal).

export default async function GuruJadwalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const supabase = await createClient();
    const guru = await getGuruById(supabase, id);
    if (!guru) notFound();

    const contexts = await listAcademicContexts(supabase);
    const activeContext = contexts.find((c) => c.isActive) ?? null;

    if (!activeContext) {
      return (
        <div className="mx-auto max-w-2xl pt-10">
          <EmptyState
            title="Konteks Akademik Belum Aktif"
            description="Aktifkan konteks akademik dulu di halaman Akademik untuk melihat jadwal guru."
          />
        </div>
      );
    }

    const [scheduleModels, jamPelajaranList, kelasList, mapelList, ruanganList, allAssignments] = await Promise.all([
      listScheduleModels(supabase, activeContext.id),
      listJamPelajaran(supabase, activeContext.id),
      listKelas(supabase),
      listMataPelajaran(supabase),
      listRuangan(supabase),
      listScheduleAssignments(supabase, activeContext.id),
    ]);

    const activeModel = scheduleModels.find((m) => m.status === "aktif") ?? null;
    const slotTemplates = activeModel ? await listSlotTemplate(supabase, activeModel.id) : [];

    const committedForTeacher = allAssignments.filter(
      (a) => a.status === "committed" && a.teacherId === guru.id && (!activeModel || a.scheduleModelId === activeModel.id)
    );

    return (
      <TeacherJadwalView
        guru={guru}
        activeModel={activeModel}
        jamPelajaranList={jamPelajaranList}
        slotTemplates={slotTemplates}
        assignments={committedForTeacher}
        kelasList={kelasList}
        mapelList={mapelList}
        ruanganList={ruanganList}
      />
    );
  } catch {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <ErrorState message="Gagal memuat jadwal guru dari Supabase. Cek koneksi dan environment variable kamu." />
      </div>
    );
  }
}
