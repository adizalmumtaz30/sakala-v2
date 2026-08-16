"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, Search, Upload, Target } from "lucide-react";
import type { Guru } from "@/lib/domain/guru";
import type { MataPelajaran } from "@/lib/domain/mata-pelajaran";
import type { Kelas } from "@/lib/domain/kelas";
import type { PembagianMengajar, PembagianMengajarDraft, StatusAktif } from "@/lib/domain/pembagianMengajar";
import { summarizeJp } from "@/lib/domain/pembagianMengajar";
import {
  createPembagianMengajarAction,
  updatePembagianMengajarAction,
  deletePembagianMengajarAction,
  toggleStatusPembagianMengajarAction,
  validatePembagianMengajarImportAction,
  commitPembagianMengajarImportAction,
} from "./actions";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";
import ImportModal, { type ImportRowResult } from "@/components/import/ImportModal";

interface Props {
  activeContextId: string;
  activeContextLabel: string;
  initialData: PembagianMengajar[];
  guruList: Guru[];
  mapelList: MataPelajaran[];
  kelasList: Kelas[];
}

const emptyForm = { guruId: "", mataPelajaranId: "", kelasId: "", jpPerMinggu: "" };
type FormState = typeof emptyForm;

export default function PembagianMengajarWorkspace({
  activeContextId,
  activeContextLabel,
  initialData,
  guruList,
  mapelList,
  kelasList,
}: Props) {
  const router = useRouter();
  const [data, setData] = useState<PembagianMengajar[]>(initialData);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<PembagianMengajar | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setData(initialData), [initialData]);

  const filtered = data.filter((item) => {
    const haystack = `${item.guruNama ?? ""} ${item.mataPelajaranNama ?? ""} ${item.kelasLabel ?? ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(item: PembagianMengajar) {
    setEditing(item);
    setForm({
      guruId: item.guruId,
      mataPelajaranId: item.mataPelajaranId,
      kelasId: item.kelasId,
      jpPerMinggu: String(item.jpPerMinggu),
    });
    setFormError(null);
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.guruId || !form.mataPelajaranId || !form.kelasId) {
      setFormError("Guru, Mata Pelajaran, dan Kelas wajib dipilih.");
      return;
    }
    const draft: PembagianMengajarDraft = {
      academicContextId: activeContextId,
      guruId: form.guruId,
      mataPelajaranId: form.mataPelajaranId,
      kelasId: form.kelasId,
      jpPerMinggu: Number(form.jpPerMinggu) || 0,
      status: "aktif" as StatusAktif,
    };

    startTransition(async () => {
      const result = editing
        ? await updatePembagianMengajarAction(editing.id, draft)
        : await createPembagianMengajarAction(draft);

      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      router.refresh();
      setModalOpen(false);
    });
  }

  function handleToggleStatus(item: PembagianMengajar) {
    startTransition(async () => {
      const result = await toggleStatusPembagianMengajarAction(item);
      if (result.ok) router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus pembagian mengajar ini?")) return;
    startTransition(async () => {
      const result = await deletePembagianMengajarAction(id);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setData((prev) => prev.filter((p) => p.id !== id));
    });
  }

  async function handleValidateImport(rows: Record<string, string>[]): Promise<ImportRowResult[]> {
    const result = await validatePembagianMengajarImportAction(rows, activeContextId);
    if (!result.ok) return [];
    return result.data.map((r) => ({
      rowNumber: r.rowNumber,
      primaryLabel: `${r.guruLabel} · ${r.mapelLabel}`,
      secondaryLabel: r.kelasLabel,
      status: r.status,
      issues: r.issues,
    }));
  }

  async function handleCommitImport(rows: Record<string, string>[]) {
    const result = await commitPembagianMengajarImportAction(rows, activeContextId);
    if (!result.ok) return { imported: 0, skipped: rows.length };
    return result.data;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-ink-900">Pembagian Mengajar</h1>
          <p className="text-[13px] text-ink-500">
            Guru + Mata Pelajaran + Kelas + JP — konteks aktif: <span className="font-medium text-ink-700">{activeContextLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/pembagian-mengajar/target-jp"
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface-muted"
          >
            <Target size={15} /> Target JP
          </Link>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload size={16} /> Import
          </Button>
          <Button onClick={openCreate}>
            <Plus size={16} /> Tambah
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-ink-400 sm:max-w-xs">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari guru, mapel, atau kelas..."
          className="flex-1 bg-transparent text-[13px] text-ink-900 outline-none placeholder:text-ink-400"
        />
      </div>

      <Card className="p-0">
        {filtered.length === 0 ? (
          <EmptyState
            title={data.length === 0 ? "Belum ada pembagian mengajar" : "Tidak ditemukan"}
            description={
              data.length === 0
                ? "Hubungkan Guru, Mata Pelajaran, dan Kelas supaya siap dipakai di Tambah Jadwal."
                : "Coba kata kunci lain."
            }
            action={
              data.length === 0 ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus size={14} /> Tambah
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul>
            {filtered.map((item) => {
              const { status: jpStatus } = summarizeJp(item.jpPerMinggu, item.jpTerjadwal ?? 0);
              const jpTone =
                jpStatus === "penuh" ? "success" : jpStatus === "lebih" ? "danger" : jpStatus === "sebagian" ? "warning" : "neutral";
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-3.5 border-b border-border px-5 py-3.5 last:border-0 hover:bg-surface-muted/60"
                >
                  <Avatar name={item.guruNama ?? "?"} size="sm" />
                  <div className="min-w-[160px] flex-1">
                    <p className="text-[13.5px] font-medium text-ink-900">{item.guruNama ?? "—"}</p>
                    <div className="flex items-center gap-1.5 text-[12px] text-ink-400">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: item.mataPelajaranWarna ?? "#C6CAD3" }}
                        aria-hidden="true"
                      />
                      {item.mataPelajaranNama ?? "—"} · {item.kelasLabel ?? "—"}
                    </div>
                  </div>
                  <Badge tone={jpTone}>
                    {item.jpTerjadwal ?? 0} / {item.jpPerMinggu} JP
                  </Badge>
                  <button onClick={() => handleToggleStatus(item)} disabled={isPending}>
                    <Badge tone={item.status === "aktif" ? "success" : "neutral"}>
                      {item.status === "aktif" ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(item)}
                      className="rounded-lg p-1.5 text-ink-400 hover:bg-surface hover:text-ink-900"
                      aria-label="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose"
                      aria-label="Hapus"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Pembagian Mengajar" : "Tambah Pembagian Mengajar"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && <p className="text-[12.5px] text-rose">{formError}</p>}

          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-medium text-ink-700">Guru *</label>
            <select
              value={form.guruId}
              onChange={(e) => setForm((f) => ({ ...f, guruId: e.target.value }))}
              required
              className="h-11 rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"
            >
              <option value="">Pilih guru...</option>
              {guruList.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.namaGuru} ({g.kodeGuru})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-medium text-ink-700">Mata Pelajaran *</label>
            <select
              value={form.mataPelajaranId}
              onChange={(e) => setForm((f) => ({ ...f, mataPelajaranId: e.target.value }))}
              required
              className="h-11 rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"
            >
              <option value="">Pilih mata pelajaran...</option>
              {mapelList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nama}
                  {m.kode ? ` (${m.kode})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-ink-700">Kelas *</label>
              <select
                value={form.kelasId}
                onChange={(e) => setForm((f) => ({ ...f, kelasId: e.target.value }))}
                required
                className="h-11 rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"
              >
                <option value="">Pilih kelas...</option>
                {kelasList.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.tingkat} {k.namaRombel}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-ink-700">JP / Minggu *</label>
              <input
                type="number"
                min={1}
                required
                value={form.jpPerMinggu}
                onChange={(e) => setForm((f) => ({ ...f, jpPerMinggu: e.target.value }))}
                placeholder="cth. 4"
                className="h-11 rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"
              />
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" loading={isPending}>
              {editing ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </div>
        </form>
      </Modal>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Pembagian Mengajar"
        description="Unggah file berisi kolom Guru, Mapel, Kelas, JPPerMinggu — SAKALA otomatis mencocokkan nama/kode ke data yang sudah ada."
        templateUrl="/pembagian-mengajar/import/template"
        templateFilename="Template_PembagianMengajar_SAKALA_V2.3.xlsx"
        onValidate={handleValidateImport}
        onCommit={handleCommitImport}
        onImported={() => router.refresh()}
      />
    </div>
  );
}
