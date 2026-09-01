"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, GraduationCap, UserCog, CalendarRange, Clock3, Settings2, Pencil, Plus, Trash2 } from "lucide-react";
import type { AcademicContext, Semester, Jenjang, Institution } from "@/lib/domain/academicContext";
import { formatContextLabel, JENJANG_OPTIONS, INSTITUTION_OPTIONS } from "@/lib/domain/academicContext";
import type { SchoolProfile } from "@/lib/domain/schoolProfile";
import type { PeriodeAkademik, PeriodeAkademikDraft, StatusAktif as PeriodeStatus } from "@/lib/domain/periodeAkademik";
import type { JamPelajaran } from "@/lib/domain/jamPelajaran";
import type { ModeRuangan, PenggunaanRombel, ScheduleModel } from "@/lib/domain/scheduleModel";
import { formatModeRuangan, formatPenggunaanRombel } from "@/lib/domain/scheduleModel";
import { URUTAN_HARI, formatHari } from "@/lib/domain/jamPelajaran";
import {
  createAcademicContextAction,
  updateAcademicContextAction,
  setActiveAcademicContextAction,
  saveSchoolProfileAction,
  createPeriodeAkademikAction,
  updatePeriodeAkademikAction,
  deletePeriodeAkademikAction,
  updateScheduleModelAction,
} from "./actions";
import JamPelajaranManager from "./JamPelajaranManager";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";
import SelectField from "@/components/ui/SelectField";

type Tab = "context" | "periode" | "scheduling";

