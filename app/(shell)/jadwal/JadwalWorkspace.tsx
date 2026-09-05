"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import type { ReactNode } from "react";
import { Plus, X, Trash2, Copy, Pencil, Eye, AlertTriangle, CheckCircle2, Info, CalendarClock, User, Users, DoorOpen, CalendarDays, Clock3, LayoutGrid, GitBranch, Sparkles, Filter, ChevronDown } from "lucide-react";
import Link from "next/link";
import { scanCommittedConflicts } from "@/lib/application/conflictEngine";
import type { AcademicContext } from "@/lib/domain/academicContext";
import { formatContextLabel } from "@/lib/domain/academicContext";
import type { ScheduleModel } from "@/lib/domain/scheduleModel";
import { formatModeRuangan } from "@/lib/domain/scheduleModel";
import type { Guru } from "@/lib/domain/guru";
import type { Kelas } from "@/lib/domain/kelas";
import type { MataPelajaran } from "@/lib/domain/mata-pelajaran";
import type { Ruangan } from "@/lib/domain/ruangan";
import type { JamPelajaran, HariSekolah } from "@/lib/domain/jamPelajaran";
import { formatHari, URUTAN_HARI } from "@/lib/domain/jamPelajaran";
import type { SlotTemplate, JenisSlot } from "@/lib/domain/slotTemplate";
import { formatJenisSlot } from "@/lib/domain/slotTemplate";
import type { ScheduleAssignment, ScheduleAssignmentDraft } from "@/lib/domain/scheduleAssignment";
import type { PembagianMengajar } from "@/lib/domain/pembagianMengajar";
import { buildJadwalGrid, isEligibleForAdd, cellKey, type GridCell, type JadwalViewBy, type JadwalRangeMode } from "@/lib/domain/jadwalGrid";
import { checkRealtimeOverlap, CONFLICT_TYPE_LABEL, type ScheduleConflict } from "@/lib/domain/conflict";
import { mapelColor } from "@/lib/utils/mapelColor";
import { addAssignmentAction, moveAssignmentAction, deleteAssignmentAction, aiScheduleFillAction, undoAiFillAction } from "./actions";
import type { AiFillScope } from "@/lib/application/aiScheduleFill.usecases";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Badge, EmptyState } from "@/components/ui/primitives";
import DataJadwalMenu from "@/components/jadwal/DataJadwalMenu";
import MapelLegend from "@/components/jadwal/MapelLegend";

const ACTIVITY_OPTIONS: JenisSlot[] = ["belajar_mengajar", "upacara", "religi", "istirahat", "libur", "custom"];

interface FormState {
  classId: string;
  subjectId: string;
  teacherId: string;
  roomId: string;
  activityType: JenisSlot;
}

const EMPTY_FORM: FormState = { classId: "", subjectId: "", teacherId: "", roomId: "", activityType: "belajar_mengajar" };

function conflictTone(severity: ScheduleConflict["severity"]): "danger" | "warning" | "info" {
  if (severity === "error") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}

/** Icon premium per jenis konflik — memperjelas jenis bentrok secara visual
 * (Guru/Kelas/Ruangan) tanpa harus membaca teks badge dulu. */
function ConflictTypeIcon({ entityType }: { entityType: ScheduleConflict["entityType"] }) {
  const size = 13;
  if (entityType === "teacher") return <User size={size} />;
  if (entityType === "class") return <Users size={size} />;
  if (entityType === "room") return <DoorOpen size={size} />;
  return <AlertTriangle size={size} />;
}

