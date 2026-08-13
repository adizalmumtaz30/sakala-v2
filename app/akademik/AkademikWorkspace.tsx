"use client";

import { useState, useTransition } from "react";
import { Plus, CheckCircle2, Trash2, Pencil, UserCog, GraduationCap, CalendarRange, Clock } from "lucide-react";
import type { AcademicContext, Semester } from "@/lib/domain/academicContext";
import { formatContextLabel } from "@/lib/domain/academicContext";
import type { SchoolProfile } from "@/lib/domain/schoolProfile";
import type { PeriodeAkademik, PeriodeAkademikDraft, StatusAktif as PeriodeStatus } from "@/lib/domain/periodeAkademik";
import type { HariSekolah, JamPelajaran, JamPelajaranDraft, JenisJamPelajaran } from "@/lib/domain/jamPelajaran";
import { URUTAN_HARI, formatHari, calculateDurationMinutes } from "@/lib/domain/jamPelajaran";
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
} from "./actions";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";

type Tab = "profil" | "periode" | "jam";

export default function AkademikWorkspace({
  initialProfile,
  initialContexts,
  initialPeriodeList,
  initialJamList,
}: {
  initialProfile: SchoolProfile | null;
  initialContexts: AcademicContext[];
  initialPeriodeList: PeriodeAkademik[];
  initialJamList: JamPelajaran[];
}) {
  const [tab, setTab] = useState<Tab>("profil");

  const [profile, setProfile] = useState<SchoolProfile | null>(initialProfile);
  const [contexts, setContexts] = useState<AcademicContext[]>(initialContexts);
  const [periodeList, setPeriodeList] = useState<PeriodeAkademik[]>(initialPeriodeList);
  const [jamList, setJamList] = useState<JamPelajaran[]>(initialJamList);

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

      {tab === "jam" && (
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
    </div>
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
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12.5px] font-medium text-ink-700">{label}</label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-11 rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"
      >
        {children}
      </select>
    </div>
  );
}
