"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search, Upload, Check } from "lucide-react";
import type {
  MataPelajaran,
  MataPelajaranDraft,
  StatusAktif,
  PrioritasPenjadwalan,
  JenisMapel,
} from "@/lib/domain/mata-pelajaran";
import {
  PRIORITAS_OPTIONS,
  PRIORITAS_LABEL,
  JENIS_MAPEL_OPTIONS,
  JENIS_MAPEL_LABEL,
  WARNA_JADWAL_PRESET,
} from "@/lib/domain/mata-pelajaran";
import {
  createMataPelajaranAction,
  updateMataPelajaranAction,
  deleteMataPelajaranAction,
  validateMapelImportAction,
  commitMapelImportAction,
} from "./actions";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";
import ImportModal, { type ImportRowResult } from "@/components/import/ImportModal";

const emptyForm = {
  nama: "",
  kode: "",
  status: "aktif" as StatusAktif,
  targetJpPerRombel: "",
  kelompok: "",
  warnaJadwal: WARNA_JADWAL_PRESET[0],
  prioritasPenjadwalan: "normal" as PrioritasPenjadwalan,
  jenisMapel: "akademik" as JenisMapel,
};

type FormState = typeof emptyForm;

export default function MataPelajaranWorkspace({ initialData }: { initialData: MataPelajaran[] }) {
  const router = useRouter();
  const [data, setData] = useState<MataPelajaran[]>(initialData);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<MataPelajaran | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setData(initialData), [initialData]);

  const filtered = data.filter(
    (m) =>
      m.nama.toLowerCase().includes(query.toLowerCase()) ||
      (m.kode ?? "").toLowerCase().includes(query.toLowerCase())
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(item: MataPelajaran) {
    setEditing(item);
    setForm({
      nama: item.nama,
      kode: item.kode ?? "",
      status: item.status,
      targetJpPerRombel: item.targetJpPerRombel != null ? String(item.targetJpPerRombel) : "",
      kelompok: item.kelompok ?? "",
      warnaJadwal: item.warnaJadwal ?? WARNA_JADWAL_PRESET[0],
      prioritasPenjadwalan: item.prioritasPenjadwalan ?? "normal",
      jenisMapel: item.jenisMapel ?? "akademik",
    });
    setFormError(null);
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const draft: MataPelajaranDraft = {
      nama: form.nama,
      kode: form.kode,
      status: form.status,
      targetJpPerRombel: form.targetJpPerRombel.trim() === "" ? null : Number(form.targetJpPerRombel),
      kelompok: form.kelompok.trim() || undefined,
      warnaJadwal: form.warnaJadwal || undefined,
      prioritasPenjadwalan: form.prioritasPenjadwalan,
      jenisMapel: form.jenisMapel,
    };

    startTransition(async () => {
      const result = editing
        ? await updateMataPelajaranAction(editing.id, draft)
        : await createMataPelajaranAction(draft);

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

  async function handleValidateImport(rows: Record<string, string>[]): Promise<ImportRowResult[]> {
    const result = await validateMapelImportAction(rows);
    if (!result.ok) return [];
    return result.data.map((r) => ({
      rowNumber: r.rowNumber,
      primaryLabel: r.nama,
      secondaryLabel: r.kode || undefined,
      status: r.status,
      issues: r.issues,
    }));
  }

  async function handleCommitImport(rows: Record<string, string>[]) {
    const result = await commitMapelImportAction(rows);
    if (!result.ok) return { imported: 0, skipped: rows.length };
    return result.data;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-ink-900">Mata Pelajaran</h1>
          <p className="text-[13px] text-ink-500">Kelola mata pelajaran yang digunakan dalam struktur akademik SAKALA.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload size={16} /> Import
          </Button>
          <Button onClick={openCreate}>
            <Plus size={16} /> Tambah Mata Pelajaran
          </Button>
        </div>
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
                <th className="px-5 py-3 font-medium">Mata Pelajaran</th>
                <th className="px-5 py-3 font-medium">Kelompok</th>
                <th className="px-5 py-3 font-medium">JP / Minggu</th>
                <th className="px-5 py-3 font-medium">Prioritas</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-surface-muted/60">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: m.warnaJadwal ?? "#C6CAD3" }}
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-medium text-ink-900">{m.nama}</p>
                        <p className="text-[12px] text-ink-400">{m.kode ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-ink-500">{m.kelompok ?? "—"}</td>
                  <td className="px-5 py-3.5 text-ink-500">{m.targetJpPerRombel ?? "—"}</td>
                  <td className="px-5 py-3.5 text-ink-500">
                    {m.prioritasPenjadwalan ? PRIORITAS_LABEL[m.prioritasPenjadwalan] : "—"}
                  </td>
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_240px]">
          <div className="flex flex-col gap-4">
            <Input
              label="Nama Mata Pelajaran *"
              placeholder="cth. Matematika"
              value={form.nama}
              onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
              error={formError ?? undefined}
              required
              autoFocus
            />
            <Input
              label="Kode Mapel (opsional)"
              placeholder="cth. MAT"
              value={form.kode}
              onChange={(e) => setForm((f) => ({ ...f, kode: e.target.value }))}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-medium text-ink-700">Kelompok</label>
                <input
                  value={form.kelompok}
                  onChange={(e) => setForm((f) => ({ ...f, kelompok: e.target.value }))}
                  placeholder="cth. Umum"
                  className="h-11 rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"
                />
              </div>
              <Input
                label="JP / Minggu"
                type="number"
                min={0}
                placeholder="cth. 4"
                value={form.targetJpPerRombel}
                onChange={(e) => setForm((f) => ({ ...f, targetJpPerRombel: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-ink-700">Warna Jadwal</label>
              <div className="flex flex-wrap gap-2">
                {WARNA_JADWAL_PRESET.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, warnaJadwal: hex }))}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-shadow ${
                      form.warnaJadwal === hex
                        ? "ring-2 ring-ink-900 ring-offset-2 ring-offset-surface"
                        : "hover:opacity-80"
                    }`}
                    style={{ backgroundColor: hex }}
                    aria-label={`Pilih warna ${hex}`}
                  >
                    {form.warnaJadwal === hex && <Check size={14} className="text-white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-medium text-ink-700">Prioritas Penjadwalan</label>
                <select
                  value={form.prioritasPenjadwalan}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, prioritasPenjadwalan: e.target.value as PrioritasPenjadwalan }))
                  }
                  className="h-11 rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"
                >
                  {PRIORITAS_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITAS_LABEL[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-medium text-ink-700">Jenis Mapel</label>
                <select
                  value={form.jenisMapel}
                  onChange={(e) => setForm((f) => ({ ...f, jenisMapel: e.target.value as JenisMapel }))}
                  className="h-11 rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"
                >
                  {JENIS_MAPEL_OPTIONS.map((j) => (
                    <option key={j} value={j}>
                      {JENIS_MAPEL_LABEL[j]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-ink-700">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as StatusAktif }))}
                className="h-11 rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"
              >
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" loading={isPending}>
                {editing ? "Simpan Perubahan" : "Simpan"}
              </Button>
            </div>
          </div>

          {/* Live preview (Bagian 30, 87) — update langsung mengikuti state form, tanpa submit. */}
          <div className="flex flex-col items-center gap-3 rounded-xl2 border border-border bg-surface-muted p-5">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: form.warnaJadwal || "#C6CAD3" }}
              aria-hidden="true"
            />
            <p className="text-center text-[15px] font-semibold text-ink-900">{form.nama || "Nama Mapel"}</p>
            <p className="text-[12px] text-ink-400">{form.kode || "—"}</p>
            <p className="text-[12.5px] text-ink-500">
              {form.targetJpPerRombel ? `${form.targetJpPerRombel} JP / Minggu` : "— JP / Minggu"}
            </p>
            <Badge tone={form.status === "aktif" ? "success" : "neutral"}>
              {form.status === "aktif" ? "Aktif" : "Nonaktif"}
            </Badge>
            {form.kelompok && <Badge tone="info">{form.kelompok}</Badge>}
          </div>
        </form>
      </Modal>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Mata Pelajaran"
        description="Unggah data mata pelajaran dari file XLSX/CSV memakai Template SAKALA."
        templateUrl="/mata-pelajaran/import/template"
        templateFilename="Template_Mapel_SAKALA_V2.3.xlsx"
        onValidate={handleValidateImport}
        onCommit={handleCommitImport}
        onImported={() => router.refresh()}
      />
    </div>
  );
}
