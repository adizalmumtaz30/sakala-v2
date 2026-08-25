"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import type { Guru } from "@/lib/domain/guru";
import type { ScheduleModel } from "@/lib/domain/scheduleModel";
import type { JamPelajaran } from "@/lib/domain/jamPelajaran";
import { formatHari, URUTAN_HARI } from "@/lib/domain/jamPelajaran";
import type { SlotTemplate } from "@/lib/domain/slotTemplate";
import type { ScheduleAssignment } from "@/lib/domain/scheduleAssignment";
import type { Kelas } from "@/lib/domain/kelas";
import type { MataPelajaran } from "@/lib/domain/mata-pelajaran";
import type { Ruangan } from "@/lib/domain/ruangan";
import { buildJadwalGrid, cellKey, type GridCell } from "@/lib/domain/jadwalGrid";
import { Card, EmptyState } from "@/components/ui/primitives";
import Avatar from "@/components/ui/Avatar";
import { teacherColor } from "@/lib/utils/teacherColor";
import { mapelColor } from "@/lib/utils/mapelColor";
import MapelLegend from "@/components/jadwal/MapelLegend";

// Bagian 9 — "Teacher-focused Schedule View", data sama dengan Jadwal Utama
// (buildJadwalGrid dipakai persis sama, tanpa modifikasi) tapi presentasi
// disederhanakan: tanpa toggle Per Kelas/Guru/Ruangan (sudah pasti guru ini),
// tanpa toggle Harian (selalu mingguan penuh supaya pola terlihat), tanpa
// aksi Tambah/Edit/Pindah/Hapus — murni lihat. Filter Kelas hanya
// MENONJOLKAN (bukan menyembunyikan) sesuai Bagian 8.4.

