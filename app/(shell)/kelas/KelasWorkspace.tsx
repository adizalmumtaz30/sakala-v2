"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import type { Kelas, Semester, StatusAktif } from "@/lib/domain/kelas";
import { createKelasAction, updateKelasAction, deleteKelasAction } from "./actions";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";

export default function KelasWorkspace({ initialData }: { initialData: Kelas[] }) {
  const [data, setData] = useState<Kelas[]>(initialData);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Kelas | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = data.filter((k) => k.namaRombel.toLowerCase().includes(query.toLowerCase()) || k.tingkat.toLowerCase().includes(query.toLowerCase()));

  function openCreate() { setEditing(null); setFormError(null); setModalOpen(true); }
  function openEdit(item: Kelas) { setEditing(item); setFormError(null); setModalOpen(true); }

  function handleSubmit(formData: FormData) {
    const tingkat = String(formData.get("tingkat") ?? "");
    const namaRombel = String(formData.get("namaRombel") ?? "");
    const status = (formData.get("status") as StatusAktif) ?? "aktif";
    const tahunAjaran = String(formData.get("tahunAjaran") ?? "");
    const semester = (formData.get("semester") as Semester) ?? "ganjil";
    startTransition(async () => {
      const result = editing ? await updateKelasAction(editing.id, tingkat, namaRombel, status, tahunAjaran, semester) : await createKelasAction(tingkat, namaRombel, status, tahunAjaran, semester);
      if (!result.ok) { setFormError(result.error); return; }
      setData((prev) => editing ? prev.map((k) => (k.id === result.data!.id ? result.data! : k)) : [...prev, result.data!]);
      setModalOpen(false);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus kelas ini? Tindakan ini tidak dapat dibatalkan.")) return;
    startTransition(async () => { const result = await deleteKelasAction(id); if (result.ok) setData((prev) => prev.filter((k) => k.id !== id)); });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-ink-900">Kelas</h1>
          <p className="text-[13px] text-ink-500">Kelola kelas untuk tahun ajaran dan semester yang aktif.</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Tambah Kelas</Button>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-ink-400 sm:max-w-xs">
        <Search size={16} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari kelas atau tingkat..." className="flex-1 bg-transparent text-[13px] text-ink-900 outline-none placeholder:text-ink-400" />
      </div>

      <Card className="p-0">
        {filtered.length === 0 ? (
          <EmptyState title={data.length === 0 ? "Belum ada kelas" : "Kelas tidak ditemukan"} description={data.length === 0 ? "Tambahkan kelas untuk mulai menyusun jadwal." : "Coba nama kelas atau tingkat yang lain."} action={data.length === 0 ? <Button size="sm" onClick={openCreate}><Plus size={14} /> Tambah Kelas</Button> : undefined} />
        ) : (
          <table className="w-full text-left text-[13px]"><thead><tr className="border-b border-border text-[11.5px] uppercase tracking-wide text-ink-400">
            <th className="px-5 py-3 font-medium">Tingkat</th><th className="px-5 py-3 font-medium">Nama Kelas</th><th className="px-5 py-3 font-medium">Tahun Ajaran</th><th className="px-5 py-3 font-medium">Semester</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium text-right">Aksi</th>
          </tr></thead><tbody>{filtered.map((k) => <tr key={k.id} className="border-b border-border last:border-0 hover:bg-surface-muted/60">
            <td className="px-5 py-3.5 font-medium text-ink-900">{k.tingkat}</td><td className="px-5 py-3.5 text-ink-700">{k.namaRombel}</td><td className="px-5 py-3.5 text-ink-500">{k.tahunAjaran}</td><td className="px-5 py-3.5 text-ink-500 capitalize">{k.semester}</td>
            <td className="px-5 py-3.5"><Badge tone={k.status === "aktif" ? "success" : "neutral"}>{k.status === "aktif" ? "Aktif" : "Tidak Aktif"}</Badge></td>
            <td className="px-5 py-3.5"><div className="flex items-center justify-end gap-1"><button onClick={() => openEdit(k)} className="rounded-lg p-1.5 text-ink-400 hover:bg-surface hover:text-ink-900" aria-label="Ubah Kelas" title="Ubah Kelas"><Pencil size={15} /></button><button onClick={() => handleDelete(k.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose" aria-label="Hapus Kelas" title="Hapus Kelas"><Trash2 size={15} /></button></div></td>
          </tr>)}</tbody></table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Ubah Kelas" : "Tambah Kelas"}>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <Input name="tingkat" label="Tingkat" placeholder="cth. VIII" defaultValue={editing?.tingkat} error={formError ?? undefined} required />
          <Input name="namaRombel" label="Nama Kelas" placeholder="cth. VIII-A" defaultValue={editing?.namaRombel} required />
          <Input name="tahunAjaran" label="Tahun Ajaran" placeholder="cth. 2025/2026" defaultValue={editing?.tahunAjaran} required />
          <div className="flex flex-col gap-1.5"><label className="text-[12.5px] font-medium text-ink-700">Semester</label><select name="semester" defaultValue={editing?.semester ?? "ganjil"} className="h-11 rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"><option value="ganjil">Ganjil</option><option value="genap">Genap</option></select></div>
          <div className="flex flex-col gap-1.5"><label className="text-[12.5px] font-medium text-ink-700">Status</label><select name="status" defaultValue={editing?.status ?? "aktif"} className="h-11 rounded-xl border border-border bg-surface px-3.5 py-2 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"><option value="aktif">Aktif</option><option value="nonaktif">Tidak Aktif</option></select></div>
          <div className="mt-2 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button><Button type="submit" loading={isPending}>{editing ? "Simpan Perubahan" : "Simpan"}</Button></div>
        </form>
      </Modal>
    </div>
  );
}
