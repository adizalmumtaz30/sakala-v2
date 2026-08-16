import Link from "next/link";
import { Users, BookOpen, DoorOpen, School, ClipboardCheck, CalendarCheck2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardSummary, type DashboardKeyMetrics, type DashboardJpInsight, type DashboardWorkloadEntry } from "@/lib/application/dashboard.usecases";
import { formatContextLabel } from "@/lib/domain/academicContext";
import { Card, Badge, EmptyState, ErrorState } from "@/components/ui/primitives";

export default async function DashboardPage() {
  try {
    const supabase = await createClient();
    const summary = await getDashboardSummary(supabase);
    const schoolName = summary.schoolProfile?.namaSekolah ?? "Sekolah";

    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 pt-6">
        {/* Academic Context + Greeting (Bagian 31.1) */}
        <div>
          <p className="text-[12.5px] font-medium text-brand-600">
            {summary.activeContext ? formatContextLabel(summary.activeContext) : "Belum ada konteks akademik aktif"}
          </p>
          <h1 className="text-[22px] font-bold text-ink-900">Selamat datang kembali</h1>
          <p className="text-[13px] text-ink-500">Ringkasan kondisi {schoolName} saat ini.</p>
        </div>

        {!summary.activeContext ? (
          <Card>
            <EmptyState
              title="Belum ada konteks akademik aktif"
              description="Aktifkan satu Tahun Pelajaran/Semester di halaman Akademik dulu supaya Dashboard bisa menampilkan ringkasan jadwal dan JP."
              action={
                <Link href="/akademik" className="text-[12.5px] font-medium text-brand-600 hover:text-brand-700">
                  Buka Akademik →
                </Link>
              }
            />
          </Card>
        ) : (
          <>
            <KeyMetrics metrics={summary.metrics} />
            <JpInsightCard insight={summary.jpInsight} />
            <WorkloadCard entries={summary.workloadTop} />
          </>
        )}

        {/* Bagian 31.1 — Heatmap, Upcoming Agenda, Recent Activity SENGAJA
            belum ada di sini: butuh data Analitik/Riwayat/Notifikasi (step
            17-19 Build Pipeline) yang belum dibangun. Dicatat eksplisit
            (Bagian 70) supaya tidak terkesan diam-diam dihilangkan. */}
        <Card className="border-dashed bg-transparent">
          <p className="text-[12px] text-ink-400">
            Heatmap jadwal, Agenda mendatang, dan Aktivitas terbaru menyusul setelah Analitik, Riwayat, dan Notifikasi
            dibangun (step 17-19).
          </p>
        </Card>
      </div>
    );
  } catch {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat ringkasan Dashboard dari Supabase. Cek koneksi dan environment variable kamu." />
      </div>
    );
  }
}

function KeyMetrics({ metrics }: { metrics: DashboardKeyMetrics }) {
  const items: { label: string; value: number; href: string; icon: React.ReactNode }[] = [
    { label: "Guru Aktif", value: metrics.totalGuruAktif, href: "/guru", icon: <Users size={16} /> },
    { label: "Mata Pelajaran Aktif", value: metrics.totalMataPelajaranAktif, href: "/mata-pelajaran", icon: <BookOpen size={16} /> },
    { label: "Kelas", value: metrics.totalKelas, href: "/kelas", icon: <School size={16} /> },
    { label: "Ruangan", value: metrics.totalRuangan, href: "/ruangan", icon: <DoorOpen size={16} /> },
    { label: "Pembagian Mengajar Aktif", value: metrics.totalPembagianMengajarAktif, href: "/pembagian-mengajar", icon: <ClipboardCheck size={16} /> },
    { label: "Jadwal Committed", value: metrics.totalJadwalCommitted, href: "/jadwal", icon: <CalendarCheck2 size={16} /> },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 transition-colors hover:border-brand-600/30 hover:bg-brand-50/40"
        >
          <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-500">
            {item.icon} {item.label}
          </span>
          <span className="text-[22px] font-bold text-ink-900">{item.value}</span>
        </Link>
      ))}
    </div>
  );
}

const JP_STATUS_LABEL: Record<string, string> = { kosong: "Belum Mulai", sebagian: "Belum Lengkap", penuh: "Lengkap", lebih: "Melebihi Target" };
const JP_STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger"> = { kosong: "neutral", sebagian: "warning", penuh: "success", lebih: "danger" };

function JpInsightCard({ insight }: { insight: DashboardJpInsight }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-ink-900">Kelengkapan Jadwal (Target JP)</h2>
        <Link href="/pembagian-mengajar/target-jp" className="flex items-center gap-1 text-[12px] font-medium text-brand-600 hover:text-brand-700">
          Lihat detail <ArrowRight size={12} />
        </Link>
      </div>

      {insight.totalKombinasi === 0 ? (
        <p className="mt-3 text-[12.5px] text-ink-400">Belum ada Pembagian Mengajar aktif untuk konteks ini.</p>
      ) : (
        <>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-[28px] font-bold text-ink-900">{insight.completionPercent}%</span>
            <span className="pb-1 text-[12px] text-ink-400">dari {insight.totalKombinasi} kombinasi Guru+Mapel+Kelas</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full rounded-full bg-emerald transition-all" style={{ width: `${insight.completionPercent}%` }} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(insight.countByStatus) as (keyof typeof insight.countByStatus)[]).map((key) => (
              <Badge key={key} tone={JP_STATUS_TONE[key]}>
                {JP_STATUS_LABEL[key]}: {insight.countByStatus[key]}
              </Badge>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function WorkloadCard({ entries }: { entries: DashboardWorkloadEntry[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-ink-900">Beban Mengajar Tertinggi</h2>
        <Link href="/guru" className="flex items-center gap-1 text-[12px] font-medium text-brand-600 hover:text-brand-700">
          Lihat semua Guru <ArrowRight size={12} />
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-ink-400">Belum ada jadwal committed untuk dihitung bebannya.</p>
      ) : (
        <div className="mt-3 flex flex-col divide-y divide-border">
          {entries.map((entry, i) => (
            <div key={entry.guruId} className="flex items-center gap-3 py-2">
              <span className="w-5 text-[11px] font-mono text-ink-300">{i + 1}</span>
              <span className="flex-1 text-[13px] text-ink-900">{entry.namaGuru}</span>
              <span className="text-[12.5px] font-medium text-ink-500">{entry.totalJamMengajar} JP/minggu</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
