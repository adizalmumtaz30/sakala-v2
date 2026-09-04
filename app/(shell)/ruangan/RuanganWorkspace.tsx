"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import type { Ruangan, StatusAktif } from "@/lib/domain/ruangan";
import { createRuanganAction, updateRuanganAction, deleteRuanganAction } from "./actions";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Card, EmptyState, StatusSwitch } from "@/components/ui/primitives";

export default function RuanganWorkspace({ initialData, initialQuery }: { initialData: Ruangan[]; initialQuery?: string }) {
  const [data, setData] = useState<Ruangan[]>(initialData);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ruangan | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: string; nama: string; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = data.filter((r) => r.nama.toLowerCase().includes(query.toLowerCase()));
  function openCreate() { setEditing(null); setFormError(null); setModalOpen(true); }
  function openEdit(item: Ruangan) { setEditing(item); setFormError(null); setModalOpen(true); }

  function handleSubmit(formData: FormData) {
    const nama = String(formData.get("nama") ?? "");
    const kapasitasRaw = String(formData.get("kapasitas") ?? "");
    const kapasitas = kapasitasRaw.trim() === "" ? null : Number(kapasitasRaw);
    const tipeRuangan = String(formData.get("tipeRuangan") ?? "");
    const status = (formData.get("status") as StatusAktif) ?? "aktif";
    startTransition(async () => {
      const result = editing ? await updateRuanganAction(editing.id, nama, kapasitas, tipeRuangan, status) : await createRuanganAction(nama, kapasitas, tipeRuangan, status);
      if (!result.ok) { setFormError(result.error); return; }
      setData((prev) => editing ? prev.map((r) => (r.id === result.data!.id ? result.data! : r)) : [...prev, result.data!]);
      setModalOpen(false);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus ruangan ini? Tindakan ini tidak dapat dibatalkan.")) return;
    setDeleteError(null);
    const item = data.find((r) => r.id === id);
    startTransition(async () => {
      const result = await deleteRuanganAction(id);
      if (result.ok) setData((prev) => prev.filter((r) => r.id !== id));
      else setDeleteError({ id, nama: item?.nama ?? "Ruangan ini", message: result.error });
    });
  }

  async function toggleStatus(r: Ruangan) {
    const nextStatus: StatusAktif = r.status === "aktif" ? "nonaktif" : "aktif";
    setTogglingId(r.id);
    setData((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: nextStatus } : x)));
    const result = await updateRuanganAction(r.id, r.nama, r.kapasitas, r.tipeRuangan ?? "", nextStatus);
    if (!result.ok) setData((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: r.status } : x)));
    setTogglingId(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-[20px] font-bold text-ink-900">Ruangan</h1><p className="text-[13px] text-ink-500">Kelola ruangan dan kapasitasnya untuk membantu menyusun jadwal.</p></div><Button onClick={openCreate}><Plus size={16} /> Tambah Ruangan</Button></div>
      {deleteError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose/30 bg-rose-50 px-4 py-3">
          <p className="text-[13px] text-rose-900"><span className="font-semibold">{deleteError.nama}</span> belum bisa dihapus — {deleteError.message}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => { const r = data.find((x) => x.id === deleteError.id); if (r) void toggleStatus(r); setDeleteError(null); }} className="rounded-lg border border-rose/40 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-rose-800 hover:bg-rose-100">Nonaktifkan saja</button>
            <button onClick={() => setDeleteError(null)} className="text-[12.5px] text-rose-700 hover:underline">Tutup</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-ink-400 sm:max-w-xs"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari ruangan..." className="flex-1 bg-transparent text-[13px] text-ink-900 outline-none placeholder:text-ink-400" /></div>
      <Card className="p-0">{filtered.length === 0 ? <EmptyState title={data.length === 0 ? "Belum ada ruangan" : "Ruangan tidak ditemukan"} description={data.length === 0 ? "Tambahkan ruangan untuk digunakan dalam jadwal." : "Coba nama ruangan yang lain."} action={data.length === 0 ? <Button size="sm" onClick={openCreate}><Plus size={14} /> Tambah Ruangan</Button> : undefined} /> : (
        <table className="w-full text-left text-[13px]"><thead><tr className="border-b border-border text-[11.5px] uppercase tracking-wide text-ink-400"><th className="px-5 py-3 font-medium">Nama Ruangan</th><th className="px-5 py-3 font-medium">Jenis</th><th className="px-5 py-3 font-medium">Kapasitas</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium text-right">Aksi</th></tr></thead><tbody>{filtered.map((r) => <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted/60"><td className="px-5 py-3.5 font-medium text-ink-900">{r.nama}</td><td className="px-5 py-3.5 text-ink-500">{r.tipeRuangan ?? "—"}</td><td className="px-5 py-3.5 text-ink-500">{r.kapasitas ?? "—"}</td><td className="px-5 py-3.5"><StatusSwitch checked={r.status === "aktif"} onToggle={() => void toggleStatus(r)} disabled={togglingId === r.id} label={`Status ${r.nama}`} /></td><td className="px-5 py-3.5"><div className="flex items-center justify-end gap-1"><button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-ink-400 hover:bg-surface hover:text-ink-900" aria-label="Ubah Ruangan" title="Ubah Ruangan"><Pencil size={15} /></button><button onClick={() => handleDelete(r.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose" aria-label="Hapus Ruangan" title="Hapus Ruangan"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>
      )}</Card>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Ubah Ruangan" : "Tambah Ruangan"}><form action={handleSubmit} className="flex flex-col gap-4"><Input name="nama" label="Nama Ruangan" placeholder="cth. Lab Komputer 1" defaultValue={editing?.nama} error={formError ?? undefined} required /><Input name="tipeRuangan" label="Jenis Ruangan (opsional)" placeholder="cth. Laboratorium" defaultValue={editing?.tipeRuangan ?? ""} /><Input name="kapasitas" type="number" min={1} label="Kapasitas (opsional)" placeholder="cth. 32" defaultValue={editing?.kapasitas ?? ""} /><div className="flex flex-col gap-1.5"><label className="text-[12.5px] font-medium text-ink-700">Status</label><select name="status" defaultValue={editing?.status ?? "aktif"} className="h-11 rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"><option value="aktif">Aktif</option><option value="nonaktif">Tidak Aktif</option></select></div><div className="mt-2 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button><Button type="submit" loading={isPending}>{editing ? "Simpan Perubahan" : "Simpan"}</Button></div></form></Modal>
    </div>
  );
}
