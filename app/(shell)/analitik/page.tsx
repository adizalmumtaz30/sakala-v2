import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicContext } from "@/lib/application/academicContext.usecases";
import { getAnalitikView } from "@/lib/application/analitik.usecases";
import AnalitikWorkspace from "./AnalitikWorkspace";
import ReportExportBar from "@/components/ui/ReportExportBar";
import { ErrorState, EmptyState } from "@/components/ui/primitives";

export default async function AnalitikPage() {
  try {
    const supabase = await createClient();
    const activeContext = await getActiveAcademicContext(supabase);

    if (!activeContext) {
      return (
        <div className="mx-auto max-w-lg pt-10">
          <EmptyState title="Belum ada konteks akademik aktif" description="Aktifkan Tahun Ajaran & Semester di halaman Akademik dulu sebelum melihat Analitik." />
        </div>
      );
    }

    const view = await getAnalitikView(supabase, activeContext.id);
    const contextLabel = `${activeContext.tahunPelajaran} · ${activeContext.semester === "ganjil" ? "Ganjil" : "Genap"}`;
    const rows = [
      ...view.bebanGuru.map((g) => ({ kategori: "Beban Guru", item: g.guruNama, nilai: `${g.totalJamCommitted} JP`, detail: `${g.jumlahKombinasi} kelas`, status: "Data" })),
      ...view.jpBreakdown.map((b) => ({ kategori: "Status JP", item: b.label, nilai: b.count, detail: "kombinasi", status: b.status })),
      ...view.konflikAktif.map((k) => ({ kategori: "Konflik JP", item: `${k.guruNama} · ${k.mataPelajaranNama}`, nilai: `${k.scheduledJp}/${k.targetJp} JP`, detail: k.kelasLabel, status: k.status })),
    ];
    const columns = [
      { key: "kategori", label: "Kategori" },
      { key: "item", label: "Item" },
      { key: "nilai", label: "Nilai" },
      { key: "detail", label: "Detail" },
      { key: "status", label: "Status" },
    ];

    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-12 pt-6">
        <AnalitikWorkspace activeContextLabel={contextLabel} view={view} />
        <ReportExportBar
          title="Analitik SAKALA"
          context={contextLabel}
          columns={columns}
          rows={rows}
          landscape
        />
      </div>
    );
  } catch {
    return <div className="mx-auto max-w-3xl pt-10"><ErrorState message="Gagal memuat Analitik dari Supabase. Cek koneksi dan environment variable kamu." /></div>;
  }
}