export default function JadwalWorkspace({
  activeContext,
  scheduleModels,
  jamPelajaranList,
  slotTemplatesByModel,
  guruList,
  kelasList,
  mapelList,
  ruanganList,
  assignments,
  pembagianMengajarList,
  belumSiapJpByKelas,
  schoolName,
  contextLabel,
}: {
  activeContext: AcademicContext | null;
  scheduleModels: ScheduleModel[];
  jamPelajaranList: JamPelajaran[];
  slotTemplatesByModel: Record<string, SlotTemplate[]>;
  guruList: Guru[];
  kelasList: Kelas[];
  mapelList: MataPelajaran[];
  ruanganList: Ruangan[];
  assignments: ScheduleAssignment[];
  pembagianMengajarList: PembagianMengajar[];
  belumSiapJpByKelas: Record<string, number>;
  schoolName?: string;
  contextLabel: string;
}) {
  // PENTING (Rules of Hooks): guard early-return TIDAK BOLEH ditaruh sebelum hook
  // apa pun — kalau activeContext null di satu render lalu terisi di render
  // berikutnya (mis. setelah revalidatePath), jumlah hook yang dipanggil harus
  // tetap identik di semua render, atau React error "Rendered more hooks than
  // during the previous render". Jadi SEMUA hook (useState/useMemo) dipanggil
  // dulu tanpa syarat di atas, guard dipindah ke bawah setelah hook terakhir.
  const activeModels = useMemo(() => scheduleModels.filter((m) => m.status === "aktif"), [scheduleModels]);
  const [selectedModelId, setSelectedModelId] = useState<string>(activeModels[0]?.id ?? "");
  const selectedModel = activeModels.find((m) => m.id === selectedModelId) ?? null;

  const [viewBy, setViewBy] = useState<JadwalViewBy>("kelas");
  const [rangeMode, setRangeMode] = useState<JadwalRangeMode>("mingguan");
  const [highlightFilter, setHighlightFilter] = useState<"semua" | "conflict" | "kandidat">("semua");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // SAKALA AI -- satu tombol, menu kontekstual (Jadwal Satu Layar tahap 2+3).
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<{
    message: string;
    missingTeacherSubjects: { subjectId: string; subjectName: string }[];
  } | null>(null);
  const [aiUndoIds, setAiUndoIds] = useState<string[]>([]);
  const [aiUndoBusy, setAiUndoBusy] = useState(false);
  const [aiConfirmFullWeek, setAiConfirmFullWeek] = useState(false);
  const aiMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aiMenuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) setAiMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [aiMenuOpen]);
  useEffect(() => {
    if (!aiResult) return;
    const t = setTimeout(() => { setAiResult(null); setAiUndoIds([]); }, 10000);
    return () => clearTimeout(t);
  }, [aiResult]);

  async function runAiUndo() {
    if (aiUndoIds.length === 0) return;
    setAiUndoBusy(true);
    try {
      const res = await undoAiFillAction(aiUndoIds);
      if (!res.ok) setToast(`Undo gagal: ${res.error}`);
      else setToast(`${res.data.undone} slot dibatalkan.`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Undo gagal.");
    } finally {
      setAiUndoBusy(false);
      setAiResult(null);
      setNewlyAddedIds((prev) => {
        if (aiUndoIds.every((id) => !prev.has(id))) return prev;
        const next = new Map(prev);
        for (const id of aiUndoIds) next.delete(id);
        return next;
      });
      setAiUndoIds([]);
    }
  }

  // SAKALA MASTER RULE (Jadwal Satu Layar tahap 4): tampilan Jadwal ini
  // satu-entitas-per-waktu (viewBy: kelas/guru/ruangan), BUKAN grid
  // multi-kolom semua kelas sekaligus -- badge JP & drag guru didesain
  // menyesuaikan pola ini, bukan dipaksakan jadi tampilan kalender
  // multi-kolom yang tidak ada.

  // Badge "31/40 JP" -- progress kebutuhan per kelas, dari pembagianMengajarList
  // yang sudah punya jpTerjadwal/jpTersisa terhitung (attachJpTerjadwal usecase).
  const kelasJpSummary = useMemo(() => {
    const map = new Map<string, { target: number; terjadwal: number }>();
    for (const p of pembagianMengajarList) {
      if (p.status !== "aktif") continue;
      const cur = map.get(p.kelasId) ?? { target: 0, terjadwal: 0 };
      cur.target += p.jpPerMinggu;
      cur.terjadwal += p.jpTerjadwal ?? Math.max(p.jpPerMinggu - (p.jpTersisa ?? 0), 0);
      map.set(p.kelasId, cur);
    }
    return map;
  }, [pembagianMengajarList]);

  const [kelasPickerOpen, setKelasPickerOpen] = useState(false);
  const kelasPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!kelasPickerOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (kelasPickerRef.current && !kelasPickerRef.current.contains(e.target as Node)) setKelasPickerOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [kelasPickerOpen]);

  // Drag guru dari panel samping ke sel kosong -- teacherId (dan classId,
  // krn kita sedang di view kelas) diisikan otomatis ke form tambah, operator
  // tinggal pilih Mata Pelajaran & konfirmasi (subjek sengaja tidak
  // diasumsikan, supaya tidak salah tempatkan guru ke mapel yang keliru).
  const [draggingTeacherId, setDraggingTeacherId] = useState<string | null>(null);
  function handleGuruDrop(day: HariSekolah, nomorUrut: number, teacherId: string) {
    openAdd(day, nomorUrut);
    setAddForm((f) => ({ ...f, teacherId, classId: viewBy === "kelas" ? activeEntityId : f.classId }));
  }

  async function runAiFill(scope: AiFillScope) {
    if (!activeContext || !selectedModelId || viewBy !== "kelas" || !activeEntityId) return;
    setAiMenuOpen(false);
    setAiConfirmFullWeek(false);
    setAiBusy(true);
    setAiResult(null);
    try {
      const res = await aiScheduleFillAction(activeContext.id, selectedModelId, scope, activeEntityId);
      if (!res.ok) {
        setToast(`AI gagal: ${res.error}`);
      } else {
        const msg = res.data.placedCount > 0
          ? `AI mengisi ${res.data.placedCount} slot jadwal${res.data.skippedCount > 0 ? ` (${res.data.skippedCount} dilewati karena bentrok)` : ""}.${res.data.missingTeacherSubjects.length > 0 ? " Catatan di bawah." : ""}`
          : res.data.message;
        setAiResult({ message: msg, missingTeacherSubjects: res.data.missingTeacherSubjects });
        setAiUndoIds(res.data.committedAssignmentIds);
        markNewlyAdded(res.data.committedAssignmentIds);
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : "AI gagal memproses.");
    } finally {
      setAiBusy(false);
    }
  }

  useEffect(() => {
    if (!filterMenuOpen) return;
    const onClick = (e: MouseEvent) => { if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setFilterMenuOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [filterMenuOpen]);

  const guruMap = useMemo(() => new Map(guruList.map((g) => [g.id, g.namaGuru])), [guruList]);
  // Identitas Warna Mata Pelajaran (menggantikan warna-per-guru) — di-hash dari
  // kode mapel (stabil, bukan nama yang bisa diedit). Dipilih mapel bukan guru
  // supaya warna tetap informatif di SEMUA mode "Lihat per" (Kelas/Guru/Ruangan):
  // kalau dikunci ke guru, begitu filter "Lihat per: Guru" ke 1 guru, semua
  // kartu jadi 1 warna — percuma. Dipakai konsisten di grid Jadwal & Data Guru.
  const mapelColorMap = useMemo(
    () => new Map(mapelList.map((m) => [m.id, mapelColor(m.kode || m.id)])),
    [mapelList]
  );
  const kelasMap = useMemo(() => new Map(kelasList.map((k) => [k.id, `${k.tingkat} ${k.namaRombel}`])), [kelasList]);
  const mapelMap = useMemo(() => new Map(mapelList.map((m) => [m.id, m.nama])), [mapelList]);
  const ruanganMap = useMemo(() => new Map(ruanganList.map((r) => [r.id, r.nama])), [ruanganList]);

  const entityOptions = useMemo(() => {
    if (viewBy === "kelas") return kelasList.map((k) => ({ id: k.id, label: `${k.tingkat} ${k.namaRombel}` }));
    if (viewBy === "guru") return guruList.map((g) => ({ id: g.id, label: g.namaGuru }));
    return ruanganList.map((r) => ({ id: r.id, label: r.nama }));
  }, [viewBy, kelasList, guruList, ruanganList]);

  const [selectedEntityId, setSelectedEntityId] = useState<string>(entityOptions[0]?.id ?? "");
  const activeEntityId = entityOptions.some((o) => o.id === selectedEntityId) ? selectedEntityId : entityOptions[0]?.id ?? "";

  const activeClassHasAiGap = useMemo(() => {
    if (viewBy !== "kelas") return false;
    const jp = kelasJpSummary.get(activeEntityId);
    return !!jp && jp.terjadwal < jp.target;
  }, [viewBy, kelasJpSummary, activeEntityId]);

  function changeViewBy(next: JadwalViewBy) {
    setViewBy(next);
    const options = next === "kelas" ? kelasList.map((k) => k.id) : next === "guru" ? guruList.map((g) => g.id) : ruanganList.map((r) => r.id);
    setSelectedEntityId(options[0] ?? "");
  }

  const activeDays = useMemo(
    () => (selectedModel ? URUTAN_HARI.filter((d) => selectedModel.hariAktif.includes(d)) : []),
    [selectedModel]
  );
  const [selectedDay, setSelectedDay] = useState<HariSekolah>(activeDays[0] ?? "senin");
  const dayForHarian = activeDays.includes(selectedDay) ? selectedDay : activeDays[0] ?? "senin";
  const gridDays = rangeMode === "mingguan" ? activeDays : activeDays.length > 0 ? [dayForHarian] : [];

  const scopedAssignments = useMemo(
    () =>
      assignments.filter(
        (a) =>
          a.status === "committed" &&
          a.scheduleModelId === selectedModelId &&
          (viewBy === "kelas" ? a.classId === activeEntityId : viewBy === "guru" ? a.teacherId === activeEntityId : a.roomId === activeEntityId)
      ),
    [assignments, selectedModelId, viewBy, activeEntityId]
  );

  const slotTemplates = selectedModelId ? slotTemplatesByModel[selectedModelId] ?? [] : [];

  // Baris 5 KPI stat toolbar — SAMA scope dgn scopedAssignments di atas (entity yang
  // sedang dipilih: kelas/guru/ruangan), bukan model-wide. Slot Pembelajaran tetap
  // model-wide krn itu kapasitas slot template, bukan metrik keterisian per-entity.
  const scopedCandidates = useMemo(
    () =>
      assignments.filter(
        (a) =>
          a.status === "candidate" &&
          a.scheduleModelId === selectedModelId &&
          (viewBy === "kelas" ? a.classId === activeEntityId : viewBy === "guru" ? a.teacherId === activeEntityId : a.roomId === activeEntityId)
      ),
    [assignments, selectedModelId, viewBy, activeEntityId]
  );
  const totalJpTerjadwal = useMemo(
    () => scopedAssignments.reduce((sum, a) => sum + (a.periodEnd - a.periodStart + 1), 0),
    [scopedAssignments]
  );
  const totalSlotPembelajaran = useMemo(
    () => slotTemplates.filter((s) => s.jenisSlot === "belajar_mengajar").length,
    [slotTemplates]
  );
  // Conflict di-scan dari SELURUH committed model (bentrok bisa lintas-entity, mis. guru
  // kelas ini bentrok jadwal di kelas lain) lalu difilter ke yang benar2 melibatkan entity
  // terpilih — supaya tidak melewatkan masalah nyata yang mempengaruhi kelas/guru/ruangan ini.
  const modelWideCommittedForConflict = useMemo(
    () => assignments.filter((a) => a.status === "committed" && a.scheduleModelId === selectedModelId),
    [assignments, selectedModelId]
  );
  const scopedAssignmentIds = useMemo(() => new Set(scopedAssignments.map((a) => a.id)), [scopedAssignments]);
  const conflictCount = useMemo(
    () => scanCommittedConflicts(modelWideCommittedForConflict).filter((c) => c.scheduleIds.some((id) => scopedAssignmentIds.has(id))).length,
    [modelWideCommittedForConflict, scopedAssignmentIds]
  );

  const grid = useMemo(
    () => buildJadwalGrid({ days: gridDays, jamPelajaranList, slotTemplates, assignments: scopedAssignments }),
    [gridDays, jamPelajaranList, slotTemplates, scopedAssignments]
  );

  // Indikator visual "ada kandidat pending" per sel — TIDAK mengganti kartu committed
  // yang tampil (grid tetap sumber kebenaran committed), cuma ring dashed ungu sbg sinyal
  // supaya operator tahu ada perubahan yang menunggu review di jam itu (per entity+model aktif).
  const candidateCellKeys = useMemo(() => {
    const set = new Set<string>();
    assignments
      .filter(
        (a) =>
          a.status === "candidate" &&
          a.scheduleModelId === selectedModelId &&
          (viewBy === "kelas" ? a.classId === activeEntityId : viewBy === "guru" ? a.teacherId === activeEntityId : a.roomId === activeEntityId)
      )
      .forEach((a) => {
        for (let p = a.periodStart; p <= a.periodEnd; p += 1) set.add(cellKey(a.day, p));
      });
    return set;
  }, [assignments, selectedModelId, viewBy, activeEntityId]);

  const cellsByKey = useMemo(() => {
    const map = new Map<string, GridCell>();
    grid.cells.forEach((c) => map.set(cellKey(c.day, c.nomorUrut), c));
    return map;
  }, [grid]);

  // --- Modal / interaction state ---
  const [addTarget, setAddTarget] = useState<{ day: HariSekolah; nomorUrut: number } | null>(null);
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM);
  const [addJpCount, setAddJpCount] = useState(1);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addLabel, setAddLabel] = useState("");

  const [detailAssignment, setDetailAssignment] = useState<ScheduleAssignment | null>(null);

  const [editTarget, setEditTarget] = useState<ScheduleAssignment | null>(null);
  const [editForm, setEditForm] = useState<FormState & { day: HariSekolah; nomorUrut: number }>({
    ...EMPTY_FORM,
    day: "senin",
    nomorUrut: 1,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<ScheduleAssignment | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [duplicateSource, setDuplicateSource] = useState<ScheduleAssignment | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Tanda "Baru" (poin operator): assignment yang baru ditambahkan (manual
  // atau via SAKALA AI) ditandai selama ~2 menit operator berada di halaman
  // ini, lalu hilang otomatis -- bukan status permanen, cuma penanda sesaat.
  const [newlyAddedIds, setNewlyAddedIds] = useState<Map<string, number>>(new Map());
  const NEW_BADGE_DURATION_MS = 2 * 60 * 1000;
  function markNewlyAdded(ids: string[]) {
    if (ids.length === 0) return;
    setNewlyAddedIds((prev) => {
      const next = new Map(prev);
      const now = Date.now();
      for (const id of ids) next.set(id, now);
      return next;
    });
  }
  useEffect(() => {
    if (newlyAddedIds.size === 0) return;
    const t = setInterval(() => {
      setNewlyAddedIds((prev) => {
        const now = Date.now();
        const next = new Map([...prev].filter(([, addedAt]) => now - addedAt < NEW_BADGE_DURATION_MS));
        return next.size === prev.size ? prev : next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [newlyAddedIds]);

  // Item #7 (deep-link dari baris Guru): ➕/👁 di halaman Guru mengarah ke sini
  // lewat query string ?viewBy=guru&entityId=<id>&autoAdd=1. Dibaca via
  // window.location (bukan useSearchParams) supaya tidak menambah kebutuhan
  // Suspense boundary di page.tsx — murni penyesuaian state client, sekali di mount.
  const [pendingAutoAdd, setPendingAutoAdd] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qViewBy = params.get("viewBy");
    const qEntityId = params.get("entityId");
    const qAutoAdd = params.get("autoAdd") === "1";
    if (qViewBy === "kelas" || qViewBy === "guru" || qViewBy === "ruangan") setViewBy(qViewBy);
    if (qEntityId) setSelectedEntityId(qEntityId);
    if (qAutoAdd) setPendingAutoAdd(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Begitu grid untuk entitas yang diminta sudah siap, buka modal Tambah Jadwal
  // otomatis di sel kosong pertama yang eligible, dengan Guru sudah terisi.
  useEffect(() => {
    if (!pendingAutoAdd) return;
    if (grid.cells.length === 0) return;
    const firstEmpty = grid.cells.find((c) => c.state === "empty" && isEligibleForAdd(c));
    setPendingAutoAdd(false);
    if (!firstEmpty) {
      setToast("Tidak ada slot kosong yang tersedia untuk ditambahkan saat ini.");
      return;
    }
    setAddTarget({ day: firstEmpty.day, nomorUrut: firstEmpty.nomorUrut });
    setAddError(null);
    setAddLabel("");
    setAddJpCount(1);
    setAddForm({ ...EMPTY_FORM, activityType: "belajar_mengajar", teacherId: viewBy === "guru" ? activeEntityId : "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoAdd, grid]);

  // Guard SETELAH semua hook (lihat catatan di atas) — aman dari pelanggaran
  // Rules of Hooks karena tidak ada hook lagi di bawah titik ini.
  if (!activeContext) {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <EmptyState
          title="Belum ada konteks akademik aktif"
          description="Aktifkan satu konteks akademik dulu di halaman Akademik sebelum membuka Jadwal."
        />
      </div>
    );
  }
  const context = activeContext;

  function openAdd(day: HariSekolah, nomorUrut: number) {
    setAddTarget({ day, nomorUrut });
    setAddError(null);
    setAddLabel("");
    setAddJpCount(1);
    if (duplicateSource) {
      setAddForm({
        classId: duplicateSource.classId,
        subjectId: duplicateSource.subjectId,
        teacherId: duplicateSource.teacherId,
        roomId: duplicateSource.roomId ?? "",
        activityType: duplicateSource.activityType,
      });
    } else {
      setAddForm({ ...EMPTY_FORM, activityType: "belajar_mengajar" });
    }
  }

  function closeAdd() {
    setAddTarget(null);
    setDuplicateSource(null);
  }

  /** Bagian "Penambahan Jam — Dukungan Multi-JP": hitung berapa JP berurutan
   * yang masih kosong & eligible mulai dari sel yang diklik, di hari yang
   * sama — supaya pilihan "2 JP sekaligus" tidak pernah menimpa sel yang
   * sudah terisi atau melewati batas hari (grid sudah menandai itu semua
   * lewat isEligibleForAdd, jadi tidak perlu query tambahan ke server). */
  function maxContiguousJp(day: HariSekolah, startNomorUrut: number): number {
    let count = 0;
    let nomor = startNomorUrut;
    while (true) {
      const cell = cellsByKey.get(cellKey(day, nomor));
      if (!cell || (nomor !== startNomorUrut && !isEligibleForAdd(cell))) break;
      count++;
      nomor++;
    }
    return count;
  }

  function handleCellClick(cell: GridCell) {
    if (cell.state === "empty" && isEligibleForAdd(cell)) {
      openAdd(cell.day, cell.nomorUrut);
    } else if (cell.assignment) {
      setDetailAssignment(cell.assignment);
    }
  }

  function buildAddDraft(): ScheduleAssignmentDraft | null {
    if (!addTarget || !selectedModel) return null;
    return {
      academicContextId: context.id,
      scheduleModelId: selectedModel.id,
      classId: addForm.classId,
      subjectId: addForm.subjectId,
      teacherId: addForm.teacherId,
      roomId: addForm.roomId || null,
      day: addTarget.day,
      periodStart: addTarget.nomorUrut,
      periodEnd: addTarget.nomorUrut + effectiveAddJp - 1,
      activityType: addForm.activityType,
      status: "draft",
      source: "manual",
      versionId: null,
    };
  }

  async function runSaveAdd(commit: boolean) {
    const draft = buildAddDraft();
    if (!draft) return;
    setAddSaving(true);
    setAddError(null);
    const result = await addAssignmentAction(draft, commit, addLabel || undefined);
    setAddSaving(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    setToast(commit ? buildCommitToast("Jadwal berhasil disimpan.", result.data.conflicts) : "Jadwal berhasil disimpan sebagai draft (lihat di Jadwal Cerdas → Review & Commit).");
    markNewlyAdded([result.data.assignment.id]);
    closeAdd();
  }

  function openEdit(assignment: ScheduleAssignment) {
    setDetailAssignment(null);
    setEditTarget(assignment);
    setEditForm({
      classId: assignment.classId,
      subjectId: assignment.subjectId,
      teacherId: assignment.teacherId,
      roomId: assignment.roomId ?? "",
      activityType: assignment.activityType,
      day: assignment.day,
      nomorUrut: assignment.periodStart,
    });
    setEditError(null);
    setEditLabel("");
  }

  async function runSaveEdit() {
    if (!editTarget) return;
    setEditSaving(true);
    setEditError(null);
    const result = await moveAssignmentAction(
      editTarget.id,
      {
        day: editForm.day,
        periodStart: editForm.nomorUrut,
        periodEnd: editForm.nomorUrut,
        roomId: editForm.roomId || null,
        classId: editForm.classId,
        subjectId: editForm.subjectId,
        teacherId: editForm.teacherId,
      },
      editLabel || undefined
    );
    setEditSaving(false);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setToast(buildCommitToast("Jadwal berhasil diperbarui dan tercatat sebagai versi baru.", result.data.conflicts));
    setEditTarget(null);
  }

  async function runDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteAssignmentAction(deleteTarget.id);
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    setToast(result.data.archived ? "Jadwal committed diarsipkan." : "Jadwal dihapus.");
    setDeleteTarget(null);
    setDetailAssignment(null);
  }

  const roomRequired = selectedModel?.modeRuangan === "wajib";
  const roomDisabled = selectedModel?.modeRuangan === "tidak_dipakai";

  // Realtime overlap check (client-side, tanpa tombol "Validasi" / round-trip
  // server) — begitu Kelas & Guru dipilih di form Tambah Jadwal, langsung
  // dicek terhadap assignment committed yang sudah ter-fetch. Lihat
  // checkRealtimeOverlap() di lib/domain/conflict.ts untuk detail & batasan
  // (subset dari Conflict Engine server, cukup untuk feedback instan).
  const addMaxJp = addTarget ? maxContiguousJp(addTarget.day, addTarget.nomorUrut) : 1;
  const effectiveAddJp = Math.min(Math.max(addJpCount, 1), Math.max(addMaxJp, 1));
  const addPeriodEnd = addTarget ? addTarget.nomorUrut + effectiveAddJp - 1 : 0;

  const realtimeNames = { guru: guruMap, kelas: kelasMap, ruangan: ruanganMap };

  const addRealtimeConflicts =
    addTarget && addForm.classId && addForm.teacherId
      ? checkRealtimeOverlap({
          candidate: {
            classId: addForm.classId,
            teacherId: addForm.teacherId,
            roomId: addForm.roomId || null,
            day: addTarget.day,
            periodStart: addTarget.nomorUrut,
            periodEnd: addPeriodEnd,
          },
          assignments,
          roomModeAktif: !roomDisabled,
          names: realtimeNames,
        })
      : [];
  const addHasBlockingConflict = addRealtimeConflicts.some((c) => c.blocking);

  // Sama seperti Tambah Jadwal — realtime check juga aktif di modal
  // Edit/Pindah (sebelumnya hanya divalidasi server setelah submit, jadi
  // user baru tahu bentrok setelah klik "Validasi & Commit"). Assignment
  // yang sedang diedit dikecualikan dari perbandingan (excludeAssignmentId)
  // supaya tidak "bentrok dengan dirinya sendiri" di posisi lama.
  const editRealtimeConflicts =
    editTarget && editForm.classId && editForm.teacherId
      ? checkRealtimeOverlap({
          candidate: {
            classId: editForm.classId,
            teacherId: editForm.teacherId,
            roomId: editForm.roomId || null,
            day: editForm.day,
            periodStart: editForm.nomorUrut,
            periodEnd: editForm.nomorUrut,
          },
          assignments,
          roomModeAktif: !roomDisabled,
          excludeAssignmentId: editTarget.id,
          names: realtimeNames,
        })
      : [];
  const editHasBlockingConflict = editRealtimeConflicts.some((c) => c.blocking);

  if (activeModels.length === 0) {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <EmptyState
          title="Belum ada Schedule Model aktif"
          description="Buat dan aktifkan Schedule Model dulu di step sebelumnya sebelum membuka Jadwal Operational Workspace."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 pb-16 pt-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-ink-400">
          <CalendarClock size={16} />
          <span className="text-[12.5px]">{formatContextLabel(context)}</span>
        </div>
        <h1 className="text-[20px] font-semibold text-ink-900">Jadwal</h1>
        <p className="text-[13px] text-ink-500">Jadwal operasional/committed — Per Kelas, Per Guru, Per Ruangan, Harian, Mingguan.</p>
      </div>

      {aiConfirmFullWeek && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[12.5px] font-medium text-ink-800">
            Ini akan mengganti seluruh jadwal {entityOptions.find((o) => o.id === activeEntityId)?.label ?? "kelas ini"} dari nol. Kelas lain tidak terpengaruh. Lanjutkan?
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAiConfirmFullWeek(false)}>Batal</Button>
            <Button variant="primary" size="sm" onClick={() => void runAiFill("class-replace")}>Ya, susun ulang</Button>
          </div>
        </div>
      )}

      {aiResult && (
        <div className="flex flex-col gap-2 rounded-xl border border-violet-100 bg-violet-50/70 px-4 py-2.5 text-[12.5px] text-ink-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2"><Sparkles size={14} className="text-violet" /> {aiResult.message}</span>
            <div className="flex shrink-0 items-center gap-3">
              {aiUndoIds.length > 0 && (
                <button type="button" disabled={aiUndoBusy} onClick={() => void runAiUndo()} className="font-semibold text-violet hover:underline disabled:opacity-50">
                  {aiUndoBusy ? "Membatalkan…" : "Undo"}
                </button>
              )}
              <button type="button" onClick={() => { setAiResult(null); setAiUndoIds([]); }} className="font-medium text-ink-400 hover:text-ink-700">Tutup</button>
            </div>
          </div>
          {aiResult.missingTeacherSubjects.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-violet-100 pt-2">
              <span className="text-[11.5px] text-ink-500">Perlu guru dulu:</span>
              {aiResult.missingTeacherSubjects.map((s) => (
                <Link
                  key={s.subjectId}
                  href={`/pembagian-mengajar?kelas=${activeEntityId}&mapel=${s.subjectId}`}
                  className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11.5px] font-medium text-amber-800 hover:bg-amber-100"
                >
                  {s.subjectName} →
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <JadwalStatCard icon={<CalendarDays size={16} />} value={scopedAssignments.length} label="Jadwal" tone="brand" />
        <JadwalStatCard icon={<Clock3 size={16} />} value={totalJpTerjadwal} label="JP Terjadwal" tone="violet" />
        <JadwalStatCard icon={<LayoutGrid size={16} />} value={totalSlotPembelajaran} label="Slot Pembelajaran" tone="emerald" />
        <JadwalStatCard icon={<AlertTriangle size={16} />} value={conflictCount} label="Bentrok" tone={conflictCount > 0 ? "rose" : "neutral"} />
        <JadwalStatCard icon={<GitBranch size={16} />} value={scopedCandidates.length} label="Kandidat" tone={scopedCandidates.length > 0 ? "amber" : "neutral"} />
        {viewBy === "kelas" && activeEntityId && (
          <JadwalStatCard
            icon={<AlertTriangle size={16} />}
            value={belumSiapJpByKelas[activeEntityId] ?? 0}
            label="Guru Belum Ditentukan"
            tone={(belumSiapJpByKelas[activeEntityId] ?? 0) > 0 ? "rose" : "neutral"}
          />
        )}
      </div>

      {scopedCandidates.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-50 bg-violet-50/60 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet"><Sparkles size={16} /></span>
            <div>
              <p className="text-[12.5px] font-semibold text-ink-900">Ada {scopedCandidates.length} kandidat jadwal yang belum diterapkan.</p>
              <p className="text-[11px] text-ink-500">Tinjau perubahan sebelum masuk ke jadwal operasional.</p>
            </div>
          </div>
          <Link href="/jadwal-cerdas" className="shrink-0 rounded-xl bg-violet px-3.5 py-2 text-[12.5px] font-semibold text-white hover:brightness-95">
            Tinjau Kandidat ({scopedCandidates.length})
          </Link>
        </div>
      )}

      {toast && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12.5px] text-emerald">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} aria-label="Tutup">
            <X size={14} />
          </button>
        </div>
      )}

      {duplicateSource && (
        <div className="flex items-center justify-between rounded-xl border border-brand-600/30 bg-brand-50 px-4 py-2.5 text-[12.5px] text-brand-700">
          <span>
            Mode duplikat aktif — klik sel kosong yang eligible untuk menempatkan salinan {mapelMap.get(duplicateSource.subjectId) ?? "jadwal"} (
            {kelasMap.get(duplicateSource.classId) ?? "-"}).
          </span>
          <button onClick={() => setDuplicateSource(null)} className="font-medium underline">
            Batal
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-700">Schedule Model</label>
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="h-11 rounded-xl border border-border bg-surface px-3 text-[13.5px] text-ink-900"
          >
            {activeModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.namaModel}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-700">Lihat per</label>
          <div className="flex overflow-hidden rounded-xl border border-border">
            {(["kelas", "guru", "ruangan"] as JadwalViewBy[]).map((v) => (
              <button
                key={v}
                disabled={v === "ruangan" && roomDisabled}
                onClick={() => changeViewBy(v)}
                className={`h-11 px-3.5 text-[12.5px] font-medium capitalize transition-colors disabled:cursor-not-allowed disabled:text-ink-300 ${
                  viewBy === v ? "bg-brand-600 text-white" : "bg-surface text-ink-700 hover:bg-surface-muted"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-700 capitalize">{viewBy}</label>
          {viewBy === "kelas" ? (
            <div className="relative" ref={kelasPickerRef}>
              <button
                type="button"
                onClick={() => setKelasPickerOpen((v) => !v)}
                className="flex h-11 min-w-[220px] items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 text-[13.5px] text-ink-900 hover:bg-surface-muted"
              >
                <span>{entityOptions.find((o) => o.id === activeEntityId)?.label ?? "Belum ada data"}</span>
                {kelasJpSummary.get(activeEntityId) && (
                  <Badge tone={kelasJpSummary.get(activeEntityId)!.terjadwal >= kelasJpSummary.get(activeEntityId)!.target ? "success" : "warning"}>
                    {kelasJpSummary.get(activeEntityId)!.terjadwal}/{kelasJpSummary.get(activeEntityId)!.target} JP
                  </Badge>
                )}
                <ChevronDown size={14} className="text-ink-400" />
              </button>
              {kelasPickerOpen && (
                <div className="absolute left-0 top-full z-20 mt-1.5 max-h-80 w-72 overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-lg">
                  {entityOptions.length === 0 && <p className="px-3 py-2 text-[12.5px] text-ink-400">Belum ada data kelas.</p>}
                  {entityOptions.map((o) => {
                    const jp = kelasJpSummary.get(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => { setSelectedEntityId(o.id); setKelasPickerOpen(false); }}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] hover:bg-surface-muted ${o.id === activeEntityId ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-800"}`}
                      >
                        <span>{o.label}</span>
                        {jp && <Badge tone={jp.terjadwal >= jp.target ? "success" : "warning"}>{jp.terjadwal}/{jp.target} JP</Badge>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <select
              value={activeEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="h-11 min-w-[180px] rounded-xl border border-border bg-surface px-3 text-[13.5px] text-ink-900"
            >
              {entityOptions.length === 0 && <option value="">Belum ada data</option>}
              {entityOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-700">Tampilan</label>
          <div className="flex overflow-hidden rounded-xl border border-border">
            {(["mingguan", "harian"] as JadwalRangeMode[]).map((r) => (
              <button
                key={r}
                onClick={() => setRangeMode(r)}
                className={`h-11 px-3.5 text-[12.5px] font-medium capitalize transition-colors ${
                  rangeMode === r ? "bg-brand-600 text-white" : "bg-surface text-ink-700 hover:bg-surface-muted"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {rangeMode === "harian" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-medium text-ink-700">Hari</label>
            <select
              value={dayForHarian}
              onChange={(e) => setSelectedDay(e.target.value as HariSekolah)}
              className="h-11 rounded-xl border border-border bg-surface px-3 text-[13.5px] text-ink-900"
            >
              {activeDays.map((d) => (
                <option key={d} value={d}>
                  {formatHari(d)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          <div className="relative" ref={filterMenuRef}>
            <button
              type="button"
              onClick={() => setFilterMenuOpen((v) => !v)}
              className={`flex h-11 items-center gap-1.5 rounded-xl border px-3.5 text-[12.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                highlightFilter !== "semua" ? "border-brand-600/40 bg-brand-50 text-brand-700" : "border-border bg-surface text-ink-700 hover:border-brand-600/30 hover:text-brand-700"
              }`}
            >
              <Filter size={14} /> Filter{highlightFilter !== "semua" ? ` · ${highlightFilter === "conflict" ? "Conflict" : "Kandidat"}` : ""}
              <ChevronDown size={13} className={`transition-transform ${filterMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {filterMenuOpen && (
              <div className="absolute right-0 z-30 mt-1.5 w-56 rounded-2xl border border-border bg-surface p-1.5 shadow-float">
                {(
                  [
                    { key: "semua" as const, label: "Semua", desc: "Tampilkan semua jadwal apa adanya" },
                    { key: "conflict" as const, label: "Hanya Conflict", desc: `Redupkan yang lain${conflictCount > 0 ? ` (${conflictCount})` : ""}` },
                    { key: "kandidat" as const, label: "Hanya Kandidat Pending", desc: `Redupkan yang lain${scopedCandidates.length > 0 ? ` (${scopedCandidates.length})` : ""}` },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setHighlightFilter(opt.key); setFilterMenuOpen(false); }}
                    className={`flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left hover:bg-surface-muted ${highlightFilter === opt.key ? "bg-brand-50" : ""}`}
                  >
                    <span className="text-[12.5px] font-semibold text-ink-800">{opt.label}</span>
                    <span className="text-[10.5px] text-ink-400">{opt.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <DataJadwalMenu
            assignments={assignments}
            guruList={guruList}
            kelasList={kelasList}
            mapelList={mapelList}
            ruanganList={ruanganList}
            jamPelajaranList={jamPelajaranList}
            activeDays={activeDays}
            academicContextId={activeContext?.id ?? ""}
            scheduleModelId={selectedModelId}
            contextLabel={contextLabel}
            schoolName={schoolName}
          />

          <div className="relative" ref={aiMenuRef}>
            <Button
              variant="secondary"
              size="md"
              loading={aiBusy}
              disabled={viewBy !== "kelas" || !activeEntityId}
              title={viewBy !== "kelas" ? "Pilih tampilan Per Kelas dulu untuk pakai SAKALA AI" : undefined}
              onClick={() => setAiMenuOpen((v) => !v)}
              className="!bg-ink-900 !text-white hover:!brightness-110 disabled:!bg-ink-900/40"
            >
              <Sparkles size={14} /> SAKALA AI
            </Button>
            {aiMenuOpen && viewBy === "kelas" && activeEntityId && (
              <div className="absolute right-0 top-full z-20 mt-1.5 w-72 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
                <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  Untuk {entityOptions.find((o) => o.id === activeEntityId)?.label ?? "kelas ini"}
                </p>
                <button
                  type="button"
                  onClick={() => void runAiFill("class")}
                  className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-surface-muted"
                >
                  <span className="text-[13px] font-semibold text-ink-900">Lengkapi kekurangan kelas ini</span>
                  <span className="text-[11.5px] text-ink-500">Cuma isi slot kosong, jadwal yang sudah ada tidak diubah.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAiConfirmFullWeek(true)}
                  className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-surface-muted"
                >
                  <span className="text-[13px] font-semibold text-ink-900">Susun ulang jadwal kelas ini</span>
                  <span className="text-[11.5px] text-ink-500">Ganti jadwal kelas ini dari nol (kelas lain tidak tersentuh).</span>
                </button>
              </div>
            )}
          </div>

          {selectedModel && (
            <span className="text-[11.5px] text-ink-400">Mode ruangan: {formatModeRuangan(selectedModel.modeRuangan)}</span>
          )}
        </div>
      </div>

      {activeEntityId === "" ? (
        <EmptyState title={`Belum ada data ${viewBy}`} description="Tambahkan datanya dulu di halaman master data terkait." />
      ) : grid.rows.length === 0 ? (
        <EmptyState title="Belum ada Jam Pelajaran" description="Susun Jam Pelajaran untuk konteks akademik ini dulu di halaman Akademik." />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {viewBy === "kelas" && guruList.length > 0 && (
          <aside className="shrink-0 rounded-card border border-border bg-surface p-3 lg:w-56">
            <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">Seret guru ke jam kosong</p>
            <div className="flex max-h-[420px] flex-col gap-1 overflow-y-auto">
              {guruList.map((g) => (
                <div
                  key={g.id}
                  draggable
                  onDragStart={(e) => { setDraggingTeacherId(g.id); e.dataTransfer.setData("text/plain", g.id); e.dataTransfer.effectAllowed = "copy"; }}
                  onDragEnd={() => setDraggingTeacherId(null)}
                  className={`cursor-grab rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-[12px] font-medium text-ink-700 active:cursor-grabbing ${draggingTeacherId === g.id ? "opacity-40" : ""}`}
                >
                  {g.namaGuru}
                </div>
              ))}
            </div>
          </aside>
        )}
        <div className="min-w-0 flex-1 overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-surface-muted">
                <th className="w-28 px-3 py-2.5 text-left font-medium text-ink-500">Jam</th>
                {gridDays.map((d) => (
                  <th key={d} className="px-3 py-2.5 text-left font-medium text-ink-500">
                    {formatHari(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => {
                const refJam = gridDays.map((d) => cellsByKey.get(cellKey(d, row.nomorUrut))?.jamPelajaran).find((j) => j);
                return (
                  <tr key={row.nomorUrut} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-ink-900">Jam ke-{row.nomorUrut}</div>
                      {refJam && (
                        <div className="text-[11px] text-ink-400">
                          {refJam.waktuMulai}–{refJam.waktuSelesai}
                        </div>
                      )}
                    </td>
                    {gridDays.map((d) => {
                      const cell = cellsByKey.get(cellKey(d, row.nomorUrut));
                      if (!cell) return <td key={d} className="px-3 py-2" />;
                      return (
                        <td key={d} className="px-2 py-1.5 align-top">
                          <JadwalCell
                            cell={cell}
                            onClick={() => handleCellClick(cell)}
                            onDropTeacher={viewBy === "kelas" ? (teacherId) => handleGuruDrop(d, row.nomorUrut, teacherId) : undefined}
                            entityLabel={
                              cell.assignment
                                ? viewBy === "kelas"
                                  ? guruMap.get(cell.assignment.teacherId)
                                  : kelasMap.get(cell.assignment.classId)
                                : undefined
                            }
                            mapelLabel={cell.assignment ? mapelMap.get(cell.assignment.subjectId) : undefined}
                            ruanganLabel={cell.assignment?.roomId ? ruanganMap.get(cell.assignment.roomId) : undefined}
                            cardColor={cell.assignment ? mapelColorMap.get(cell.assignment.subjectId) : undefined}
                            hasPendingCandidate={candidateCellKeys.has(cellKey(d, row.nomorUrut))}
                            isNew={cell.assignment ? newlyAddedIds.has(cell.assignment.id) : false}
                            showAiHint={!cell.assignment && activeClassHasAiGap}
                            dimmed={
                              highlightFilter === "conflict"
                                ? cell.state !== "conflict"
                                : highlightFilter === "kandidat"
                                  ? !candidateCellKeys.has(cellKey(d, row.nomorUrut))
                                  : false
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}

      <MapelLegend
        subjectIds={scopedAssignments.map((a) => a.subjectId)}
        mapelMap={mapelMap}
        colorMap={mapelColorMap}
      />

      {/* --- Add Schedule Modal (Bagian 26) --- */}
      <Modal open={!!addTarget} onClose={closeAdd} title="Tambah Jadwal">
        {addTarget && selectedModel && (
          <div className="flex flex-col gap-3">
            <p className="text-[12.5px] text-ink-500">
              {formatHari(addTarget.day)}, Jam ke-{addTarget.nomorUrut}
              {effectiveAddJp > 1 ? ` s.d. ke-${addPeriodEnd}` : ""}
            </p>

            {addMaxJp > 1 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-medium text-ink-700">Jumlah JP</label>
                <div className="flex gap-2">
                  {Array.from({ length: addMaxJp }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAddJpCount(n)}
                      className={`h-10 min-w-[52px] rounded-xl border px-3 text-[13px] font-medium transition-colors ${
                        effectiveAddJp === n
                          ? "border-brand-600 bg-brand-600/10 text-brand-700"
                          : "border-border bg-surface text-ink-700 hover:bg-surface-muted"
                      }`}
                    >
                      {n} JP
                    </button>
                  ))}
                </div>
                <p className="text-[11.5px] text-ink-400">
                  Jam ke-{addTarget.nomorUrut} s.d. ke-{addTarget.nomorUrut + addMaxJp - 1} kosong dan tersedia berurutan.
                </p>
              </div>
            )}

            <SelectField label="Kelas" value={addForm.classId} onChange={(v) => setAddForm((f) => ({ ...f, classId: v }))} options={kelasList.map((k) => ({ id: k.id, label: `${k.tingkat} ${k.namaRombel}` }))} />
            <SelectField label="Mata Pelajaran" value={addForm.subjectId} onChange={(v) => setAddForm((f) => ({ ...f, subjectId: v }))} options={mapelList.map((m) => ({ id: m.id, label: m.nama }))} />
            <SelectField label="Guru" value={addForm.teacherId} onChange={(v) => setAddForm((f) => ({ ...f, teacherId: v }))} options={guruList.map((g) => ({ id: g.id, label: g.namaGuru }))} />
            {!roomDisabled && (
              <SelectField
                label={`Ruangan${roomRequired ? " (wajib)" : " (opsional)"}`}
                value={addForm.roomId}
                onChange={(v) => setAddForm((f) => ({ ...f, roomId: v }))}
                options={ruanganList.map((r) => ({ id: r.id, label: r.nama }))}
                allowEmpty={!roomRequired}
              />
            )}
            <SelectField
              label="Jenis Aktivitas"
              value={addForm.activityType}
              onChange={(v) => setAddForm((f) => ({ ...f, activityType: v as JenisSlot }))}
              options={ACTIVITY_OPTIONS.map((a) => ({ id: a, label: formatJenisSlot({ jenisSlot: a, namaCustom: "Lainnya" }) }))}
            />

            {addForm.classId && addForm.teacherId && <ConflictList conflicts={addRealtimeConflicts} />}
            {addError && <p className="text-[12px] text-rose">{addError}</p>}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                loading={addSaving}
                disabled={!addForm.classId || !addForm.subjectId || !addForm.teacherId || addHasBlockingConflict}
                onClick={() => runSaveAdd(true)}
              >
                Simpan Jadwal
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* --- Detail / context menu (Bagian 25.5) --- */}
      <Modal open={!!detailAssignment} onClose={() => setDetailAssignment(null)} title="Detail Jadwal">
        {detailAssignment && (
          <div className="flex flex-col gap-3">
            <DetailRow label="Kelas" value={kelasMap.get(detailAssignment.classId) ?? "-"} />
            <DetailRow label="Mata Pelajaran" value={mapelMap.get(detailAssignment.subjectId) ?? "-"} />
            <DetailRow label="Guru" value={guruMap.get(detailAssignment.teacherId) ?? "-"} />
            <DetailRow label="Ruangan" value={detailAssignment.roomId ? ruanganMap.get(detailAssignment.roomId) ?? "-" : "-"} />
            <DetailRow label="Hari" value={formatHari(detailAssignment.day)} />
            <DetailRow label="Jam" value={`Ke-${detailAssignment.periodStart}${detailAssignment.periodEnd !== detailAssignment.periodStart ? `–${detailAssignment.periodEnd}` : ""}`} />
            <DetailRow label="Aktivitas" value={formatJenisSlot({ jenisSlot: detailAssignment.activityType, namaCustom: "Lainnya" })} />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={() => openEdit(detailAssignment)}>
                <Pencil size={14} /> Edit / Pindahkan
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDuplicateSource(detailAssignment);
                  setDetailAssignment(null);
                }}
              >
                <Copy size={14} /> Duplikat
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setDeleteTarget(detailAssignment);
                  setDetailAssignment(null);
                }}
              >
                <Trash2 size={14} /> Hapus
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* --- Move/Edit Schedule Modal (Bagian 27) --- */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit / Pindahkan Jadwal">
        {editTarget && (
          <div className="flex flex-col gap-3">
            <SelectField label="Kelas" value={editForm.classId} onChange={(v) => setEditForm((f) => ({ ...f, classId: v }))} options={kelasList.map((k) => ({ id: k.id, label: `${k.tingkat} ${k.namaRombel}` }))} />
            <SelectField label="Mata Pelajaran" value={editForm.subjectId} onChange={(v) => setEditForm((f) => ({ ...f, subjectId: v }))} options={mapelList.map((m) => ({ id: m.id, label: m.nama }))} />
            <SelectField label="Guru" value={editForm.teacherId} onChange={(v) => setEditForm((f) => ({ ...f, teacherId: v }))} options={guruList.map((g) => ({ id: g.id, label: g.namaGuru }))} />
            {!roomDisabled && (
              <SelectField
                label={`Ruangan${roomRequired ? " (wajib)" : " (opsional)"}`}
                value={editForm.roomId}
                onChange={(v) => setEditForm((f) => ({ ...f, roomId: v }))}
                options={ruanganList.map((r) => ({ id: r.id, label: r.nama }))}
                allowEmpty={!roomRequired}
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Hari" value={editForm.day} onChange={(v) => setEditForm((f) => ({ ...f, day: v as HariSekolah }))} options={activeDays.map((d) => ({ id: d, label: formatHari(d) }))} />
              <Input
                label="Jam ke-"
                type="number"
                min={1}
                value={editForm.nomorUrut}
                onChange={(e) => setEditForm((f) => ({ ...f, nomorUrut: Number(e.target.value) || 1 }))}
              />
            </div>
            {editForm.classId && editForm.teacherId && <ConflictList conflicts={editRealtimeConflicts} />}
            {editError && <p className="text-[12px] text-rose">{editError}</p>}
            <div className="flex gap-2 pt-1">
              <Button variant="primary" size="sm" loading={editSaving} disabled={editHasBlockingConflict} onClick={runSaveEdit}>
                Simpan Perubahan
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* --- Delete Schedule (Bagian 28) --- */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Jadwal">
        {deleteTarget && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-ink-700">
              {mapelMap.get(deleteTarget.subjectId)} — {kelasMap.get(deleteTarget.classId)} — {formatHari(deleteTarget.day)} jam ke-{deleteTarget.periodStart}
            </p>
            <p className="text-[12px] text-ink-500">
              {deleteTarget.status === "committed"
                ? "Jadwal ini sudah committed — akan diarsipkan (bukan dihapus permanen) supaya Schedule Version yang sudah tercatat tetap utuh."
                : "Jadwal ini belum committed dan akan dihapus permanen."}
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-ink-700">Alasan (opsional)</label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={2}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-brand-600/50"
                placeholder="Catatan untuk diri sendiri, tidak tersimpan (History belum dibangun — step 18)"
              />
            </div>
            {deleteError && <p className="text-[12px] text-rose">{deleteError}</p>}
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>
                Batal
              </Button>
              <Button variant="danger" size="sm" loading={deleting} onClick={runDelete}>
                Konfirmasi Hapus
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  allowEmpty,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  allowEmpty?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12.5px] font-medium text-ink-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl border border-border bg-surface px-3 text-[13.5px] text-ink-900"
      >
        {allowEmpty && <option value="">— Tidak ada —</option>}
        {!allowEmpty && !value && <option value="">Pilih...</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-1.5 text-[13px] last:border-0">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </div>
  );
}

/**
 * Bagian 22.5 (JP_MISMATCH) & non-blocking conflict lain hasil commit —
 * blocking sudah dicegah di lapisan usecases, jadi apa pun yang tersisa di
 * sini murni catatan non-blocking. Digabung ke toast singkat supaya tidak
 * dibuang begitu saja setelah Tambah Jadwal / Pindah Jadwal, konsisten
 * dengan pola "postCommitConflicts" di app/jadwal-cerdas.
 */
function buildCommitToast(base: string, conflicts: ScheduleConflict[]): string {
  const nonBlocking = conflicts.filter((c) => !c.blocking);
  if (nonBlocking.length === 0) return base;
  return `${base} Catatan: ${nonBlocking.map((c) => c.message).join(" ")}`;
}

function ConflictList({ conflicts }: { conflicts: ScheduleConflict[] }) {
  if (conflicts.length === 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald">
        <CheckCircle2 size={14} /> Validasi berhasil, tidak ada konflik.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {conflicts.map((c) => (
        <div key={c.conflictId} className="flex items-start gap-2 rounded-xl bg-surface-muted px-3 py-2 text-[12px] text-ink-700">
          <span className={`mt-0.5 flex-shrink-0 ${c.severity === "error" ? "text-rose" : c.severity === "warning" ? "text-amber-600" : "text-ink-400"}`}>
            <ConflictTypeIcon entityType={c.entityType} />
          </span>
          <div className="flex flex-col gap-0.5">
            <Badge tone={conflictTone(c.severity)}>{CONFLICT_TYPE_LABEL[c.type] ?? c.type}</Badge>
            <span>{c.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const STAT_TONE: Record<"brand" | "violet" | "emerald" | "rose" | "amber" | "neutral", { bg: string; text: string }> = {
  brand: { bg: "bg-brand-50", text: "text-brand-600" },
  violet: { bg: "bg-violet-50", text: "text-violet-600" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald" },
  rose: { bg: "bg-rose-50", text: "text-rose" },
  amber: { bg: "bg-amber-50", text: "text-amber" },
  neutral: { bg: "bg-surface-muted", text: "text-ink-400" },
};

function JadwalStatCard({ icon, value, label, tone }: { icon: ReactNode; value: number; label: string; tone: keyof typeof STAT_TONE }) {
  const t = STAT_TONE[tone];
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-surface px-3.5 py-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.bg} ${t.text}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[17px] font-bold leading-none tabular-nums text-ink-900">{value}</p>
        <p className="mt-1 truncate text-[10.5px] font-medium text-ink-500">{label}</p>
      </div>
    </div>
  );
}

function JadwalCell({
  cell,
  onClick,
  onDropTeacher,
  entityLabel,
  mapelLabel,
  ruanganLabel,
  cardColor,
  hasPendingCandidate,
  dimmed,
  isNew,
  showAiHint,
}: {
  cell: GridCell;
  onClick: () => void;
  onDropTeacher?: (teacherId: string) => void;
  entityLabel?: string;
  mapelLabel?: string;
  ruanganLabel?: string;
  cardColor?: { tint: string; accent: string; text: string };
  hasPendingCandidate?: boolean;
  dimmed?: boolean;
  isNew?: boolean;
  showAiHint?: boolean;
}) {
  if (cell.state === "empty") {
    if (!cell.jamPelajaran) {
      return <div className="flex h-16 items-center justify-center text-[11px] text-ink-300">—</div>;
    }
    if (isEligibleForAdd(cell)) {
      return (
        <button
          onClick={onClick}
          onDragOver={onDropTeacher ? (e) => e.preventDefault() : undefined}
          onDrop={
            onDropTeacher
              ? (e) => {
                  e.preventDefault();
                  const teacherId = e.dataTransfer.getData("text/plain");
                  if (teacherId) onDropTeacher(teacherId);
                }
              : undefined
          }
          className={`relative flex h-16 w-full items-center justify-center gap-1 rounded-xl border border-dashed text-[11.5px] transition-all ${
            hasPendingCandidate
              ? "border-violet bg-violet-50/40 text-violet hover:bg-violet-50"
              : "border-border text-ink-400 hover:border-brand-600/40 hover:bg-brand-50 hover:text-brand-700"
          } ${dimmed ? "opacity-20" : ""}`}
        >
          {!hasPendingCandidate && showAiHint && (
            <span
              className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-400"
              title="SAKALA AI kemungkinan bisa bantu isi sebagian jadwal kelas ini — coba tombol SAKALA AI di toolbar"
            />
          )}
          {hasPendingCandidate ? (
            <span className="text-[10px] font-semibold">Ada kandidat</span>
          ) : (
            <>
              <Plus size={13} /> Tambah Jadwal
            </>
          )}
        </button>
      );
    }
    return <div className="flex h-16 items-center justify-center text-[11px] text-ink-300">Nonaktif</div>;
  }

  if (cell.state === "fixed_activity") {
    const label = cell.jamPelajaran?.jenis === "istirahat" ? "Istirahat" : cell.slotTemplate ? formatJenisSlot(cell.slotTemplate) : "Aktivitas Tetap";
    return (
      <div className="flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl bg-surface-muted text-[11.5px] text-ink-500">
        <Info size={13} />
        {label}
      </div>
    );
  }

  const isConflict = cell.state === "conflict";

  // Identitas Warna Mata Pelajaran: tint lembut + accent strip kiri per mapel,
  // konsisten dengan Data Guru — tetap informatif di semua mode "Lihat per".
  // Blocking conflict tetap prioritas visual merah (readability) sehingga tidak tertutupi.
  const style = !isConflict && cardColor
    ? { backgroundColor: cardColor.tint, borderColor: `${cardColor.accent}33`, borderLeft: `3px solid ${cardColor.accent}` }
    : undefined;

  return (
    <button
      onClick={onClick}
      style={style}
      className={`relative flex min-h-16 w-full flex-col justify-center gap-0.5 rounded-xl border px-2 py-1.5 text-left text-[11.5px] transition-all ${
        isConflict
          ? "border-rose bg-rose-50 hover:bg-rose-50/70"
          : cardColor
            ? "hover:brightness-95"
            : "border-brand-600/20 bg-brand-50 hover:bg-brand-50/70"
      } ${hasPendingCandidate ? "ring-2 ring-dashed ring-violet ring-offset-1" : ""} ${isNew ? "ring-2 ring-emerald-400 ring-offset-1" : ""} ${dimmed ? "opacity-20" : ""}`}
    >
      {hasPendingCandidate && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet text-[8px] font-bold text-white" title="Ada kandidat perubahan menunggu review">!</span>
      )}
      <span className="break-words font-semibold leading-snug text-ink-900">{mapelLabel ?? "-"}</span>
      <span
        className="break-words leading-snug text-ink-700"
      >
        {entityLabel ?? "-"}
      </span>
      {ruanganLabel && <span className="break-words leading-snug text-ink-400">{ruanganLabel}</span>}
      {isConflict ? (
        <Badge tone="danger">
          <AlertTriangle size={10} className="mr-0.5 inline" /> Konflik
        </Badge>
      ) : isNew ? (
        <Badge tone="success">Baru</Badge>
      ) : null}
    </button>
  );
}
