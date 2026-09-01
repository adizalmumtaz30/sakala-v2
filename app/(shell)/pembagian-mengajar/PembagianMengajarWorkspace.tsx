"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

const emptyForm = { guruId: "", mataPelajaranId: "", kelasIds: [] as string[], jpPerMinggu: "" };
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

  // SAKALA MASTER RULE (rekomendasi solutif): kalau operator diarahkan ke sini
  // dari catatan "mapel X belum ada guru" di SAKALA AI Jadwal (?kelas=..&mapel=..),
  // langsung buka form Tambah dengan Kelas & Mata Pelajaran sudah terisi --
  // operator tinggal pilih Guru. Highlight sesaat sebagai konfirmasi visual
  // (meredup otomatis, bukan berkedip -- lebih nyaman dilihat & tidak melanggar
  // prinsip aksesibilitas soal blinking content).
  const searchParams = useSearchParams();
  const [highlightHint, setHighlightHint] = useState<{ kelasLabel: string; mapelLabel: string } | null>(null);
  useEffect(() => {
    const kelasId = searchParams.get("kelas");
    const mapelId = searchParams.get("mapel");
    if (!kelasId || !mapelId) return;
    const kelas = kelasList.find((k) => k.id === kelasId);
    const mapel = mapelList.find((m) => m.id === mapelId);
    if (!kelas || !mapel) return;
    setForm({ guruId: "", mataPelajaranId: mapelId, kelasIds: [kelasId], jpPerMinggu: "" });
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
    setHighlightHint({ kelasLabel: `${kelas.tingkat} ${kelas.namaRombel}`, mapelLabel: mapel.nama });
    const t = setTimeout(() => setHighlightHint(null), 4000);
    router.replace("/pembagian-mengajar");
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      kelasIds: [item.kelasId],
      jpPerMinggu: String(item.jpPerMinggu),
    });
    setFormError(null);
    setModalOpen(true);
  }

  function toggleKelas(kelasId: string) {
    setForm((f) => {
      // Mode edit: satu pembagian mengajar tetap terikat satu kelas — pilih ganti, bukan tambah.
      if (editing) return { ...f, kelasIds: [kelasId] };
      const already = f.kelasIds.includes(kelasId);
      return { ...f, kelasIds: already ? f.kelasIds.filter((id) => id !== kelasId) : [...f.kelasIds, kelasId] };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.guruId || !form.mataPelajaranId || form.kelasIds.length === 0) {
      setFormError("Guru, Mata Pelajaran, dan minimal satu Kelas wajib dipilih.");
      return;
    }
    const jpPerMinggu = Number(form.jpPerMinggu) || 0;

    startTransition(async () => {
      if (editing) {
        const draft: PembagianMengajarDraft = {
          academicContextId: activeContextId,
          guruId: form.guruId,
          mataPelajaranId: form.mataPelajaranId,
          kelasId: form.kelasIds[0],
          jpPerMinggu,
          status: "aktif" as StatusAktif,
        };
        const result = await updatePembagianMengajarAction(editing.id, draft);
        if (!result.ok) {
          setFormError(result.error);
          return;
        }
        router.refresh();
        setModalOpen(false);
        return;
      }

      // Create: satu guru+mapel bisa langsung dipasang ke beberapa kelas sekaligus
      // (Bagian "Pemilihan Kelas") — kirim satu draft per kelas terpilih, JP sama untuk semua.
      const failures: string[] = [];
      for (const kelasId of form.kelasIds) {
        const kelasLabel = kelasList.find((k) => k.id === kelasId);
        const draft: PembagianMengajarDraft = {
          academicContextId: activeContextId,
          guruId: form.guruId,
          mataPelajaranId: form.mataPelajaranId,
          kelasId,
          jpPerMinggu,
          status: "aktif" as StatusAktif,
        };
        const result = await createPembagianMengajarAction(draft);
        if (!result.ok) {
          failures.push(`${kelasLabel ? `${kelasLabel.tingkat} ${kelasLabel.namaRombel}` : kelasId}: ${result.error}`);
        }
      }

      router.refresh();
      if (failures.length === 0) {
        setModalOpen(false);
      } else if (failures.length === form.kelasIds.length) {
        setFormError(`Gagal untuk semua kelas — ${failures.join("; ")}`);
      } else {
        setFormError(`Sebagian berhasil. Gagal: ${failures.join("; ")}`);
        setForm((f) => ({ ...f, kelasIds: [] }));
      }
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
          {highlightHint && (
            <div className="animate-[fadeHighlight_4s_ease-out_forwards] rounded-xl border border-brand-600/30 bg-brand-50 px-3.5 py-2.5 text-[12.5px] text-brand-800">
              Diarahkan dari SAKALA AI Jadwal — kelas <b>{highlightHint.kelasLabel}</b> butuh guru untuk <b>{highlightHint.mapelLabel}</b>. Pilih gurunya di bawah.
            </div>
          )}
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

          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-medium text-ink-700">
              Kelas * {!editing && <span className="font-normal text-ink-400">(centang satu atau lebih)</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {kelasList.map((k) => {
                const checked = form.kelasIds.includes(k.id);
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => toggleKelas(k.id)}
                    className={`rounded-xl border px-3.5 py-2 text-[13.5px] font-medium transition-colors ${
                      checked
                        ? "border-brand-600 bg-brand-600/10 text-brand-700"
                        : "border-border bg-surface text-ink-700 hover:bg-surface-muted"
                    }`}
                  >
                    {k.tingkat} {k.namaRombel}
                  </button>
                );
              })}
            </div>
            {kelasList.length === 0 && <p className="text-[12px] text-ink-400">Belum ada data Kelas.</p>}
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
              className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15 sm:w-40"
            />
            {!editing && form.kelasIds.length > 1 && (
              <p className="text-[12px] text-ink-400">
                Berlaku sama untuk {form.kelasIds.length} kelas terpilih — bisa diubah satu-satu lewat Edit nanti.
              </p>
            )}
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
