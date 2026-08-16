"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import type { Ruangan, StatusAktif } from "@/lib/domain/ruangan";
import { createRuanganAction, updateRuanganAction, deleteRuanganAction } from "./actions";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";

export default function RuanganWorkspace({ initialData }: { initialData: Ruangan[] }) {
  const [data, setData] = useState<Ruangan[]>(initialData);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ruangan | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = data.filter((r) => r.nama.toLowerCase().includes(query.toLowerCase()));

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  }
  function openEdit(item: Ruangan) {
    setEditing(item);
    setFormError(null);
    setModalOpen(true);
  }

  function handleSubmit(formData: FormData) {
    const nama = String(formData.get("nama") ?? "");
    const kapasitasRaw = String(formData.get("kapasitas") ?? "");
    const kapasitas = kapasitasRaw.trim() === "" ? null : Number(kapasitasRaw);
    const tipeRuangan = String(formData.get("tipeRuangan") ?? "");
    const status = (formData.get("status") as StatusAktif) ?? "aktif";

    startTransition(async () => {
      const result = editing
        ? await updateRuanganAction(editing.id, nama, kapasitas, tipeRuangan, status)
        : await createRuanganAction(nama, kapasitas, tipeRuangan, status);

      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setData((prev) =>
        editing ? prev.map((r) => (r.id === result.data!.id ? result.data! : r)) : [...prev, result.data!]
      );
      setModalOpen(false);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus ruangan ini?")) return;
    startTransition(async () => {
      const result = await deleteRuanganAction(id);
      if (result.ok) setData((prev) => prev.filter((r) => r.id !== id));
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-ink-900">Ruangan</h1>
          <p className="text-[13px] text-ink-500">Data induk ruangan & kapasitas untuk penjadwalan.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Tambah Ruangan
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-ink-400 sm:max-w-xs">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama ruangan..."
          className="flex-1 bg-transparent text-[13px] text-ink-900 outline-none placeholder:text-ink-400"
        />
      </div>

      <Card className="p-0">
        {filtered.length === 0 ? (
          <EmptyState
            title={data.length === 0 ? "Belum ada data ruangan" : "Tidak ditemukan"}
            description={data.length === 0 ? "Tambahkan ruangan pertama." : "Coba kata kunci lain."}
            action={
              data.length === 0 ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus size={14} /> Tambah Ruangan
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11.5px] uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3 font-medium">Nama</th>
                <th className="px-5 py-3 font-medium">Tipe</th>
                <th className="px-5 py-3 font-medium">Kapasitas</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted/60">
                  <td className="px-5 py-3.5 font-medium text-ink-900">{r.nama}</td>
                  <td className="px-5 py-3.5 text-ink-500">{r.tipeRuangan ?? "—"}</td>
                  <td className="px-5 py-3.5 text-ink-500">{r.kapasitas ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <Badge tone={r.status === "aktif" ? "success" : "neutral"}>
                      {r.status === "aktif" ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-ink-400 hover:bg-surface hover:text-ink-900" aria-label="Edit">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose" aria-label="Hapus">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Ruangan" : "Tambah Ruangan"}>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <Input name="nama" label="Nama Ruangan" placeholder="cth. Lab Komputer 1" defaultValue={editing?.nama} error={formError ?? undefined} required />
          <Input name="tipeRuangan" label="Tipe Ruangan (opsional)" placeholder="cth. Laboratorium" defaultValue={editing?.tipeRuangan ?? ""} />
          <Input name="kapasitas" type="number" min={1} label="Kapasitas (opsional)" placeholder="cth. 32" defaultValue={editing?.kapasitas ?? ""} />
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-medium text-ink-700">Status</label>
            <select
              name="status"
              defaultValue={editing?.status ?? "aktif"}
              className="h-11 rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"
            >
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button type="submit" loading={isPending}>{editing ? "Simpan Perubahan" : "Tambah"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
