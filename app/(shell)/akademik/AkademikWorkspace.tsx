"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  CheckCircle2,
  Trash2,
  Pencil,
  UserCog,
  GraduationCap,
  CalendarRange,
  Clock,
  CalendarClock,
  ListChecks,
} from "lucide-react";
import type { AcademicContext, Semester } from "@/lib/domain/academicContext";
import { formatContextLabel } from "@/lib/domain/academicContext";
import type { SchoolProfile } from "@/lib/domain/schoolProfile";
import type { PeriodeAkademik, PeriodeAkademikDraft, StatusAktif as PeriodeStatus } from "@/lib/domain/periodeAkademik";
import type { HariSekolah, JamPelajaran, JamPelajaranDraft, JenisJamPelajaran } from "@/lib/domain/jamPelajaran";
import { URUTAN_HARI, formatHari, calculateDurationMinutes } from "@/lib/domain/jamPelajaran";
import type { ModeRuangan, PenggunaanRombel, ScheduleModel, ScheduleModelDraft } from "@/lib/domain/scheduleModel";
import { formatModeRuangan, formatPenggunaanRombel } from "@/lib/domain/scheduleModel";
import type { JenisSlot, SlotTemplate, SlotTemplateDraft } from "@/lib/domain/slotTemplate";
import { formatJenisSlot } from "@/lib/domain/slotTemplate";
import {
  createAcademicContextAction,
  setActiveAcademicContextAction,
  deleteAcademicContextAction,
  saveSchoolProfileAction,
  createPeriodeAkademikAction,
  updatePeriodeAkademikAction,
  deletePeriodeAkademikAction,
  createJamPelajaranAction,
  updateJamPelajaranAction,
  deleteJamPelajaranAction,
  createScheduleModelAction,
  updateScheduleModelAction,
  deleteScheduleModelAction,
  listSlotTemplateAction,
  createSlotTemplateAction,
  updateSlotTemplateAction,
  deleteSlotTemplateAction,
} from "./actions";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";
import JamPelajaranManager from "./JamPelajaranManager";

type Tab = "profil" | "periode" | "jam" | "model";

