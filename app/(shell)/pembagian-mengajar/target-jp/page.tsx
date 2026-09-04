import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicContext } from "@/lib/application/academicContext.usecases";
import { getTargetJpView } from "@/lib/application/targetJp.usecases";
import { listGuru } from "@/lib/application/guru.usecases";
import { listCurriculumIntelligenceAction } from "../../akademik/mata-pelajaran/curriculum-actions";
import TargetJpWorkspace from "./TargetJpWorkspace";
import { ErrorState, EmptyState } from "@/components/ui/primitives";

// Regulation / Target JP View (Bagian 29) — drill-down dari Pembagian
// Mengajar, sama seperti "Model Jadwal" adalah drill-down dari Akademik.
// Selalu terikat SATU Academic Context aktif (Bagian 8.2/77).
export default async function TargetJpPage() {
  try {
    const supabase = await createClient();
    const activeContext = await getActiveAcademicContext(supabase);

    if (!activeContext) {
      return (
        <div className="mx-auto max-w-lg pt-10">
          <EmptyState
            title="Belum ada konteks akademik aktif"
            description="Aktifkan Tahun Ajaran & Semester di halaman Akademik dulu sebelum melihat Target JP."
          />
        </div>
      );
    }

    const view = await getTargetJpView(supabase, activeContext.id);

    // Curriculum Intelligence sebagai capability, bukan destinasi — Target JP
    // hanya perlu tahu APAKAH ada kurikulum resmi terverifikasi yang bisa
    // dipakai, supaya bisa menawarkan [Generate dari Kurikulum] secara
    // kontekstual saat memang dibutuhkan (Target JP kosong).
    let curriculumAvailable = false;
    if (view.overallTargetJp === 0) {
      const intelligence = await listCurriculumIntelligenceAction("all");
      if (intelligence.ok) {
        const officialVersionIds = new Set(
          intelligence.data.versions
            .filter((v) => v.verification_status === "verified")
            .filter((v) => intelligence.data.sources.some((s) => s.id === v.source_id && s.status === "official" && s.source_tier === 1))
            .map((v) => v.id)
        );
        curriculumAvailable = intelligence.data.items.some((item) => officialVersionIds.has(item.curriculum_version_id));
      }
    }

    // §5 analisis mendalam: tandai (secara global, bukan per-baris — audit_log
    // untuk jalur ini tidak menyimpan entity_id per baris) kalau konteks ini
    // pernah dikoreksi lewat jalur manual/import, supaya operator tahu ada
    // kemungkinan sebagian angka bukan murni dari Generate Kurikulum.
    const { data: overrideLog } = await supabase
      .from("audit_log")
      .select("id")
      .eq("entity_type", "target_jp")
      .eq("academic_context_id", activeContext.id)
      .eq("source", "import")
      .limit(1);
    const hasManualOverrideHistory = (overrideLog?.length ?? 0) > 0;

    // §2 solusi "tidak perlu pindah halaman": daftar guru aktif untuk
    // tugaskan langsung dari baris "Guru Belum Ditentukan", tanpa harus ke
    // Pembagian Mengajar dulu.
    const guruList = await listGuru(supabase);

    return (
      <TargetJpWorkspace
        activeContextId={activeContext.id}
        activeContextLabel={`${activeContext.tahunPelajaran} · ${activeContext.semester === "ganjil" ? "Ganjil" : "Genap"}`}
        view={view}
        curriculumAvailable={curriculumAvailable}
        hasManualOverrideHistory={hasManualOverrideHistory}
        guruList={guruList.filter((g) => g.status === "aktif")}
      />
    );
  } catch {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat Target JP dari Supabase. Cek koneksi dan environment variable kamu." />
      </div>
    );
  }
}
