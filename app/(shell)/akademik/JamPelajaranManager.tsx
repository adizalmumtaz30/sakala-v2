"use client";

import { useMemo, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { Clock, Download, GripVertical, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import type { AcademicContext } from "@/lib/domain/academicContext";
import type { HariSekolah, JamPelajaran, JamPelajaranDraft, JenisJamPelajaran } from "@/lib/domain/jamPelajaran";
import { URUTAN_HARI, calculateDurationMinutes, formatHari } from "@/lib/domain/jamPelajaran";
import type { StatusAktif } from "@/lib/domain/periodeAkademik";
import { createJamPelajaranAction, deleteJamPelajaranAction, updateJamPelajaranAction } from "./actions";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";

type ImportRow = {
  hari: HariSekolah;
  jamKe: number;
  nama: string;
  jenis: JenisJamPelajaran;
  waktuMulai: string;
  waktuSelesai: string;
  status: StatusAktif;
};

const MAX_JAM_KE = 20;

function normalizeHari(value: unknown): HariSekolah | null {
  const text = String(value ?? "").trim().toLowerCase();
  const map: Record<string, HariSekolah> = {
    senin: "senin",
    selasa: "selasa",
    rabu: "rabu",
    kamis: "kamis",
    jumat: "jumat",
    "jum'at": "jumat",
    sabtu: "sabtu",
  };
  return map[text] ?? null;
}

function normalizeJenis(value: unknown): JenisJamPelajaran {
  return String(value ?? "").trim().toLowerCase() === "istirahat" ? "istirahat" : "pembelajaran";
}

function toDraft(contextId: string, row: ImportRow): JamPelajaranDraft {
  return {
    academicContextId: contextId,
    hari: row.hari,
    nomorUrut: row.jamKe,
    nama: row.nama,
    jenis: row.jenis,
    waktuMulai: row.waktuMulai,
    waktuSelesai: row.waktuSelesai,
    status: row.status,
  };
}

export default function JamPelajaranManager({
  activeContext,
  initialJamList,
}: {
  activeContext: AcademicContext | null;
  initialJamList: JamPelajaran[];
}) {
  const [jamList, setJamList] = useState(initialJamList);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JamPelajaran | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [hari, setHari] = useState<HariSekolah>("senin");
  const [jamKe, setJamKe] = useState(1);
  const [nama, setNama] = useState("");
  const [jenis, setJenis] = useState<JenisJamPelajaran>("pembelajaran");
  const [waktuMulai, setWaktuMulai] = useState("");
  const [waktuSelesai, setWaktuSelesai] = useState("");
  const [status, setStatus] = useState<StatusAktif>("aktif");
  const [activeDay, setActiveDay] = useState<HariSekolah>("senin");

  const usedKeys = useMemo(() => new Set(jamList.map((item) => `${item.hari}:${item.nomorUrut}`)), [jamList]);
  const isDuplicate = (targetHari: HariSekolah, targetJamKe: number) =>
    jamList.some((item) => item.hari === targetHari && item.nomorUrut === targetJamKe && item.id !== editing?.id);

  function resetForm() {
    setHari("senin");
    setJamKe(1);
    setNama("");
    setJenis("pembelajaran");
    setWaktuMulai("");
    setWaktuSelesai("");
    setStatus("aktif");
    setError(null);
  }

  function openCreate(defaultHari: HariSekolah = activeDay, defaultJamKe = 1) {
    setEditing(null);
    setHari(defaultHari);
    setJamKe(defaultJamKe);
    setNama("");
    setJenis("pembelajaran");
    setWaktuMulai("");
    setWaktuSelesai("");
    setStatus("aktif");
    setError(isDuplicate(defaultHari, defaultJamKe) ? `Jam Ke ${defaultJamKe} pada ${formatHari(defaultHari)} sudah digunakan.` : null);
    setModalOpen(true);
  }

  function openEdit(item: JamPelajaran) {
    setEditing(item);
    setHari(item.hari);
    setJamKe(item.nomorUrut);
    setNama(item.nama);
    setJenis(item.jenis);
    setWaktuMulai(item.waktuMulai);
    setWaktuSelesai(item.waktuSelesai);
    setStatus(item.status);
    setError(null);
    setModalOpen(true);
  }

  function save() {
    if (!activeContext) return;
    if (!nama.trim()) return setError("Nama jam wajib diisi.");
    if (!waktuMulai || !waktuSelesai) return setError("Waktu mulai dan selesai wajib diisi.");
    if (waktuMulai >= waktuSelesai) return setError("Waktu selesai harus setelah waktu mulai.");
    if (!Number.isInteger(jamKe) || jamKe < 1 || jamKe > MAX_JAM_KE) return setError(`Jam Ke harus 1–${MAX_JAM_KE}.`);
    if (isDuplicate(hari, jamKe)) return setError(`Jam Ke ${jamKe} pada ${formatHari(hari)} sudah digunakan. Pilih Jam Ke lain.`);

    const draft: JamPelajaranDraft = {
      academicContextId: activeContext.id,
      hari,
      nomorUrut: jamKe,
      nama: nama.trim(),
      jenis,
      waktuMulai,
      waktuSelesai,
      status,
    };

    startTransition(async () => {
      const result = editing ? await updateJamPelajaranAction(editing.id, draft) : await createJamPelajaranAction(draft);
      if (!result.ok) return setError(result.error);
      setJamList((prev) => {
        const next = editing ? prev.map((item) => (item.id === result.data.id ? result.data : item)) : [...prev, result.data];
        return [...next].sort((a, b) => URUTAN_HARI.indexOf(a.hari) - URUTAN_HARI.indexOf(b.hari) || a.nomorUrut - b.nomorUrut);
      });
      setModalOpen(false);
      resetForm();
    });
  }

  function remove(item: JamPelajaran) {
    startTransition(async () => {
      const result = await deleteJamPelajaranAction(item.id);
      if (!result.ok) return setError(result.error);
      setJamList((prev) => prev.filter((row) => row.id !== item.id));
    });
  }

  function handleDrop(targetHari: HariSekolah, targetJamKe: number, sourceId: string) {
    setDragError(null);
    const source = jamList.find((item) => item.id === sourceId);
    if (!source || !activeContext) return;
    if (source.hari === targetHari && source.nomorUrut === targetJamKe) return;
    if (jamList.some((item) => item.id !== sourceId && item.hari === targetHari && item.nomorUrut === targetJamKe)) {
      return setDragError(`Tidak bisa dipindahkan: ${formatHari(targetHari)} Jam Ke ${targetJamKe} sudah terisi.`);
    }

    const draft: JamPelajaranDraft = {
      academicContextId: activeContext.id,
      hari: targetHari,
      nomorUrut: targetJamKe,
      nama: source.nama,
      jenis: source.jenis,
      waktuMulai: source.waktuMulai,
      waktuSelesai: source.waktuSelesai,
      status: source.status,
    };

    startTransition(async () => {
      const result = await updateJamPelajaranAction(source.id, draft);
      if (!result.ok) return setDragError(result.error);
      setJamList((prev) => prev.map((item) => (item.id === source.id ? result.data : item)));
    });
  }

  function downloadTemplate() {
    const sheet = XLSX.utils.json_to_sheet([
      {
        Hari: "Senin",
        "Jam Ke": 1,
        Nama: "Matematika",
        Jenis: "Pembelajaran",
        "Waktu Mulai": "07:00",
        "Waktu Selesai": "07:40",
        Status: "Aktif",
      },
    ]);
    sheet["!cols"] = [
      { wch: 14 },
      { wch: 10 },
      { wch: 28 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Jam Pelajaran");
    XLSX.writeFile(workbook, "SAKALA-Template-Jam-Pelajaran.xlsx");
  }

  async function importFile(file: File) {
    setIsImporting(true);
    setImportErrors([]);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const errors: string[] = [];
      const parsed: ImportRow[] = [];
      const seen = new Set(usedKeys);

      rows.forEach((raw, index) => {
        const rowNo = index + 2;
        const parsedHari = normalizeHari(raw["Hari"] ?? raw["hari"]);
        const parsedJam = Number(raw["Jam Ke"] ?? raw["JamKe"] ?? raw["jamKe"]);
        const parsedNama = String(raw["Nama"] ?? raw["nama"] ?? "").trim();
        const parsedMulai = String(raw["Waktu Mulai"] ?? raw["waktuMulai"] ?? "").trim();
        const parsedSelesai = String(raw["Waktu Selesai"] ?? raw["waktuSelesai"] ?? "").trim();

        if (!parsedHari) errors.push(`Baris ${rowNo}: Hari tidak valid.`);
        if (!Number.isInteger(parsedJam) || parsedJam < 1 || parsedJam > MAX_JAM_KE) errors.push(`Baris ${rowNo}: Jam Ke harus 1–${MAX_JAM_KE}.`);
        if (!parsedNama) errors.push(`Baris ${rowNo}: Nama wajib diisi.`);
        if (!/^\d{2}:\d{2}$/.test(parsedMulai) || !/^\d{2}:\d{2}$/.test(parsedSelesai)) errors.push(`Baris ${rowNo}: format waktu harus HH:MM.`);
        if (parsedMulai && parsedSelesai && parsedMulai >= parsedSelesai) errors.push(`Baris ${rowNo}: waktu selesai harus setelah mulai.`);

        if (parsedHari && Number.isInteger(parsedJam)) {
          const key = `${parsedHari}:${parsedJam}`;
          if (seen.has(key)) errors.push(`Baris ${rowNo}: ${formatHari(parsedHari)} Jam Ke ${parsedJam} sudah digunakan.`);
          seen.add(key);
        }

        if (parsedHari && Number.isInteger(parsedJam) && parsedNama && /^\d{2}:\d{2}$/.test(parsedMulai) && /^\d{2}:\d{2}$/.test(parsedSelesai)) {
          parsed.push({
            hari: parsedHari,
            jamKe: parsedJam,
            nama: parsedNama,
            jenis: normalizeJenis(raw["Jenis"] ?? raw["jenis"]),
            waktuMulai: parsedMulai,
            waktuSelesai: parsedSelesai,
            status: "aktif",
          });
        }
      });

      if (errors.length) return setImportErrors(errors);
      if (!activeContext) return;

      for (const row of parsed) {
        const result = await createJamPelajaranAction(toDraft(activeContext.id, row));
        if (!result.ok) {
          setImportErrors((prev) => [...prev, `${formatHari(row.hari)} Jam Ke ${row.jamKe}: ${result.error}`]);
          return;
        }
        setJamList((prev) =>
          [...prev, result.data].sort((a, b) => URUTAN_HARI.indexOf(a.hari) - URUTAN_HARI.indexOf(b.hari) || a.nomorUrut - b.nomorUrut)
        );
      }
    } catch (err) {
      setImportErrors([err instanceof Error ? err.message : "File tidak dapat dibaca."]);
    } finally {
      setIsImporting(false);
    }
  }

  if (!activeContext) return <Card><EmptyState title="Belum ada konteks akademik aktif" description="Aktifkan konteks di Profil & Konteks terlebih dulu." /></Card>;

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700"><Clock size={18} /></div>
            <div><p className="text-[14px] font-semibold text-ink-900">Jam Pelajaran</p><p className="text-[12.5px] text-ink-500">Atur hari, Jam Ke, waktu, dan jenis dengan cepat.</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={downloadTemplate}><Download size={14} /> Template SAKALA</Button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[12px] font-medium text-ink-700 hover:bg-surface-muted">
              <Upload size={14} /> {isImporting ? "Mengimpor…" : "Import"}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={isImporting} onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
            </label>
            <Button size="sm" onClick={() => openCreate()}><Plus size={14} /> Tambah Jam</Button>
          </div>
        </div>

        {importErrors.length > 0 && (
          <div className="mx-5 mt-4 rounded-xl border border-rose/30 bg-rose-50 px-4 py-3 text-[12px] text-rose">
            <div className="mb-1 flex items-center justify-between font-semibold"><span>Import belum diterapkan</span><button onClick={() => setImportErrors([])} aria-label="Tutup"><X size={14} /></button></div>
            <ul className="list-disc space-y-0.5 pl-4">{importErrors.slice(0, 8).map((item, i) => <li key={i}>{item}</li>)}</ul>
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto px-5 pt-4">
          {URUTAN_HARI.map((day) => <button key={day} onClick={() => setActiveDay(day)} className={`rounded-lg px-3 py-2 text-[12px] font-medium ${activeDay === day ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-surface-muted"}`}>{formatHari(day)}</button>)}
        </div>
        {dragError && <div className="mx-5 mt-3 rounded-lg border border-rose/30 bg-rose-50 px-3 py-2 text-[12px] text-rose">{dragError}</div>}

        <div className="grid grid-cols-1 gap-2 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: MAX_JAM_KE }, (_, index) => index + 1).map((slot) => {
            const item = jamList.find((jam) => jam.hari === activeDay && jam.nomorUrut === slot);
            return (
              <div key={slot} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(activeDay, slot, e.dataTransfer.getData("text/plain"))} className={`min-h-[92px] rounded-xl border border-dashed p-3 transition ${item ? "border-border bg-surface" : "border-border/70 bg-surface-muted/40 hover:border-brand-300 hover:bg-brand-50/40"}`}>
                <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Jam Ke {slot}</span>{!item && <button onClick={() => openCreate(activeDay, slot)} className="rounded-md p-1 text-ink-400 hover:bg-brand-50 hover:text-brand-600" aria-label={`Tambah Jam Ke ${slot}`}><Plus size={14} /></button>}</div>
                {item ? (
                  <div draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)} className="group flex cursor-grab items-start gap-2 active:cursor-grabbing">
                    <GripVertical size={15} className="mt-0.5 shrink-0 text-ink-300" />
                    <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-ink-900">{item.nama}</p><p className="text-[11.5px] text-ink-500">{item.waktuMulai}–{item.waktuSelesai} · {calculateDurationMinutes(item.waktuMulai, item.waktuSelesai)} mnt</p><Badge tone={item.jenis === "istirahat" ? "warning" : "info"}>{item.jenis === "istirahat" ? "Istirahat" : "Pembelajaran"}</Badge></div>
                    <div className="flex shrink-0"><button onClick={() => openEdit(item)} className="rounded-md p-1 text-ink-400 hover:bg-brand-50 hover:text-brand-600" aria-label="Edit"><Pencil size={13} /></button><button onClick={() => remove(item)} className="rounded-md p-1 text-ink-400 hover:bg-rose-50 hover:text-rose" aria-label="Hapus"><Trash2 size={13} /></button></div>
                  </div>
                ) : <p className="text-[12px] text-ink-400">Slot kosong — seret jam ke sini.</p>}
              </div>
            );
          })}
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }} title={editing ? "Edit Jam Pelajaran" : "Tambah Jam Pelajaran"}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><label className="text-[12.5px] font-medium text-ink-700">Hari</label><select value={hari} onChange={(e) => { const next = e.target.value as HariSekolah; setHari(next); setError(isDuplicate(next, jamKe) ? `Jam Ke ${jamKe} pada ${formatHari(next)} sudah digunakan.` : null); }} className="h-11 rounded-xl border border-border bg-surface px-3 text-[13.5px] outline-none"><option value="senin">Senin</option><option value="selasa">Selasa</option><option value="rabu">Rabu</option><option value="kamis">Kamis</option><option value="jumat">Jumat</option><option value="sabtu">Sabtu</option></select></div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-ink-700">Jam Ke</label>
              <input aria-label="Jam Ke" type="number" min={1} max={MAX_JAM_KE} step={1} value={jamKe} onChange={(e) => { const next = Number(e.target.value); setJamKe(next); setError(Number.isInteger(next) && isDuplicate(hari, next) ? `Jam Ke ${next} pada ${formatHari(hari)} sudah digunakan.` : null); }} className={`h-11 w-full rounded-xl border bg-surface px-3 text-[13.5px] outline-none ${isDuplicate(hari, jamKe) ? "border-rose" : "border-border"}`} />
              {isDuplicate(hari, jamKe) && <p className="text-[11.5px] text-rose">Jam Ke ini sudah ada untuk {formatHari(hari)}.</p>}
              <datalist id="jam-ke-options">{Array.from({ length: MAX_JAM_KE }, (_, i) => <option key={i + 1} value={i + 1} label={`Jam Ke ${i + 1}`} />)}</datalist>
            </div>
          </div>
          <Input label="Nama" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="cth. Matematika" required />
          <div className="grid grid-cols-2 gap-3"><div className="flex flex-col gap-1.5"><label className="text-[12.5px] font-medium text-ink-700">Jenis</label><select value={jenis} onChange={(e) => setJenis(e.target.value as JenisJamPelajaran)} className="h-11 rounded-xl border border-border bg-surface px-3 py-2 text-[13.5px]"><option value="pembelajaran">Pembelajaran</option><option value="istirahat">Istirahat</option></select></div><div className="flex flex-col gap-1.5"><label className="text-[12.5px] font-medium text-ink-700">Status</label><select value={status} onChange={(e) => setStatus(e.target.value as StatusAktif)} className="h-11 rounded-xl border border-border bg-surface px-3 py-2 text-[13.5px]"><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></select></div></div>
          <div className="grid grid-cols-2 gap-3"><Input label="Mulai" type="time" value={waktuMulai} onChange={(e) => setWaktuMulai(e.target.value)} required /><Input label="Selesai" type="time" value={waktuSelesai} onChange={(e) => setWaktuSelesai(e.target.value)} required /></div>
          {error && <p className="text-[11.5px] text-rose">{error}</p>}
          <div className="mt-2 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }}>Batal</Button><Button type="button" loading={isPending} disabled={isDuplicate(hari, jamKe) || !Number.isInteger(jamKe) || jamKe < 1 || jamKe > MAX_JAM_KE} onClick={save}>{editing ? "Simpan Perubahan" : "Tambah Jam"}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
