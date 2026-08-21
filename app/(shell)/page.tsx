import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDashboardSummary } from "@/lib/application/dashboard.usecases";
import { getDashboardIntelligence } from "@/lib/application/dashboard.intelligence";
import { getRecentNotifications } from "@/lib/application/notifications.usecases";
import { formatContextLabel } from "@/lib/domain/academicContext";
import { EmptyState, ErrorState, Card } from "@/components/ui/primitives";
import DashboardExperience from "@/components/dashboard/DashboardExperience";
import { guruRepository } from "@/lib/data-access/guru.repository";
import { kelasRepository } from "@/lib/data-access/kelas.repository";

export default async function DashboardPage() {
  try {
    const supabase = await createClient();
    const summary = await getDashboardSummary(supabase);
    if (!summary.activeContext) {
      return <div className="mx-auto max-w-[1440px] px-4 pt-6"><Card><EmptyState title="Belum ada konteks akademik aktif" description="Aktifkan satu Tahun Pelajaran/Semester di Akademik supaya Dashboard menampilkan ringkasan jadwal dan JP." action={<Link href="/akademik" className="mt-1 text-[12.5px] font-semibold text-brand-600">Buka Akademik →</Link>} /></Card></div>;
    }
    const guruList = await guruRepository.findAll(supabase).catch(() => []);
    const kelasList = await kelasRepository.findAll(supabase).catch(() => []);
    const intelligence = await getDashboardIntelligence(
      supabase,
      summary.activeContext.id,
      guruList,
      await getSafeList(supabase, "mata_pelajaran"),
      kelasList,
      await getSafeList(supabase, "ruangan"),
    );
    const notifications = await getRecentNotifications(supabase, summary.activeContext.id).catch(() => []);
    return <DashboardExperience
      schoolName={summary.schoolProfile?.namaSekolah ?? "Sekolah"}
      adminName={summary.schoolProfile?.nama ?? null}
      context={formatContextLabel(summary.activeContext)}
      metrics={summary.metrics}
      jpInsight={summary.jpInsight}
      workload={summary.workloadTop}
      heatmap={intelligence.heatmap}
      heatmapGrid={intelligence.heatmapGrid}
      bebanDistribution={intelligence.bebanDistribution}
      workloadFull={intelligence.workloadFull}
      agenda={intelligence.upcomingAgenda}
      activity={intelligence.recentActivity}
      guruList={guruList}
      notifications={notifications}
    />;
  } catch {
    return <div className="mx-auto max-w-3xl px-4 pt-10"><ErrorState message="Gagal memuat ringkasan Dashboard dari Supabase. Cek koneksi dan environment variable kamu." /></div>;
  }
}

async function getSafeList(supabase: Awaited<ReturnType<typeof createClient>>, table: string): Promise<any[]> {
  try {
    const { data, error } = await supabase.from(table).select("*").limit(500);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}