export default function AcademicFoundationWorkspace({
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
  const [tab, setTab] = useState<Tab>("context");
  const [profile, setProfile] = useState(initialProfile);
  const [contexts, setContexts] = useState(initialContexts);
  const [periodeList, setPeriodeList] = useState(initialPeriodeList);
  const [scheduleModels, setScheduleModels] = useState(initialScheduleModels);
  const [profileOpen, setProfileOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [editingContext, setEditingContext] = useState<AcademicContext | null>(null);
  const [periodeOpen, setPeriodeOpen] = useState(false);
  const [editingPeriode, setEditingPeriode] = useState<PeriodeAkademik | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeContext = contexts.find((c) => c.isActive) ?? null;
  const activeModel = scheduleModels.find((m) => m.status === "aktif") ?? scheduleModels[0] ?? null;

  function saveProfile(formData: FormData) {
    if (!activeContext) {
      setError("Buat atau aktifkan Konteks Akademik terlebih dahulu. Tahun pelajaran dan semester sekarang berasal dari konteks aktif.");
      return;
    }
    const nama = String(formData.get("nama") ?? "");
    const jabatan = String(formData.get("jabatan") ?? "");
    const namaSekolah = String(formData.get("namaSekolah") ?? "");
    startTransition(async () => {
      const result = await saveSchoolProfileAction(
        profile?.id ?? null,
        nama,
        jabatan,
        namaSekolah,
        activeContext.tahunPelajaran,
        activeContext.semester
      );
      if (!result.ok) return setError(result.error);
      setProfile(result.data.profile);
      setContexts(result.data.contexts);
      setProfileOpen(false);
      setError(null);
    });
  }

  function saveContext(formData: FormData) {
    const tahun = String(formData.get("tahunPelajaran") ?? "");
    const semester = (formData.get("semester") as Semester) ?? "ganjil";
    const jenjang = (formData.get("jenjang") as Jenjang) ?? "MTs";
    const institution = (formData.get("institution") as Institution) ?? "Kemenag";
    startTransition(async () => {
      const result = editingContext
        ? await updateAcademicContextAction(editingContext.id, tahun, semester, jenjang, institution)
        : await createAcademicContextAction(tahun, semester, jenjang, institution);
      if (!result.ok) return setError(result.error);
      setContexts((prev) => {
        const rest = prev.filter((c) => c.id !== result.data.id);
        const next = result.data.isActive ? rest.map((c) => ({ ...c, isActive: false })) : rest;
        return [...next, result.data];
      });
      setContextOpen(false);
      setEditingContext(null);
      setError(null);
    });
  }

  function activateContext(context: AcademicContext) {
    startTransition(async () => {
      const result = await setActiveAcademicContextAction(context.id);
      if (!result.ok) return setError(result.error);
      setContexts((prev) => prev.map((c) => ({ ...c, isActive: c.id === context.id })));
      window.location.reload();
    });
  }

  function savePeriode(formData: FormData) {
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
      const result = editingPeriode
        ? await updatePeriodeAkademikAction(editingPeriode.id, draft)
        : await createPeriodeAkademikAction(draft);
      if (!result.ok) return setError(result.error);
      setPeriodeList((prev) => editingPeriode ? prev.map((p) => p.id === result.data.id ? result.data : p) : [...prev, result.data].sort((a, b) => a.urutan - b.urutan));
      setPeriodeOpen(false);
      setEditingPeriode(null);
      setError(null);
    });
  }

  function deletePeriode(id: string) {
    startTransition(async () => {
      const result = await deletePeriodeAkademikAction(id);
      if (result.ok) setPeriodeList((prev) => prev.filter((p) => p.id !== id));
      else setError(result.error);
    });
  }

  function saveRules(formData: FormData) {
    if (!activeContext || !activeModel) return;
    const hariAktif = URUTAN_HARI.filter((h) => formData.get(`hari_${h}`) === "on");
    const hariLibur = String(formData.get("hariLibur") ?? "").split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
    startTransition(async () => {
      const result = await updateScheduleModelAction(activeModel.id, {
        academicContextId: activeContext.id,
        namaModel: activeModel.namaModel,
        // Compatibility bridge: legacy time fields remain persisted until all consumers are migrated.
        waktuMulai: activeModel.waktuMulai,
        durasiStandarMenit: activeModel.durasiStandarMenit,
        maksJamPerHari: Number(formData.get("maksJamPerHari") ?? activeModel.maksJamPerHari),
        hariAktif,
        hariLibur,
        modeRuangan: (formData.get("modeRuangan") as ModeRuangan) ?? activeModel.modeRuangan,
        penggunaanRombel: (formData.get("penggunaanRombel") as PenggunaanRombel) ?? activeModel.penggunaanRombel,
        status: activeModel.status,
      });
      if (!result.ok) return setError(result.error);
      setScheduleModels((prev) => prev.map((m) => m.id === result.data.id ? result.data : m));
      setRulesOpen(false);
      setError(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[20px] font-bold text-ink-900">Fondasi Akademik</h1>
        <p className="text-[13px] text-ink-500">Satu konteks aktif menjadi dasar periode, waktu, aturan jadwal, dan seluruh proses akademik.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <FoundationCard icon={<GraduationCap size={17} />} title="Konteks Aktif" value={activeContext ? formatContextLabel(activeContext) : "Belum ada"} onClick={() => setTab("context")} />
        <FoundationCard icon={<Clock3 size={17} />} title="Waktu & Aturan" value={activeModel ? activeModel.namaModel : "Belum dikonfigurasi"} onClick={() => setTab("scheduling")} />
        <FoundationCard icon={<CalendarRange size={17} />} title="Periode" value={`${periodeList.length} periode`} onClick={() => setTab("periode")} />
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-surface-muted p-1">
        <TabButton active={tab === "context"} onClick={() => setTab("context")} icon={<GraduationCap size={14} />}>Context</TabButton>
        <TabButton active={tab === "periode"} onClick={() => setTab("periode")} icon={<CalendarRange size={14} />}>Periods</TabButton>
        <TabButton active={tab === "scheduling"} onClick={() => setTab("scheduling")} icon={<Settings2 size={14} />}>Scheduling</TabButton>
      </div>

      {error && <div className="rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-[12.5px] text-rose">{error}</div>}

      {tab === "context" && (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700"><UserCog size={17} /></div><div><p className="text-[14px] font-semibold text-ink-900">Profil & Institusi</p><p className="text-[12px] text-ink-500">Identitas admin dan sekolah. Tidak menjadi sumber tahun pelajaran/semester.</p></div></div>
              <Button size="sm" variant="secondary" onClick={() => { setError(null); setProfileOpen(true); }}><Pencil size={14} /> Edit</Button>
            </div>
            {profile ? <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3"><Field label="Nama" value={profile.nama} /><Field label="Jabatan" value={profile.jabatan} /><Field label="Sekolah" value={profile.namaSekolah} /></div> : <EmptyState title="Profil belum diisi" description="Isi identitas admin setelah Konteks Akademik aktif tersedia." />}
          </Card>

          <Card className="p-0">
            <div className="flex items-center justify-between px-5 py-4"><div><p className="text-[14px] font-semibold text-ink-900">Academic Context</p><p className="text-[12px] text-ink-500">Source of truth untuk tahun pelajaran, semester, jenjang, dan kementerian.</p></div><Button size="sm" onClick={() => { setEditingContext(null); setError(null); setContextOpen(true); }}><Plus size={14} /> Tambah</Button></div>
            <table className="w-full text-left text-[13px]"><thead><tr className="border-b border-border text-[11px] uppercase tracking-wide text-ink-400"><th className="px-5 py-3">Tahun</th><th className="px-5 py-3">Semester</th><th className="px-5 py-3">Jenjang</th><th className="px-5 py-3">Kementerian</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Aksi</th></tr></thead><tbody>{contexts.map((c) => <tr key={c.id} className="border-b border-border last:border-0"><td className="px-5 py-3 font-medium">{c.tahunPelajaran}</td><td className="px-5 py-3 capitalize">{c.semester}</td><td className="px-5 py-3">{c.jenjang}</td><td className="px-5 py-3">{c.institution}</td><td className="px-5 py-3"><Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "Aktif" : "Nonaktif"}</Badge></td><td className="px-5 py-3"><div className="flex justify-end gap-1">{!c.isActive && <button onClick={() => activateContext(c)} className="rounded-lg p-1.5 text-brand-600 hover:bg-brand-50" title="Aktifkan"><CheckCircle2 size={15} /></button>}<button onClick={() => { setEditingContext(c); setContextOpen(true); }} className="rounded-lg p-1.5 text-ink-400 hover:bg-brand-50 hover:text-brand-600"><Pencil size={15} /></button></div></td></tr>)}</tbody></table>
          </Card>
        </div>
      )}

      {tab === "periode" && <Card className="p-0"><div className="flex items-center justify-between px-5 py-4"><div><p className="text-[14px] font-semibold text-ink-900">Periode Akademik</p><p className="text-[12px] text-ink-500">Tahapan waktu di dalam konteks aktif. Tidak menyimpan ulang tahun pelajaran atau semester.</p></div>{activeContext && <Button size="sm" onClick={() => { setEditingPeriode(null); setError(null); setPeriodeOpen(true); }}><Plus size={14} /> Tambah</Button>}</div>{!activeContext ? <EmptyState title="Belum ada konteks aktif" description="Aktifkan konteks terlebih dahulu." /> : periodeList.length === 0 ? <EmptyState title="Belum ada periode" description="Tambahkan periode seperti Pembelajaran, UTS, atau UAS." /> : <table className="w-full text-left text-[13px]"><thead><tr className="border-b border-border text-[11px] uppercase tracking-wide text-ink-400"><th className="px-5 py-3">Urutan</th><th className="px-5 py-3">Nama</th><th className="px-5 py-3">Mulai</th><th className="px-5 py-3">Selesai</th><th className="px-5 py-3 text-right">Aksi</th></tr></thead><tbody>{periodeList.map((p) => <tr key={p.id} className="border-b border-border last:border-0"><td className="px-5 py-3">{p.urutan}</td><td className="px-5 py-3 font-medium">{p.nama}</td><td className="px-5 py-3">{p.tanggalMulai}</td><td className="px-5 py-3">{p.tanggalSelesai}</td><td className="px-5 py-3"><div className="flex justify-end gap-1"><button onClick={() => { setEditingPeriode(p); setPeriodeOpen(true); }} className="rounded-lg p-1.5 text-ink-400 hover:bg-brand-50"><Pencil size={15} /></button><button onClick={() => deletePeriode(p.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>}</Card>}

      {tab === "scheduling" && <div className="flex flex-col gap-4"><Card><div className="flex items-center justify-between gap-3"><div><p className="text-[14px] font-semibold text-ink-900">Scheduling Configuration</p><p className="text-[12px] text-ink-500">Waktu konkret berasal dari Time Slots. Bagian ini hanya menyimpan aturan penjadwalan.</p></div>{activeModel && <Button size="sm" variant="secondary" onClick={() => { setError(null); setRulesOpen(true); }}><Settings2 size={14} /> Atur Rules</Button>}</div>{activeModel ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Model" value={activeModel.namaModel} /><Metric label="Maks JP/Hari" value={String(activeModel.maksJamPerHari)} /><Metric label="Ruangan" value={formatModeRuangan(activeModel.modeRuangan)} /><Metric label="Rombel" value={formatPenggunaanRombel(activeModel.penggunaanRombel)} /></div> : <EmptyState title="Belum ada aturan jadwal" description="Schedule Model lama belum tersedia untuk konteks aktif." />}</Card>{activeContext ? <Card><div className="mb-3"><p className="text-[14px] font-semibold text-ink-900">Time Slots</p><p className="text-[12px] text-ink-500">Ini satu-satunya tempat untuk waktu mulai dan selesai slot.</p></div><JamPelajaranManager activeContext={activeContext} initialJamList={initialJamList} /></Card> : <EmptyState title="Belum ada konteks aktif" description="Aktifkan konteks untuk mengatur waktu." />}</div>}

      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} title="Profil Admin & Institusi"><form action={saveProfile} className="flex flex-col gap-4"><Input name="nama" label="Nama" defaultValue={profile?.nama} required /><Input name="jabatan" label="Jabatan" defaultValue={profile?.jabatan} required /><Input name="namaSekolah" label="Nama Sekolah" defaultValue={profile?.namaSekolah} required /><p className="text-[11.5px] text-ink-500">Tahun pelajaran dan semester tidak diisi di sini. Sistem mengambilnya dari Konteks Akademik aktif.</p><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setProfileOpen(false)}>Batal</Button><Button type="submit" loading={isPending}>Simpan</Button></div></form></Modal>
      <Modal open={contextOpen} onClose={() => setContextOpen(false)} title={editingContext ? "Ubah Konteks Akademik" : "Tambah Konteks Akademik"}><form action={saveContext} className="flex flex-col gap-4"><Input name="tahunPelajaran" label="Tahun Pelajaran" defaultValue={editingContext?.tahunPelajaran} required /><SelectField name="semester" label="Semester" defaultValue={editingContext?.semester ?? "ganjil"}><option value="ganjil">Ganjil</option><option value="genap">Genap</option></SelectField><SelectField name="jenjang" label="Jenjang" defaultValue={editingContext?.jenjang ?? "MTs"}>{JENJANG_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}</SelectField><SelectField name="institution" label="Kementerian/Badan" defaultValue={editingContext?.institution ?? "Kemenag"}>{INSTITUTION_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}</SelectField><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setContextOpen(false)}>Batal</Button><Button type="submit" loading={isPending}>{editingContext ? "Simpan" : "Tambah"}</Button></div></form></Modal>
      <Modal open={periodeOpen} onClose={() => setPeriodeOpen(false)} title={editingPeriode ? "Edit Periode" : "Tambah Periode"}><form action={savePeriode} className="flex flex-col gap-4"><Input name="nama" label="Nama" defaultValue={editingPeriode?.nama} required /><div className="grid grid-cols-2 gap-3"><Input name="tanggalMulai" label="Mulai" type="date" defaultValue={editingPeriode?.tanggalMulai} required /><Input name="tanggalSelesai" label="Selesai" type="date" defaultValue={editingPeriode?.tanggalSelesai} required /></div><div className="grid grid-cols-2 gap-3"><Input name="urutan" label="Urutan" type="number" min={0} defaultValue={editingPeriode?.urutan ?? periodeList.length} required /><SelectField name="status" label="Status" defaultValue={editingPeriode?.status ?? "aktif"}><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></SelectField></div><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setPeriodeOpen(false)}>Batal</Button><Button type="submit" loading={isPending}>{editingPeriode ? "Simpan" : "Tambah"}</Button></div></form></Modal>
      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Scheduling Rules"><form action={saveRules} className="flex flex-col gap-4"><Input name="maksJamPerHari" label="Maks JP / Hari" type="number" min={1} max={20} defaultValue={activeModel?.maksJamPerHari ?? 10} required /><div><p className="mb-1.5 text-[12.5px] font-medium text-ink-700">Hari Aktif</p><div className="flex flex-wrap gap-3 rounded-xl border border-border bg-surface-muted/40 p-3">{URUTAN_HARI.map((h) => <label key={h} className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" name={`hari_${h}`} defaultChecked={activeModel ? activeModel.hariAktif.includes(h) : h !== "minggu"} />{formatHari(h)}</label>)}</div></div><textarea name="hariLibur" rows={2} defaultValue={activeModel?.hariLibur.join(", ")} placeholder="YYYY-MM-DD, pisahkan dengan koma" className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13px]" /><div className="grid grid-cols-2 gap-3"><SelectField name="modeRuangan" label="Ruangan" defaultValue={activeModel?.modeRuangan ?? "opsional"}><option value="wajib">Wajib</option><option value="opsional">Opsional</option><option value="tidak_dipakai">Tidak Dipakai</option></SelectField><SelectField name="penggunaanRombel" label="Rombel" defaultValue={activeModel?.penggunaanRombel ?? "seragam"}><option value="seragam">Seragam</option><option value="per_rombel">Per Rombel</option></SelectField></div><p className="text-[11px] text-ink-400">Waktu mulai/durasi tidak diatur di sini. Time Slots adalah sumber waktu konkret.</p><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setRulesOpen(false)}>Batal</Button><Button type="submit" loading={isPending}>Simpan Rules</Button></div></form></Modal>
    </div>
  );
}

function FoundationCard({ icon, title, value, onClick }: { icon: React.ReactNode; title: string; value: string; onClick: () => void }) { return <button onClick={onClick} className="rounded-xl border border-border bg-surface p-4 text-left transition hover:border-brand-200 hover:bg-brand-50/20"><div className="flex items-center gap-2 text-brand-700">{icon}<span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{title}</span></div><p className="mt-2 truncate text-[13.5px] font-semibold text-ink-900">{value}</p></button>; }
function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) { return <button onClick={onClick} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-medium ${active ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}>{icon}{children}</button>; }
function Field({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{label}</p><p className="text-[13.5px] font-medium text-ink-900">{value}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-surface-muted/30 p-3"><p className="text-[10.5px] uppercase tracking-wide text-ink-400">{label}</p><p className="mt-1 truncate text-[13px] font-semibold text-ink-900">{value}</p></div>; }