export default function TeacherJadwalView({
  guru,
  activeModel,
  jamPelajaranList,
  slotTemplates,
  assignments,
  kelasList,
  mapelList,
  ruanganList,
}: {
  guru: Guru;
  activeModel: ScheduleModel | null;
  jamPelajaranList: JamPelajaran[];
  slotTemplates: SlotTemplate[];
  assignments: ScheduleAssignment[];
  kelasList: Kelas[];
  mapelList: MataPelajaran[];
  ruanganList: Ruangan[];
}) {
  const kelasMap = useMemo(() => new Map(kelasList.map((k) => [k.id, k])), [kelasList]);
  const mapelMap = useMemo(() => new Map(mapelList.map((m) => [m.id, m.nama])), [mapelList]);
  const ruanganMap = useMemo(() => new Map(ruanganList.map((r) => [r.id, r.nama])), [ruanganList]);
  // Warna GRID per Mata Pelajaran (bukan per guru) — halaman ini menampilkan satu guru
  // saja, jadi kalau grid dikunci ke warna guru, seluruh tabel jadi 1 warna monoton.
  // Per-mapel tetap membantu guru itu sendiri scan pola jadwalnya.
  const mapelColorMap = useMemo(() => new Map(mapelList.map((m) => [m.id, mapelColor(m.kode || m.id)])), [mapelList]);

  const tingkatOptions = useMemo(
    () => Array.from(new Set(kelasList.map((k) => k.tingkat))).sort(),
    [kelasList]
  );
  const [tingkatFilter, setTingkatFilter] = useState<string>("semua");

  const color = teacherColor(guru.kodeGuru || guru.id);

  const activeDays = useMemo(
    () => (activeModel ? URUTAN_HARI.filter((d) => activeModel.hariAktif.includes(d)) : URUTAN_HARI),
    [activeModel]
  );

  const grid = useMemo(
    () => buildJadwalGrid({ days: activeDays, jamPelajaranList, slotTemplates, assignments }),
    [activeDays, jamPelajaranList, slotTemplates, assignments]
  );

  const cellsByKey = useMemo(() => {
    const map = new Map<string, GridCell>();
    grid.cells.forEach((c) => map.set(cellKey(c.day, c.nomorUrut), c));
    return map;
  }, [grid]);

  const totalJamMengajar = assignments.length;

  if (!activeModel) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <EmptyState
          title="Model Jadwal Belum Aktif"
          description="Aktifkan Model Jadwal dulu di halaman Akademik untuk melihat jadwal guru."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <Link href="/guru" className="flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> Kembali ke Guru
      </Link>

      <Card className="flex items-center gap-4" style={{ borderLeft: `3px solid ${color.accent}` }}>
        <Avatar name={guru.namaGuru} size="lg" jenisKelamin={guru.jenisKelamin} kodeGuru={guru.kodeGuru} />
        <div className="flex-1">
          <h1 className="text-[18px] font-bold text-ink-900">{guru.namaGuru}</h1>
          <p className="text-[12.5px] text-ink-400">{guru.kodeGuru}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-[12.5px] font-medium text-ink-500">
          <CalendarClock size={14} />
          {totalJamMengajar} JP terjadwal (committed)
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] font-medium text-ink-500">Kelas:</span>
          <button
            onClick={() => setTingkatFilter("semua")}
            className={`rounded-full px-3 py-1 text-[12.5px] font-medium transition ${
              tingkatFilter === "semua" ? "bg-brand-600 text-white" : "bg-surface-muted text-ink-500 hover:bg-surface"
            }`}
          >
            Semua
          </button>
          {tingkatOptions.map((t) => (
            <button
              key={t}
              onClick={() => setTingkatFilter(t)}
              className={`rounded-full px-3 py-1 text-[12.5px] font-medium transition ${
                tingkatFilter === t ? "bg-brand-600 text-white" : "bg-surface-muted text-ink-500 hover:bg-surface"
              }`}
            >
              Kelas {t}
            </button>
          ))}
        </div>

        {totalJamMengajar === 0 ? (
          <EmptyState
            title="Belum Ada Jadwal Committed"
            description="Guru ini belum memiliki jadwal committed pada konteks akademik aktif."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <th className="w-20 border-b border-border p-2 text-left font-medium text-ink-400">Jam</th>
                  {activeDays.map((d) => (
                    <th key={d} className="border-b border-border p-2 text-left font-medium text-ink-400">
                      {formatHari(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => (
                  <tr key={row.nomorUrut}>
                    <td className="border-b border-border p-2 align-top text-ink-400">JP {row.nomorUrut}</td>
                    {activeDays.map((d) => {
                      const cell = cellsByKey.get(cellKey(d, row.nomorUrut));
                      if (!cell || cell.state === "empty") {
                        return <td key={d} className="border-b border-border p-2 align-top" />;
                      }
                      if (cell.state === "fixed_activity") {
                        return (
                          <td key={d} className="border-b border-border p-2 align-top">
                            <div className="rounded-lg bg-surface-muted px-2 py-1.5 text-center text-ink-400">
                              {cell.jamPelajaran?.jenis === "istirahat" ? "Istirahat" : cell.slotTemplate?.jenisSlot ?? "Kegiatan Tetap"}
                            </div>
                          </td>
                        );
                      }

                      const a = cell.assignment;
                      const kelas = a ? kelasMap.get(a.classId) : null;
                      const emphasized = tingkatFilter === "semua" || kelas?.tingkat === tingkatFilter;
                      const cellColor = a ? mapelColorMap.get(a.subjectId) : undefined;

                      return (
                        <td key={d} className="border-b border-border p-2 align-top">
                          <div
                            className={`rounded-lg px-2.5 py-2 leading-snug transition ${
                              cell.state === "conflict" ? "" : ""
                            } ${emphasized ? "border-l-[3px] shadow-soft" : "border-l-[3px] opacity-40"}`}
                            style={{
                              backgroundColor: cell.state === "conflict" ? "#FEF2F2" : cellColor?.tint,
                              borderLeftColor: cell.state === "conflict" ? "#DC2626" : cellColor?.accent,
                            }}
                          >
                            <p
                              className={`break-words ${emphasized ? "font-semibold" : "font-medium"}`}
                              style={{ color: cell.state === "conflict" ? "#991B1B" : cellColor?.text }}
                            >
                              {a ? mapelMap.get(a.subjectId) ?? "Mapel" : ""}
                            </p>
                            <p className="break-words text-ink-500">{kelas ? `${kelas.tingkat} ${kelas.namaRombel}` : "—"}</p>
                            {a?.roomId && <p className="break-words text-ink-400">{ruanganMap.get(a.roomId) ?? ""}</p>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <MapelLegend subjectIds={assignments.map((a) => a.subjectId)} mapelMap={mapelMap} colorMap={mapelColorMap} />

      <p className="text-center text-[12px] text-ink-400">
        Tampilan ini hanya menampilkan jadwal committed dan bersifat lihat-saja. Untuk mengubah jadwal, gunakan halaman Jadwal.
      </p>
    </div>
  );
}
