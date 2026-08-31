"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, Upload, ArrowUpFromLine } from "lucide-react";
import * as XLSX from "xlsx";
import Modal from "@/components/ui/Modal";
import ImportModal, { type ImportRowResult } from "@/components/import/ImportModal";
import ScheduleExportPanel from "@/components/jadwal/ScheduleExportPanel";
import type { ScheduleAssignment } from "@/lib/domain/scheduleAssignment";
import type { Guru } from "@/lib/domain/guru";
import type { Kelas } from "@/lib/domain/kelas";
import type { MataPelajaran } from "@/lib/domain/mata-pelajaran";
import type { Ruangan } from "@/lib/domain/ruangan";
import type { HariSekolah, JamPelajaran } from "@/lib/domain/jamPelajaran";
import { formatHari, URUTAN_HARI } from "@/lib/domain/jamPelajaran";
import { validateJadwalImportAction, commitJadwalImportAction } from "@/app/(shell)/jadwal/actions";

export default function DataJadwalMenu({
  assignments, guruList, kelasList, mapelList, ruanganList, jamPelajaranList, activeDays, academicContextId, scheduleModelId, contextLabel, schoolName,
}: {
  assignments: ScheduleAssignment[];
  guruList: Guru[];
  kelasList: Kelas[];
  mapelList: MataPelajaran[];
  ruanganList: Ruangan[];
  jamPelajaranList: JamPelajaran[];
  activeDays: HariSekolah[];
  academicContextId: string;
  scheduleModelId: string;
  contextLabel: string;
  schoolName?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const guruMap = new Map(guruList.map((g) => [g.id, g.namaGuru]));
  const kelasMap = new Map(kelasList.map((k) => [k.id, k.namaRombel]));
  const mapelMap = new Map(mapelList.map((m) => [m.id, m.nama]));
  const ruanganMap = new Map(ruanganList.map((r) => [r.id, r.nama]));

  function downloadDataReal() {
    const committed = assignments.filter((a) => a.status === "committed");
    const rows = committed
      .slice()
      .sort((a, b) => URUTAN_HARI.indexOf(a.day) - URUTAN_HARI.indexOf(b.day) || a.periodStart - b.periodStart)
      .map((a) => ({
        Hari: formatHari(a.day),
        JP: a.periodStart === a.periodEnd ? String(a.periodStart) : `${a.periodStart}-${a.periodEnd}`,
        Kelas: kelasMap.get(a.classId) ?? "",
        MataPelajaran: mapelMap.get(a.subjectId) ?? "",
        Guru: guruMap.get(a.teacherId) ?? "",
        Ruangan: a.roomId ? ruanganMap.get(a.roomId) ?? "" : "",
      }));
    const headers = ["Hari", "JP", "Kelas", "MataPelajaran", "Guru", "Ruangan"];
    const sheetRows = [headers, ...rows.map((r) => headers.map((h) => r[h as keyof typeof r]))];
    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(12, h.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jadwal");
    XLSX.writeFile(wb, `Data_Jadwal_Real_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setMenuOpen(false);
  }

  async function handleValidateImport(rows: Record<string, string>[]): Promise<ImportRowResult[]> {
    const result = await validateJadwalImportAction(rows);
    if (!result.ok) return [];
    return result.data.map((r) => ({ rowNumber: r.rowNumber, primaryLabel: r.primaryLabel, secondaryLabel: r.secondaryLabel, status: r.status, issues: r.issues }));
  }

  async function handleCommitImport(rows: Record<string, string>[]) {
    const result = await commitJadwalImportAction(academicContextId, scheduleModelId, rows);
    if (!result.ok) return { imported: 0, skipped: rows.length };
    return result.data;
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="flex h-11 items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-ink-700 hover:border-brand-600/30 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        Data Jadwal
        <ChevronDown size={14} className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />
      </button>

      {menuOpen && (
        <div className="absolute right-0 z-30 mt-1.5 w-72 rounded-2xl border border-border bg-surface p-2 shadow-float">
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-ink-300">Data Jadwal</p>
          <p className="px-2.5 pb-2 text-[10.5px] text-ink-400">Kelola data jadwal melalui file</p>

          <button
            type="button"
            onClick={() => { setMenuOpen(false); setImportOpen(true); }}
            className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-surface-muted"
          >
            <Download size={15} className="mt-0.5 shrink-0 text-ink-400" />
            <span className="min-w-0"><span className="block text-[12.5px] font-semibold text-ink-800">Impor Template</span><span className="block text-[10.5px] text-ink-400">Mulai dari format kosong</span></span>
          </button>

          <button
            type="button"
            onClick={downloadDataReal}
            className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-surface-muted"
          >
            <Download size={15} className="mt-0.5 shrink-0 text-ink-400" />
            <span className="min-w-0"><span className="block text-[12.5px] font-semibold text-ink-800">Unduh Data Real</span><span className="block text-[10.5px] text-ink-400">Lanjutkan data jadwal yang ada</span></span>
          </button>

          <div className="my-1.5 border-t border-border" />

          <button
            type="button"
            onClick={() => { setMenuOpen(false); setExportOpen(true); }}
            className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-surface-muted"
          >
            <ArrowUpFromLine size={15} className="mt-0.5 shrink-0 text-ink-400" />
            <span className="min-w-0"><span className="block text-[12.5px] font-semibold text-ink-800">Ekspor Data Real</span><span className="block text-[10.5px] text-ink-400">Unduh kondisi jadwal saat ini</span></span>
          </button>
        </div>
      )}

      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Ekspor Data Real" size="lg">
        <ScheduleExportPanel
          assignments={assignments}
          guruList={guruList}
          kelasList={kelasList}
          mapelList={mapelList}
          jamPelajaranList={jamPelajaranList}
          activeDays={activeDays}
          schoolName={schoolName}
          contextLabel={contextLabel}
        />
      </Modal>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Impor Template Jadwal"
        description='Isi kolom Hari, JP, Kelas, MataPelajaran, Guru, Ruangan (opsional). Nama Kelas/Mapel/Guru/Ruangan harus cocok dengan data yang sudah ada. Baris yang lolos akan masuk sebagai kandidat — belum jadi jadwal resmi sampai ditinjau & diterapkan lewat Jadwal Cerdas.'
        templateUrl="/jadwal/import/template"
        templateFilename="Template_Jadwal_SAKALA_V2.3.xlsx"
        onValidate={handleValidateImport}
        onCommit={handleCommitImport}
        onImported={() => router.push("/jadwal-cerdas")}
      />
    </div>
  );
}
