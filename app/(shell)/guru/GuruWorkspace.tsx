"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, Search, ChevronDown, Upload, Eye, CalendarPlus, GraduationCap } from "lucide-react";
import type { Guru, GuruDraft, JenisKelamin, StatusAktif } from "@/lib/domain/guru";
import { createGuruAction, updateGuruAction, deleteGuruAction, validateGuruImportAction, commitGuruImportAction } from "./actions";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import IconChip from "@/components/ui/IconChip";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";
import ImportModal, { type ImportRowResult } from "@/components/import/ImportModal";
import { teacherColor } from "@/lib/utils/teacherColor";

export default function GuruWorkspace({ initialData }: { initialData: Guru[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Guru[]>(initialData);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Guru | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setData(initialData), [initialData]);
  const filtered = data.filter((g) => g.namaGuru.toLowerCase().includes(query.toLowerCase()));

  // Dipicu dari Floating Action Dock (Dashboard): ?new=1 langsung buka form Tambah
  // Guru, ?import=1 langsung buka modal Impor Data — supaya aksi cepat tidak
  // butuh klik dua kali. Query param dibersihkan setelah dipakai.
  useEffect(() => {
    if (searchParams.get("new") === "1") { setEditing(null); setFormError(null); setShowMore(false); setModalOpen(true); router.replace("/guru"); }
    else if (searchParams.get("import") === "1") { setImportOpen(true); router.replace("/guru"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openCreate() { setEditing(null); setFormError(null); setShowMore(false); setModalOpen(true); }
  function openEdit(guru: Guru) { setEditing(guru); setFormError(null); setShowMore(Boolean(guru.nip || guru.nuptk || guru.email || guru.noTelepon || guru.jenisKelamin)); setModalOpen(true); }

  function handleSubmit(formData: FormData) {
    const draft: GuruDraft = {
      namaGuru: String(formData.get("namaGuru") ?? ""),
      status: (formData.get("status") as StatusAktif) ?? "aktif",
      nip: String(formData.get("nip") ?? "").trim() || undefined,
      nuptk: String(formData.get("nuptk") ?? "").trim() || undefined,
      email: String(formData.get("email") ?? "").trim() || undefined,
      noTelepon: String(formData.get("noTelepon") ?? "").trim() || undefined,
      jenisKelamin: (String(formData.get("jenisKelamin") ?? "").trim() || undefined) as JenisKelamin | undefined,
    };
    startTransition(async () => {
      const result = editing ? await updateGuruAction(editing.id, draft) : await createGuruAction(draft);
      if (!result.ok) { setFormError(result.error); return; }
      setData((prev) => editing ? prev.map((g) => (g.id === result.data!.id ? result.data! : g)) : [...prev, result.data!]);
      setModalOpen(false);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus data guru ini? Tindakan tidak bisa dibatalkan.")) return;
    startTransition(async () => { const result = await deleteGuruAction(id); if (result.ok) setData((prev) => prev.filter((g) => g.id !== id)); });
  }

  async function toggleStatus(guru: Guru) {
    const nextStatus: StatusAktif = guru.status === "aktif" ? "nonaktif" : "aktif";
    setTogglingId(guru.id);
    setData((prev) => prev.map((g) => (g.id === guru.id ? { ...g, status: nextStatus } : g))); // optimistic
    const draft: GuruDraft = { namaGuru: guru.namaGuru, status: nextStatus, nip: guru.nip, nuptk: guru.nuptk, email: guru.email, noTelepon: guru.noTelepon, jenisKelamin: guru.jenisKelamin };
    const result = await updateGuruAction(guru.id, draft);
    if (!result.ok) setData((prev) => prev.map((g) => (g.id === guru.id ? { ...g, status: guru.status } : g))); // revert kalau gagal
    setTogglingId(null);
  }

  async function handleValidateImport(rows: Record<string, string>[]): Promise<ImportRowResult[]> {
    const result = await validateGuruImportAction(rows);
    if (!result.ok) return [];
    return result.data.map((r) => ({ rowNumber: r.rowNumber, primaryLabel: r.namaGuru, secondaryLabel: r.kodeGuru || undefined, status: r.status, issues: r.issues }));
  }
  async function handleCommitImport(rows: Record<string, string>[]) {
    const result = await commitGuruImportAction(rows);
    if (!result.ok) return { imported: 0, skipped: rows.length };
    return result.data;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconChip icon={<GraduationCap size={20} strokeWidth={2.1} />} tone="brand" size="lg" shadow />
          <div><h1 className="text-[20px] font-bold text-ink-900">Guru</h1><p className="text-[13px] text-ink-500">Kelola data guru dan beban mengajar.</p></div>
        </div>
        <div className="flex items-center gap-2"><Button variant="secondary" onClick={() => setImportOpen(true)}><Upload size={16} /> Impor Data</Button><Button onClick={openCreate}><Plus size={16} /> Tambah Guru</Button></div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-ink-400 sm:max-w-xs"><Search size={16} aria-hidden="true" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari guru..." aria-label="Cari guru" className="flex-1 bg-transparent text-[13px] text-ink-900 outline-none placeholder:text-ink-400" /></div>

      <Card className="p-0">
        {filtered.length === 0 ? <EmptyState title={data.length === 0 ? "Belum ada guru" : "Guru tidak ditemukan"} description={data.length === 0 ? "Tambahkan guru untuk mulai mengatur pembagian mengajar." : "Coba nama guru yang lain."} action={data.length === 0 ? <Button size="sm" onClick={openCreate}><Plus size={14} /> Tambah Guru</Button> : undefined} /> : (
          <ul>{filtered.map((guru) => { const color = teacherColor(guru.kodeGuru || guru.id); return <li key={guru.id} style={{ borderLeft: `3px solid ${color.accent}` }} className="flex items-center gap-3.5 border-b border-border px-5 py-3.5 last:border-0 hover:bg-surface-muted/60">
            <Avatar name={guru.namaGuru} jenisKelamin={guru.jenisKelamin} kodeGuru={guru.kodeGuru} />
            <Link href={`/guru/${guru.id}`} className="min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"><p className="truncate text-[13.5px] font-medium text-ink-900">{guru.namaGuru}</p><p className="text-[12px] text-ink-400">{guru.kodeGuru}</p></Link>
            <button onClick={() => void toggleStatus(guru)} disabled={togglingId === guru.id} aria-label={`Ubah status ${guru.namaGuru} jadi ${guru.status === "aktif" ? "Tidak Aktif" : "Aktif"}`} title="Klik untuk ubah status" className="shrink-0 disabled:opacity-50">
              <Badge tone={guru.status === "aktif" ? "success" : "neutral"} className="cursor-pointer transition-opacity hover:opacity-75">{guru.status === "aktif" ? "Aktif" : "Tidak Aktif"}</Badge>
            </button>
            <div className="flex items-center gap-1">
              <button onClick={() => router.push(`/guru/${guru.id}/jadwal`)} className="group/act rounded-lg p-1.5 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40" aria-label={`Lihat jadwal ${guru.namaGuru}`} title="Lihat Jadwal"><IconChip icon={<Eye size={14} />} tone="cyan" size="sm" className="opacity-85 group-hover/act:opacity-100" /></button>
              <button onClick={() => router.push(`/jadwal?viewBy=guru&entityId=${guru.id}&autoAdd=1`)} className="group/act rounded-lg p-1.5 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40" aria-label={`Tambah jadwal ${guru.namaGuru}`} title="Tambah Jadwal"><IconChip icon={<CalendarPlus size={14} />} tone="brand" size="sm" className="opacity-85 group-hover/act:opacity-100" /></button>
              <button onClick={() => openEdit(guru)} className="group/act rounded-lg p-1.5 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40" aria-label={`Ubah data ${guru.namaGuru}`} title="Ubah Guru"><IconChip icon={<Pencil size={14} />} tone="amber" size="sm" className="opacity-85 group-hover/act:opacity-100" /></button>
              <button onClick={() => handleDelete(guru.id)} className="group/act rounded-lg p-1.5 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose/40" aria-label={`Hapus ${guru.namaGuru}`} title="Hapus Guru"><IconChip icon={<Trash2 size={14} />} tone="rose" size="sm" className="opacity-85 group-hover/act:opacity-100" /></button>
            </div>
          </li>; })}</ul>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Ubah Guru" : "Tambah Guru"}>
        <form action={handleSubmit} className="flex flex-col gap-4">
          {!editing && <p className="-mt-1 text-[12.5px] text-ink-500">Tambahkan data guru. Informasi tambahan dapat dilengkapi kapan saja.</p>}
          <Input name="namaGuru" label="Nama Lengkap *" placeholder="cth. Ahmad Fauzan" defaultValue={editing?.namaGuru} error={formError ?? undefined} required autoFocus />
          <div className="flex flex-col gap-1.5"><label className="text-[12.5px] font-medium text-ink-700">Kode Guru</label><div className="flex h-11 items-center rounded-xl border border-border bg-surface-muted px-3.5 text-[13.5px] text-ink-400">{editing ? editing.kodeGuru : "Otomatis — dibuat setelah disimpan"}</div></div>
          <div className="flex flex-col gap-1.5"><label className="text-[12.5px] font-medium text-ink-700">Status</label><select name="status" defaultValue={editing?.status ?? "aktif"} className="h-11 rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"><option value="aktif">Aktif</option><option value="nonaktif">Tidak Aktif</option></select></div>
          <div className="border-t border-border pt-3.5"><button type="button" onClick={() => setShowMore((v) => !v)} className="flex w-full items-center justify-between rounded-lg py-1 text-left text-[12.5px] font-medium text-ink-700 outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40" aria-expanded={showMore}>Informasi Tambahan<ChevronDown size={16} className={`text-ink-400 transition-transform duration-200 ${showMore ? "rotate-180" : ""}`} /> </button>
            {showMore && <div className="mt-3.5 flex flex-col gap-4"><div className="flex flex-col gap-1.5"><label className="text-[12.5px] font-medium text-ink-700">Jenis Kelamin</label><select name="jenisKelamin" defaultValue={editing?.jenisKelamin ?? ""} className="h-11 rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"><option value="">Opsional — boleh dikosongkan</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select><p className="text-[11.5px] text-ink-400">Dipakai untuk memilih varian ilustrasi avatar.</p></div><Input name="nip" label="NIP" placeholder="Opsional" defaultValue={editing?.nip} /><Input name="nuptk" label="NUPTK" placeholder="Opsional" defaultValue={editing?.nuptk} /><Input name="email" type="email" label="Email" placeholder="Opsional" defaultValue={editing?.email} /><Input name="noTelepon" label="Nomor Telepon" placeholder="Opsional" defaultValue={editing?.noTelepon} /></div>}
          </div>
          <div className="mt-2 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button><Button type="submit" loading={isPending}>{editing ? "Simpan Perubahan" : "Tambah Guru"}</Button></div>
        </form>
      </Modal>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} title="Impor Data Guru" description="Gunakan template khusus Guru SAKALA. Isi hanya kolom yang disediakan; Nama Guru adalah data wajib, sedangkan kolom lainnya mengikuti format template dan divalidasi sebelum impor." templateUrl="/guru/import/template" templateFilename="Template_Guru_SAKALA_V2.3.xlsx" onValidate={handleValidateImport} onCommit={handleCommitImport} onImported={() => router.refresh()} />
    </div>
  );
}
