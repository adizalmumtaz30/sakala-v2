"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import type { MataPelajaran, StatusAktif } from "@/lib/domain/mata-pelajaran";
import {
  createMataPelajaranAction,
  updateMataPelajaranAction,
  deleteMataPelajaranAction,
} from "./actions";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";

export default function MataPelajaranWorkspace({ initialData }: { initialData: MataPelajaran[] }) {
  const [data, setData] = useState<MataPelajaran[]>(initialData);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MataPelajaran | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = data.filter(
    (m) =>
      m.nama.toLowerCase().includes(query.toLowerCase()) ||
      (m.kode ?? "").toLowerCase().includes(query.toLowerCase())
  );

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  }
  function openEdit(item: MataPelajaran) {
    setEditing(item);
    setFormError(null);
    setModalOpen(true);
  }

  function handleSubmit(formData: FormData) {
    const nama = String(formData.get("nama") ?? "");
    const kode = String(formData.get("kode") ?? "");
    const status = (formData.get("status") as StatusAktif) ?? "aktif";
    const targetRaw = String(formData.get("targetJpPerRombel") ?? "");
    const targetJpPerRombel = targetRaw.trim() === "" ? null : Number(targetRaw);

    startTransition(async () => {
      const result = editing
        ? await updateMataPelajaranAction(editing.id, nama, kode, status, targetJpPerRombel)
        : await createMataPelajaranAction(nama, kode, status, targetJpPerRombel);

      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setData((prev) =>
        editing ? prev.map((m) => (m.id === result.data!.id ? result.data! : m)) : [...prev, result.data!]
      );
      setModalOpen(false);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus mata pelajaran ini?")) return;
    startTransition(async () => {
      const result = await deleteMataPelajaranAction(id);
      if (result.ok) setData((prev) => prev.filter((m) => m.id !== id));
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-ink-900">Mata Pelajaran</h1>
          <p className="text-[13px] text-ink-500">Data induk mata pelajaran & target JP per rombel.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Tambah Mata Pelajaran
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-ink-400 sm:max-w-xs">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama atau kode..."
          className="flex-1 bg-transparent text-[13px] text-ink-900 outline-none placeholder:text-ink-400"
        />
      </div>

      <Card className="p-0">
        {filtered.length === 0 ? (
          <EmptyState
            title={data.length === 0 ? "Belum ada mata pelajaran" : "Tidak ditemukan"}
            description={data.length === 0 ? "Tambahkan mata pelajaran pertama." : "Coba kata kunci lain."}
            action={
              data.length === 0 ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus size={14} /> Tambah Mata Pelajaran
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11.5px] uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3 font-medium">Nama</th>
                <th className="px-5 py-3 font-medium">Kode</th>
                <th className="px-5 py-3 font-medium">Target JP / Rombel</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-surface-muted/60">
                  <td className="px-5 py-3.5 font-medium text-ink-900">{m.nama}</td>
                  <td className="px-5 py-3.5 text-ink-500">{m.kode ?? "—"}</td>
                  <td className="px-5 py-3.5 text-ink-500">{m.targetJpPerRombel ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <Badge tone={m.status === "aktif" ? "success" : "neutral"}>
                      {m.status === "aktif" ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(m)} className="rounded-lg p-1.5 text-ink-400 hover:bg-surface hover:text-ink-900" aria-label="Edit">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(m.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose" aria-label="Hapus">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran"}>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <Input name="nama" label="Nama Mata Pelajaran" placeholder="cth. Matematika" defaultValue={editing?.nama} error={formError ?? undefined} required />
          <Input name="kode" label="Kode (opsional)" placeholder="cth. MTK" defaultValue={editing?.kode ?? ""} />
          <Input
            name="targetJpPerRombel"
            type="number"
            min={0}
            label="Target JP per Rombel (opsional)"
            placeholder="cth. 4"
            defaultValue={editing?.targetJpPerRombel ?? ""}
          />
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