export default function AkademikWorkspace({
  initialProfile,
  initialContexts,
  initialPeriodeList,
  initialJamList,
  initialScheduleModels,
}: {
  initialProfile: SchoolProfile | null;
  initialContexts: AcademicContext[];
  initialPeriodeList: PeriodeAkademik[];
  initialJamList: JamPelajaran[];
  initialScheduleModels: ScheduleModel[];
}) {
  const [tab, setTab] = useState<Tab>("profil");

  const [profile, setProfile] = useState<SchoolProfile | null>(initialProfile);
  const [contexts, setContexts] = useState<AcademicContext[]>(initialContexts);
  const [periodeList, setPeriodeList] = useState<PeriodeAkademik[]>(initialPeriodeList);
  const [jamList, setJamList] = useState<JamPelajaran[]>(initialJamList);
  const [modelList, setModelList] = useState<ScheduleModel[]>(initialScheduleModels);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  const [periodeModalOpen, setPeriodeModalOpen] = useState(false);
  const [periodeEditing, setPeriodeEditing] = useState<PeriodeAkademik | null>(null);
  const [periodeError, setPeriodeError] = useState<string | null>(null);

  const [jamModalOpen, setJamModalOpen] = useState(false);
  const [jamEditing, setJamEditing] = useState<JamPelajaran | null>(null);
  const [jamError, setJamError] = useState<string | null>(null);

  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelEditing, setModelEditing] = useState<ScheduleModel | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);

  // Slot Template dikelola per Schedule Model — dibuka lewat "Kelola Slot".
  const [slotModel, setSlotModel] = useState<ScheduleModel | null>(null);
  const [slotList, setSlotList] = useState<SlotTemplate[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotFormOpen, setSlotFormOpen] = useState(false);
  const [slotEditing, setSlotEditing] = useState<SlotTemplate | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const activeContext = contexts.find((c) => c.isActive) ?? null;

  // =========================================================
  // Profil Admin
  // =========================================================
  function handleSaveProfile(formData: FormData) {
    const nama = String(formData.get("nama") ?? "");
    const jabatan = String(formData.get("jabatan") ?? "");
    const namaSekolah = String(formData.get("namaSekolah") ?? "");
    const tahunPelajaranDefault = String(formData.get("tahunPelajaranDefault") ?? "");
    const semesterDefault = (formData.get("semesterDefault") as Semester) ?? "ganjil";

    startTransition(async () => {
      const result = await saveSchoolProfileAction(
        profile?.id ?? null,
        nama,
        jabatan,
        namaSekolah,
        tahunPelajaranDefault,
        semesterDefault
      );

      if (!result.ok) {
        setProfileError(result.error);
        return;
      }

      setProfile(result.data.profile);
      setContexts(result.data.contexts);
      setProfileModalOpen(false);
      setProfileError(null);
    });
  }

  // =========================================================
  // Konteks Akademik
  // =========================================================
  function handleCreateContext(formData: FormData) {
    const tahunPelajaran = String(formData.get("tahunPelajaran") ?? "");
    const semester = (formData.get("semester") as Semester) ?? "ganjil";

    startTransition(async () => {
      const result = await createAcademicContextAction(tahunPelajaran, semester);
      if (!result.ok) {
        setContextError(result.error);
        return;
      }
      setContexts((prev) =>
        result.data.isActive ? [...prev.map((c) => ({ ...c, isActive: false })), result.data] : [...prev, result.data]
      );
      setContextModalOpen(false);
      setContextError(null);
    });
  }

  function handleSetActive(context: AcademicContext) {
    if (context.isActive) return;
    startTransition(async () => {
      const result = await setActiveAcademicContextAction(context.id);
      if (!result.ok) return;
      setContexts((prev) => prev.map((c) => ({ ...c, isActive: c.id === result.data.id })));
      // Konteks aktif berganti — Periode Akademik & Jam Pelajaran yang tampil
      // harus ikut berganti. Reload halaman supaya server component fetch ulang.
      window.location.reload();
    });
  }

  function handleDeleteContext(context: AcademicContext) {
    if (context.isActive) return;
    if (!confirm(`Hapus konteks ${formatContextLabel(context)}? Tindakan tidak bisa dibatalkan.`)) return;
    startTransition(async () => {
      const result = await deleteAcademicContextAction(context);
      if (result.ok) setContexts((prev) => prev.filter((c) => c.id !== context.id));
    });
  }

  // =========================================================
  // Periode Akademik
  // =========================================================
  function openCreatePeriode() {
    setPeriodeEditing(null);
    setPeriodeError(null);
    setPeriodeModalOpen(true);
  }

  function openEditPeriode(periode: PeriodeAkademik) {
    setPeriodeEditing(periode);
    setPeriodeError(null);
    setPeriodeModalOpen(true);
  }

  function handleSavePeriode(formData: FormData) {
    if (!activeContext) return;
    const draft: PeriodeAkademikDraft = {
      academicContextId: activeContext.id,
      nama: String(formData.get("nama") ?? ""),
      tanggalMulai: String(formData.get("tanggalMulai") ?? ""),
      tanggalSelesai: String(formData.get("tanggalSelesai") ?? ""),
      urutan: Number(formData.get("urutan") ?? 0),
      status: (formData.get("status") as PeriodeStatus) ?? "aktif",
    };

    startTransition(async () => {
      const result = periodeEditing
        ? await updatePeriodeAkademikAction(periodeEditing.id, draft)
        : await createPeriodeAkademikAction(draft);

      if (!result.ok) {
        setPeriodeError(result.error);
        return;
      }

      setPeriodeList((prev) => {
        if (periodeEditing) return prev.map((p) => (p.id === result.data.id ? result.data : p));
        return [...prev, result.data].sort((a, b) => a.urutan - b.urutan);
      });
      setPeriodeModalOpen(false);
      setPeriodeError(null);
    });
  }

  function handleDeletePeriode(periode: PeriodeAkademik) {
    if (!confirm(`Hapus periode "${periode.nama}"? Tindakan tidak bisa dibatalkan.`)) return;
    startTransition(async () => {
      const result = await deletePeriodeAkademikAction(periode.id);
      if (result.ok) setPeriodeList((prev) => prev.filter((p) => p.id !== periode.id));
    });
  }

  // =========================================================
  // Jam Pelajaran
  // =========================================================
  function openCreateJam() {
    setJamEditing(null);
    setJamError(null);
    setJamModalOpen(true);
  }

  function openEditJam(jam: JamPelajaran) {
    setJamEditing(jam);
    setJamError(null);
    setJamModalOpen(true);
  }

  function handleSaveJam(formData: FormData) {
    if (!activeContext) return;
    const draft: JamPelajaranDraft = {
      academicContextId: activeContext.id,
      hari: (formData.get("hari") as HariSekolah) ?? "senin",
      nomorUrut: Number(formData.get("nomorUrut") ?? 1),
      nama: String(formData.get("nama") ?? ""),
      jenis: (formData.get("jenis") as JenisJamPelajaran) ?? "pembelajaran",
      waktuMulai: String(formData.get("waktuMulai") ?? ""),
      waktuSelesai: String(formData.get("waktuSelesai") ?? ""),
      status: (formData.get("status") as PeriodeStatus) ?? "aktif",
    };

    startTransition(async () => {
      const result = jamEditing
        ? await updateJamPelajaranAction(jamEditing.id, draft)
        : await createJamPelajaranAction(draft);

      if (!result.ok) {
        setJamError(result.error);
        return;
      }

      setJamList((prev) => {
        const next = jamEditing ? prev.map((j) => (j.id === result.data.id ? result.data : j)) : [...prev, result.data];
        return next.sort((a, b) => URUTAN_HARI.indexOf(a.hari) - URUTAN_HARI.indexOf(b.hari) || a.nomorUrut - b.nomorUrut);
      });
      setJamModalOpen(false);
      setJamError(null);
    });
  }

  function handleDeleteJam(jam: JamPelajaran) {
    if (!confirm(`Hapus jam pelajaran "${jam.nama}" (${formatHari(jam.hari)})? Tindakan tidak bisa dibatalkan.`)) return;
    startTransition(async () => {
      const result = await deleteJamPelajaranAction(jam.id);
      if (result.ok) setJamList((prev) => prev.filter((j) => j.id !== jam.id));
    });
  }

  // =========================================================
  // Schedule Model (Bagian 20 / 84)
  // =========================================================
  function openCreateModel() {
    setModelEditing(null);
    setModelError(null);
    setModelModalOpen(true);
  }

  function openEditModel(model: ScheduleModel) {
    setModelEditing(model);
    setModelError(null);
    setModelModalOpen(true);
  }

  function handleSaveModel(formData: FormData) {
    if (!activeContext) return;
    const hariAktif = URUTAN_HARI.filter((h) => formData.get(`hariAktif_${h}`) === "on");
    const hariLiburRaw = String(formData.get("hariLibur") ?? "");
    const hariLibur = hariLiburRaw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const draft: ScheduleModelDraft = {
      academicContextId: activeContext.id,
      namaModel: String(formData.get("namaModel") ?? ""),
      waktuMulai: String(formData.get("waktuMulai") ?? ""),
      durasiStandarMenit: Number(formData.get("durasiStandarMenit") ?? 0),
      maksJamPerHari: Number(formData.get("maksJamPerHari") ?? 0),
      hariAktif,
      hariLibur,
      modeRuangan: (formData.get("modeRuangan") as ModeRuangan) ?? "opsional",
      penggunaanRombel: (formData.get("penggunaanRombel") as PenggunaanRombel) ?? "seragam",
      status: (formData.get("status") as PeriodeStatus) ?? "aktif",
    };

    startTransition(async () => {
      const result = modelEditing
        ? await updateScheduleModelAction(modelEditing.id, draft)
        : await createScheduleModelAction(draft);

      if (!result.ok) {
        setModelError(result.error);
        return;
      }

      setModelList((prev) => {
        if (modelEditing) return prev.map((m) => (m.id === result.data.id ? result.data : m));
        return [...prev, result.data].sort((a, b) => a.namaModel.localeCompare(b.namaModel));
      });
      setModelModalOpen(false);
      setModelError(null);
    });
  }

  function handleDeleteModel(model: ScheduleModel) {
    if (!confirm(`Hapus Schedule Model "${model.namaModel}"? Slot Template di dalamnya ikut terhapus.`)) return;
    startTransition(async () => {
      const result = await deleteScheduleModelAction(model.id);
      if (result.ok) setModelList((prev) => prev.filter((m) => m.id !== model.id));
    });
  }

  // =========================================================
  // Slot Template (Bagian 20.2) — dikelola per Schedule Model
  // =========================================================
  function openSlotManager(model: ScheduleModel) {
    setSlotModel(model);
    setSlotError(null);
    setSlotLoading(true);
    startTransition(async () => {
      const result = await listSlotTemplateAction(model.id);
      setSlotLoading(false);
      if (result.ok) setSlotList(result.data);
    });
  }

  function openCreateSlot() {
    setSlotEditing(null);
    setSlotError(null);
    setSlotFormOpen(true);
  }

  function openEditSlot(slot: SlotTemplate) {
    setSlotEditing(slot);
    setSlotError(null);
    setSlotFormOpen(true);
  }

  function handleSaveSlot(formData: FormData) {
    if (!slotModel) return;
    const jenisSlot = (formData.get("jenisSlot") as JenisSlot) ?? "belajar_mengajar";
    const draft: SlotTemplateDraft = {
      scheduleModelId: slotModel.id,
      hari: (formData.get("hari") as HariSekolah) ?? "senin",
      nomorUrut: Number(formData.get("nomorUrut") ?? 1),
      jenisSlot,
      namaCustom: jenisSlot === "custom" ? String(formData.get("namaCustom") ?? "") : null,
    };

    startTransition(async () => {
      const result = slotEditing
        ? await updateSlotTemplateAction(slotEditing.id, draft)
        : await createSlotTemplateAction(draft);

      if (!result.ok) {
        setSlotError(result.error);
        return;
      }

      setSlotList((prev) => {
        const next = slotEditing ? prev.map((s) => (s.id === result.data.id ? result.data : s)) : [...prev, result.data];
        return next.sort(
          (a, b) => URUTAN_HARI.indexOf(a.hari) - URUTAN_HARI.indexOf(b.hari) || a.nomorUrut - b.nomorUrut
        );
      });
      setSlotFormOpen(false);
      setSlotError(null);
    });
  }

  function handleDeleteSlot(slot: SlotTemplate) {
    if (!confirm(`Hapus Slot Template "${formatJenisSlot(slot)}" (${formatHari(slot.hari)}, ke-${slot.nomorUrut})?`)) return;
    startTransition(async () => {
      const result = await deleteSlotTemplateAction(slot.id);
      if (result.ok) setSlotList((prev) => prev.filter((s) => s.id !== slot.id));
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[20px] font-bold text-ink-900">Akademik</h1>
        <p className="text-[13px] text-ink-500">
          Profil admin, konteks akademik, periode, dan jam pelajaran — dasar semua data & jadwal.
        </p>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-surface-muted p-1">
        <TabButton active={tab === "profil"} onClick={() => setTab("profil")} icon={<UserCog size={14} />}>
          Profil & Konteks
        </TabButton>
        <TabButton active={tab === "periode"} onClick={() => setTab("periode")} icon={<CalendarRange size={14} />}>
          Periode Akademik
        </TabButton>
        <TabButton active={tab === "jam"} onClick={() => setTab("jam")} icon={<Clock size={14} />}>
          Jam Pelajaran
        </TabButton>
        <TabButton active={tab === "model"} onClick={() => setTab("model")} icon={<CalendarClock size={14} />}>
          Model Jadwal
        </TabButton>
      </div>

      {tab === "profil" && (
        <div className="flex flex-col gap-6">
          {/* Bagian 8.1 / 78 — School Profile */}
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <UserCog size={18} />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-ink-900">Profil Admin</p>
                  <p className="text-[12.5px] text-ink-500">Identitas pengelola dan sekolah — dipakai di seluruh aplikasi.</p>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => { setProfileError(null); setProfileModalOpen(true); }}>
                {profile ? "Edit Profil" : "Isi Profil"}
              </Button>
            </div>

            {profile ? (
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
                <Field label="Nama" value={profile.nama} />
                <Field label="Jabatan" value={profile.jabatan} />
                <Field label="Nama Sekolah" value={profile.namaSekolah} />
                <Field
                  label="Konteks Default"
                  value={formatContextLabel({ tahunPelajaran: profile.tahunPelajaranDefault, semester: profile.semesterDefault })}
                />
              </div>
            ) : (
              <div className="mt-2 border-t border-border pt-2">
                <EmptyState
                  title="Profil admin belum diisi"
                  description="Isi profil terlebih dulu — konteks akademik pertama akan dibuat otomatis dari sini."
                  action={
                    <Button size="sm" onClick={() => { setProfileError(null); setProfileModalOpen(true); }}>
                      <Plus size={14} /> Isi Profil
                    </Button>
                  }
                />
              </div>
            )}
          </Card>

          {/* Bagian 8.2 / 77 — Active Academic Context */}
          <Card className="p-0">
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <GraduationCap size={18} />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-ink-900">Konteks Akademik</p>
                  <p className="text-[12.5px] text-ink-500">Satu konteks aktif menjadi dasar semua query & mutation akademik.</p>
                </div>
              </div>
              <Button size="sm" onClick={() => { setContextError(null); setContextModalOpen(true); }}>
                <Plus size={14} /> Tambah Konteks
              </Button>
            </div>

            {contexts.length === 0 ? (
              <EmptyState
                title="Belum ada konteks akademik"
                description="Isi profil admin dulu, atau tambahkan konteks secara manual."
              />
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11.5px] uppercase tracking-wide text-ink-400">
                    <th className="px-5 py-3 font-medium">Tahun Pelajaran</th>
                    <th className="px-5 py-3 font-medium">Semester</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {contexts.map((context) => (
                    <tr key={context.id} className="border-b border-border last:border-0 hover:bg-surface-muted/60">
                      <td className="px-5 py-3.5 font-medium text-ink-900">{context.tahunPelajaran}</td>
                      <td className="px-5 py-3.5 capitalize text-ink-700">{context.semester}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={context.isActive ? "success" : "neutral"}>{context.isActive ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {!context.isActive && (
                            <button
                              onClick={() => handleSetActive(context)}
                              disabled={isPending}
                              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50"
                            >
                              <CheckCircle2 size={14} /> Aktifkan
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteContext(context)}
                            disabled={context.isActive || isPending}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="Hapus"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {tab === "periode" && (
        <Card className="p-0">
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <div>
              <p className="text-[14px] font-semibold text-ink-900">Periode Akademik</p>
              <p className="text-[12.5px] text-ink-500">
                {activeContext
                  ? `Rentang tanggal dalam konteks ${formatContextLabel(activeContext)} — mis. Periode 1, UTS, UAS.`
                  : "Aktifkan satu konteks akademik dulu di tab Profil & Konteks."}
              </p>
            </div>
            {activeContext && (
              <Button size="sm" onClick={openCreatePeriode}>
                <Plus size={14} /> Tambah Periode
              </Button>
            )}
          </div>

          {!activeContext ? (
            <EmptyState title="Belum ada konteks akademik aktif" description="Aktifkan konteks di tab Profil & Konteks terlebih dulu." />
          ) : periodeList.length === 0 ? (
            <EmptyState
              title="Belum ada periode akademik"
              description="Tambahkan periode pertama untuk konteks ini."
              action={
                <Button size="sm" onClick={openCreatePeriode}>
                  <Plus size={14} /> Tambah Periode
                </Button>
              }
            />
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11.5px] uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3 font-medium">Urutan</th>
                  <th className="px-5 py-3 font-medium">Nama</th>
                  <th className="px-5 py-3 font-medium">Tanggal Mulai</th>
                  <th className="px-5 py-3 font-medium">Tanggal Selesai</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {periodeList.map((periode) => (
                  <tr key={periode.id} className="border-b border-border last:border-0 hover:bg-surface-muted/60">
                    <td className="px-5 py-3.5 text-ink-500">{periode.urutan}</td>
                    <td className="px-5 py-3.5 font-medium text-ink-900">{periode.nama}</td>
                    <td className="px-5 py-3.5 text-ink-700">{periode.tanggalMulai}</td>
                    <td className="px-5 py-3.5 text-ink-700">{periode.tanggalSelesai}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={periode.status === "aktif" ? "success" : "neutral"}>
                        {periode.status === "aktif" ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditPeriode(periode)}
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-brand-50 hover:text-brand-600"
                          aria-label="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDeletePeriode(periode)}
                          disabled={isPending}
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose disabled:opacity-30"
                          aria-label="Hapus"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === "jam" && <JamPelajaranManager activeContext={activeContext} initialJamList={jamList} />}

      {false && tab === "jam" && (
        <Card className="p-0">
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <div>
              <p className="text-[14px] font-semibold text-ink-900">Jam Pelajaran</p>
              <p className="text-[12.5px] text-ink-500">
                {activeContext
                  ? `Slot waktu per hari untuk konteks ${formatContextLabel(activeContext)} — dasar Schedule Model.`
                  : "Aktifkan satu konteks akademik dulu di tab Profil & Konteks."}
              </p>
            </div>
            {activeContext && (
              <Button size="sm" onClick={openCreateJam}>
                <Plus size={14} /> Tambah Jam
              </Button>
            )}
          </div>

          {!activeContext ? (
            <EmptyState title="Belum ada konteks akademik aktif" description="Aktifkan konteks di tab Profil & Konteks terlebih dulu." />
          ) : jamList.length === 0 ? (
            <EmptyState
              title="Belum ada jam pelajaran"
              description="Tambahkan slot jam pertama untuk konteks ini."
              action={
                <Button size="sm" onClick={openCreateJam}>
                  <Plus size={14} /> Tambah Jam
                </Button>
              }
            />
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11.5px] uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3 font-medium">Hari</th>
                  <th className="px-5 py-3 font-medium">Ke</th>
                  <th className="px-5 py-3 font-medium">Nama</th>
                  <th className="px-5 py-3 font-medium">Jenis</th>
                  <th className="px-5 py-3 font-medium">Waktu</th>
                  <th className="px-5 py-3 font-medium">Durasi</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {jamList.map((jam) => (
                  <tr key={jam.id} className="border-b border-border last:border-0 hover:bg-surface-muted/60">
                    <td className="px-5 py-3.5 text-ink-700">{formatHari(jam.hari)}</td>
                    <td className="px-5 py-3.5 text-ink-500">{jam.nomorUrut}</td>
                    <td className="px-5 py-3.5 font-medium text-ink-900">{jam.nama}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={jam.jenis === "istirahat" ? "warning" : "info"}>
                        {jam.jenis === "istirahat" ? "Istirahat" : "Pembelajaran"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-ink-700">
                      {jam.waktuMulai}–{jam.waktuSelesai}
                    </td>
                    <td className="px-5 py-3.5 text-ink-500">{calculateDurationMinutes(jam.waktuMulai, jam.waktuSelesai)} mnt</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={jam.status === "aktif" ? "success" : "neutral"}>
                        {jam.status === "aktif" ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditJam(jam)}
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-brand-50 hover:text-brand-600"
                          aria-label="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteJam(jam)}
                          disabled={isPending}
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose disabled:opacity-30"
                          aria-label="Hapus"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === "model" && (
        <Card className="p-0">
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <div>
              <p className="text-[14px] font-semibold text-ink-900">Model Jadwal (Schedule Model)</p>
              <p className="text-[12.5px] text-ink-500">
                {activeContext
                  ? `Konfigurasi jadwal untuk konteks ${formatContextLabel(activeContext)} — bukan timetable, dasar untuk Jadwal Cerdas nanti.`
                  : "Aktifkan satu konteks akademik dulu di tab Profil & Konteks."}
              </p>
            </div>
            {activeContext && (
              <Button size="sm" onClick={openCreateModel}>
                <Plus size={14} /> Tambah Model
              </Button>
            )}
          </div>

          {!activeContext ? (
            <EmptyState title="Belum ada konteks akademik aktif" description="Aktifkan konteks di tab Profil & Konteks terlebih dulu." />
          ) : modelList.length === 0 ? (
            <EmptyState
              title="Belum ada Schedule Model"
              description="Tambahkan model jadwal pertama untuk konteks ini."
              action={
                <Button size="sm" onClick={openCreateModel}>
                  <Plus size={14} /> Tambah Model
                </Button>
              }
            />
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11.5px] uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3 font-medium">Nama Model</th>
                  <th className="px-5 py-3 font-medium">Mulai</th>
                  <th className="px-5 py-3 font-medium">Durasi</th>
                  <th className="px-5 py-3 font-medium">Maks JP/Hari</th>
                  <th className="px-5 py-3 font-medium">Room Mode</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {modelList.map((model) => (
                  <tr key={model.id} className="border-b border-border last:border-0 hover:bg-surface-muted/60">
                    <td className="px-5 py-3.5 font-medium text-ink-900">{model.namaModel}</td>
                    <td className="px-5 py-3.5 text-ink-700">{model.waktuMulai}</td>
                    <td className="px-5 py-3.5 text-ink-500">{model.durasiStandarMenit} mnt</td>
                    <td className="px-5 py-3.5 text-ink-500">{model.maksJamPerHari}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={model.modeRuangan === "wajib" ? "info" : model.modeRuangan === "opsional" ? "neutral" : "warning"}>
                        {formatModeRuangan(model.modeRuangan)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={model.status === "aktif" ? "success" : "neutral"}>
                        {model.status === "aktif" ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openSlotManager(model)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-medium text-brand-600 hover:bg-brand-50"
                        >
                          <ListChecks size={14} /> Kelola Slot
                        </button>
                        <button
                          onClick={() => openEditModel(model)}
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-brand-50 hover:text-brand-600"
                          aria-label="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteModel(model)}
                          disabled={isPending}
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose disabled:opacity-30"
                          aria-label="Hapus"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* ================= Modal: Profil Admin ================= */}
      <Modal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        title={profile ? "Edit Profil Admin" : "Isi Profil Admin"}
      >
        <form action={handleSaveProfile} className="flex flex-col gap-4">
          <Input name="nama" label="Nama" placeholder="cth. Siti Rahma, S.Pd" defaultValue={profile?.nama} required />
          <Input name="jabatan" label="Jabatan" placeholder="cth. Wakil Kepala Sekolah Kurikulum" defaultValue={profile?.jabatan} required />
          <Input name="namaSekolah" label="Nama Sekolah" placeholder="cth. SMA Negeri 1 Contoh" defaultValue={profile?.namaSekolah} required />
          <div className="grid grid-cols-2 gap-3">
            <Input
              name="tahunPelajaranDefault"
              label="Tahun Pelajaran Default"
              placeholder="2025/2026"
              defaultValue={profile?.tahunPelajaranDefault}
              required
            />
            <SelectField name="semesterDefault" label="Semester Default" defaultValue={profile?.semesterDefault ?? "ganjil"}>
              <option value="ganjil">Ganjil</option>
              <option value="genap">Genap</option>
            </SelectField>
          </div>
          {profileError && <p className="text-[11.5px] text-rose">{profileError}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setProfileModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" loading={isPending}>
              Simpan Profil
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= Modal: Konteks Akademik ================= */}
      <Modal open={contextModalOpen} onClose={() => setContextModalOpen(false)} title="Tambah Konteks Akademik">
        <form action={handleCreateContext} className="flex flex-col gap-4">
          <Input name="tahunPelajaran" label="Tahun Pelajaran" placeholder="2025/2026" required />
          <SelectField name="semester" label="Semester" defaultValue="ganjil">
            <option value="ganjil">Ganjil</option>
            <option value="genap">Genap</option>
          </SelectField>
          {contextError && <p className="text-[11.5px] text-rose">{contextError}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setContextModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" loading={isPending}>
              Tambah Konteks
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= Modal: Periode Akademik ================= */}
      <Modal
        open={periodeModalOpen}
        onClose={() => setPeriodeModalOpen(false)}
        title={periodeEditing ? "Edit Periode Akademik" : "Tambah Periode Akademik"}
      >
        <form action={handleSavePeriode} className="flex flex-col gap-4">
          <Input name="nama" label="Nama Periode" placeholder="cth. Periode 1, UTS, UAS" defaultValue={periodeEditing?.nama} required />
          <div className="grid grid-cols-2 gap-3">
            <Input name="tanggalMulai" label="Tanggal Mulai" type="date" defaultValue={periodeEditing?.tanggalMulai} required />
            <Input name="tanggalSelesai" label="Tanggal Selesai" type="date" defaultValue={periodeEditing?.tanggalSelesai} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              name="urutan"
              label="Urutan"
              type="number"
              min={0}
              defaultValue={periodeEditing?.urutan ?? periodeList.length}
              required
            />
            <SelectField name="status" label="Status" defaultValue={periodeEditing?.status ?? "aktif"}>
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </SelectField>
          </div>
          {periodeError && <p className="text-[11.5px] text-rose">{periodeError}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPeriodeModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" loading={isPending}>
              {periodeEditing ? "Simpan Perubahan" : "Tambah Periode"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= Modal: Jam Pelajaran ================= */}
      <Modal open={jamModalOpen} onClose={() => setJamModalOpen(false)} title={jamEditing ? "Edit Jam Pelajaran" : "Tambah Jam Pelajaran"}>
        <form action={handleSaveJam} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <SelectField name="hari" label="Hari" defaultValue={jamEditing?.hari ?? "senin"}>
              {URUTAN_HARI.map((h) => (
                <option key={h} value={h}>
                  {formatHari(h)}
                </option>
              ))}
            </SelectField>
            <Input name="nomorUrut" label="Nomor Urut" type="number" min={1} defaultValue={jamEditing?.nomorUrut ?? 1} required />
          </div>
          <Input name="nama" label="Nama" placeholder="cth. Jam ke-1, Istirahat 1" defaultValue={jamEditing?.nama} required />
          <SelectField name="jenis" label="Jenis" defaultValue={jamEditing?.jenis ?? "pembelajaran"}>
            <option value="pembelajaran">Pembelajaran</option>
            <option value="istirahat">Istirahat</option>
          </SelectField>
          <div className="grid grid-cols-2 gap-3">
            <Input name="waktuMulai" label="Waktu Mulai" type="time" defaultValue={jamEditing?.waktuMulai} required />
            <Input name="waktuSelesai" label="Waktu Selesai" type="time" defaultValue={jamEditing?.waktuSelesai} required />
          </div>
          <SelectField name="status" label="Status" defaultValue={jamEditing?.status ?? "aktif"}>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </SelectField>
          {jamError && <p className="text-[11.5px] text-rose">{jamError}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setJamModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" loading={isPending}>
              {jamEditing ? "Simpan Perubahan" : "Tambah Jam"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= Modal: Schedule Model ================= */}
      <Modal
        open={modelModalOpen}
        onClose={() => setModelModalOpen(false)}
        title={modelEditing ? "Edit Schedule Model" : "Tambah Schedule Model"}
      >
        <form action={handleSaveModel} className="flex flex-col gap-4">
          <Input name="namaModel" label="Nama Model" placeholder="cth. Model Reguler" defaultValue={modelEditing?.namaModel} required />
          <div className="grid grid-cols-2 gap-3">
            <Input name="waktuMulai" label="Waktu Mulai" type="time" defaultValue={modelEditing?.waktuMulai} required />
            <Input
              name="durasiStandarMenit"
              label="Durasi Standar (menit)"
              type="number"
              min={1}
              max={300}
              defaultValue={modelEditing?.durasiStandarMenit ?? 45}
              required
            />
          </div>
          <Input
            name="maksJamPerHari"
            label="Maks Jam Pelajaran / Hari"
            type="number"
            min={1}
            max={20}
            defaultValue={modelEditing?.maksJamPerHari ?? 10}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-medium text-ink-700">Hari Aktif</label>
            <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-surface-muted/40 px-3.5 py-3">
              {URUTAN_HARI.map((h) => (
                <label key={h} className="flex items-center gap-1.5 text-[13px] text-ink-700">
                  <input
                    type="checkbox"
                    name={`hariAktif_${h}`}
                    defaultChecked={modelEditing ? modelEditing.hariAktif.includes(h) : h !== "minggu"}
                  />
                  {formatHari(h)}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-medium text-ink-700">Hari Libur</label>
            <textarea
              name="hariLibur"
              placeholder="Pisahkan dengan koma atau baris baru, format YYYY-MM-DD, cth. 2026-08-17"
              defaultValue={modelEditing?.hariLibur.join(", ")}
              rows={2}
              className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField name="modeRuangan" label="Room Mode" defaultValue={modelEditing?.modeRuangan ?? "opsional"}>
              <option value="wajib">Wajib</option>
              <option value="opsional">Opsional</option>
              <option value="tidak_dipakai">Tidak Dipakai</option>
            </SelectField>
            <SelectField name="penggunaanRombel" label="Penggunaan Rombel" defaultValue={modelEditing?.penggunaanRombel ?? "seragam"}>
              <option value="seragam">Seragam (semua rombel)</option>
              <option value="per_rombel">Per Rombel</option>
            </SelectField>
          </div>
          <SelectField name="status" label="Status" defaultValue={modelEditing?.status ?? "aktif"}>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </SelectField>
          {modelError && <p className="text-[11.5px] text-rose">{modelError}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModelModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" loading={isPending}>
              {modelEditing ? "Simpan Perubahan" : "Tambah Model"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= Modal: Kelola Slot Template ================= */}
      <Modal
        open={slotModel !== null}
        onClose={() => {
          setSlotModel(null);
          setSlotList([]);
        }}
        title={slotModel ? `Slot Template — ${slotModel.namaModel}` : "Slot Template"}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12.5px] text-ink-500">
              Slot selain "Belajar Mengajar" memblokir penempatan pengajaran biasa di jam tersebut.
            </p>
            <Button size="sm" onClick={openCreateSlot}>
              <Plus size={14} /> Tambah Slot
            </Button>
          </div>

          {slotLoading ? (
            <p className="py-6 text-center text-[13px] text-ink-400">Memuat…</p>
          ) : slotList.length === 0 ? (
            <EmptyState title="Belum ada Slot Template" description="Semua jam mengikuti default Belajar Mengajar." />
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11.5px] uppercase tracking-wide text-ink-400">
                    <th className="px-3 py-2 font-medium">Hari</th>
                    <th className="px-3 py-2 font-medium">Ke</th>
                    <th className="px-3 py-2 font-medium">Jenis</th>
                    <th className="px-3 py-2 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {slotList.map((slot) => (
                    <tr key={slot.id} className="border-b border-border last:border-0 hover:bg-surface-muted/60">
                      <td className="px-3 py-2.5 text-ink-700">{formatHari(slot.hari)}</td>
                      <td className="px-3 py-2.5 text-ink-500">{slot.nomorUrut}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={slot.jenisSlot === "belajar_mengajar" ? "info" : "warning"}>{formatJenisSlot(slot)}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditSlot(slot)}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-brand-50 hover:text-brand-600"
                            aria-label="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteSlot(slot)}
                            disabled={isPending}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose disabled:opacity-30"
                            aria-label="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* ================= Modal: Form Slot Template ================= */}
      <Modal open={slotFormOpen} onClose={() => setSlotFormOpen(false)} title={slotEditing ? "Edit Slot Template" : "Tambah Slot Template"}>
        <form action={handleSaveSlot} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <SelectField name="hari" label="Hari" defaultValue={slotEditing?.hari ?? "senin"}>
              {URUTAN_HARI.map((h) => (
                <option key={h} value={h}>
                  {formatHari(h)}
                </option>
              ))}
            </SelectField>
            <Input name="nomorUrut" label="Jam Ke-" type="number" min={1} defaultValue={slotEditing?.nomorUrut ?? 1} required />
          </div>
          <p className="text-[11.5px] text-ink-400">Harus sesuai dengan slot yang sudah terdaftar di tab Jam Pelajaran.</p>
          <SlotJenisField defaultValue={slotEditing?.jenisSlot ?? "belajar_mengajar"} defaultNamaCustom={slotEditing?.namaCustom ?? ""} />
          {slotError && <p className="text-[11.5px] text-rose">{slotError}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setSlotFormOpen(false)}>
              Batal
            </Button>
            <Button type="submit" loading={isPending}>
              {slotEditing ? "Simpan Perubahan" : "Tambah Slot"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SlotJenisField({ defaultValue, defaultNamaCustom }: { defaultValue: JenisSlot; defaultNamaCustom: string }) {
  const [jenis, setJenis] = useState<JenisSlot>(defaultValue);
  return (
    <>
      <SelectField name="jenisSlot" label="Jenis Slot" defaultValue={defaultValue} onValueChange={(v) => setJenis(v as JenisSlot)}>
        <option value="belajar_mengajar">Belajar Mengajar</option>
        <option value="upacara">Upacara</option>
        <option value="religi">Religi</option>
        <option value="istirahat">Istirahat</option>
        <option value="libur">Libur</option>
        <option value="custom">Custom</option>
      </SelectField>
      {jenis === "custom" && (
        <Input name="namaCustom" label="Nama Custom" placeholder="cth. Ekstrakurikuler" defaultValue={defaultNamaCustom} required />
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-medium transition-colors ${
        active ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11.5px] font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className="text-[13.5px] font-medium text-ink-900">{value}</p>
    </div>
  );
}

function SelectField({
  name,
  label,
  defaultValue,
  onValueChange,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12.5px] font-medium text-ink-700">{label}</label>
      <select
        name={name}
        defaultValue={defaultValue}
        onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
        className="h-11 rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"
      >
        {children}
      </select>
    </div>
  );
}
