"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Sparkles, Wand2, CheckCircle2, AlertTriangle, Info, RefreshCw, ListChecks } from "lucide-react";
import type { AcademicContext } from "@/lib/domain/academicContext";
import { formatContextLabel } from "@/lib/domain/academicContext";
import type { ScheduleModel } from "@/lib/domain/scheduleModel";
import type { Guru } from "@/lib/domain/guru";
import type { Kelas } from "@/lib/domain/kelas";
import type { MataPelajaran } from "@/lib/domain/mata-pelajaran";
import type { Ruangan } from "@/lib/domain/ruangan";
import type { ScheduleAssignment } from "@/lib/domain/scheduleAssignment";
import type { PembagianMengajar } from "@/lib/domain/pembagianMengajar";
import { formatHari, URUTAN_HARI } from "@/lib/domain/jamPelajaran";
import type { JenisSlot } from "@/lib/domain/slotTemplate";
import { formatJenisSlot } from "@/lib/domain/slotTemplate";
import type { GenerationRequirement } from "@/lib/domain/candidateGeneration";
import { CONFLICT_TYPE_LABEL, type ScheduleConflict } from "@/lib/domain/conflict";
import type { OptimizationPreview } from "@/lib/application/candidateGenerator";
import {
  generateCandidatesAction,
  saveCandidatesAction,
  listCandidatesWithConflictsAction,
  deleteAssignmentAction,
  optimizeCandidatesAction,
  applyOptimizationAction,
  commitAssignmentsAction,
} from "./actions";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";

type Tab = "generate" | "review";

interface RequirementRow {
  clientId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  roomId: string;
  activityType: JenisSlot;
  jpTarget: number;
  jpTouched: boolean;
}

interface PreviewCandidate {
  requirementId: string;
  draft: {
    academicContextId: string;
    scheduleModelId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    roomId: string | null;
    day: string;
    periodStart: number;
    periodEnd: number;
    activityType: JenisSlot;
    status: "candidate";
    source: "generated";
    versionId: null;
  };
}

let rowCounter = 0;
function nextRowId(): string {
  rowCounter += 1;
  return `row_${rowCounter}`;
}

export default function JadwalCerdasWorkspace({
  activeContext,
  scheduleModels,
  guruList,
  kelasList,
  mapelList,
  ruanganList,
  candidateAssignments,
  pembagianMengajarList,
}: {
  activeContext: AcademicContext | null;
  scheduleModels: ScheduleModel[];
  guruList: Guru[];
  kelasList: Kelas[];
  mapelList: MataPelajaran[];
  ruanganList: Ruangan[];
  candidateAssignments: ScheduleAssignment[];
  pembagianMengajarList: PembagianMengajar[];
}) {
  const [tab, setTab] = useState<Tab>("generate");
  const [isPending, startTransition] = useTransition();

  const [selectedModelId, setSelectedModelId] = useState<string>(scheduleModels[0]?.id ?? "");
  const selectedModel = scheduleModels.find((m) => m.id === selectedModelId) ?? null;

  const [rows, setRows] = useState<RequirementRow[]>([]);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    candidates: PreviewCandidate[];
    outcomes: { requirementId: string; classId: string; subjectId: string; teacherId: string; jpTarget: number; placed: number; unplaced: number }[];
  } | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [reviewRows, setReviewRows] = useState<{ assignment: ScheduleAssignment; conflicts: ScheduleConflict[] }[]>([]);
  const [reviewLoaded, setReviewLoaded] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [optimization, setOptimization] = useState<OptimizationPreview | null>(null);
  const [label, setLabel] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [commitErr, setCommitErr] = useState<string | null>(null);
  const [postCommitConflicts, setPostCommitConflicts] = useState<ScheduleConflict[]>([]);

  const guruMap = useMemo(() => new Map(guruList.map((g) => [g.id, g.namaGuru])), [guruList]);
  const kelasMap = useMemo(() => new Map(kelasList.map((k) => [k.id, `${k.tingkat} ${k.namaRombel}`])), [kelasList]);
  const mapelMap = useMemo(() => new Map(mapelList.map((m) => [m.id, m.nama])), [mapelList]);
  const ruanganMap = useMemo(() => new Map(ruanganList.map((r) => [r.id, r.nama])), [ruanganList]);

  if (!activeContext) {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <EmptyState
          title="Belum ada konteks akademik aktif"
          description="Aktifkan satu konteks akademik dulu di halaman Akademik sebelum menyusun Jadwal Cerdas."
        />
      </div>
    );
  }

  // Const terpisah (bukan sekadar pakai `activeContext` langsung) supaya TypeScript
  // menyimpan tipe non-null-nya secara stabil ke dalam closure (runGenerate,
  // loadReview, dst di bawah) — narrowing dari early-return di atas tidak
  // otomatis menembus closure yang dideklarasikan setelahnya.
  const context = activeContext;

  function addRow(prefill?: Partial<RequirementRow>) {
    setRows((prev) => [
      ...prev,
      {
        clientId: nextRowId(),
        classId: "",
        subjectId: "",
        teacherId: "",
        roomId: "",
        activityType: "belajar_mengajar",
        jpTarget: 1,
        jpTouched: false,
        ...prefill,
      },
    ]);
  }

  /**
   * Bagian 73: quick-add dari Pembagian Mengajar — prefill kelas/mapel/guru
   * otomatis, jpTarget dipakai dari JP TERSISA (bukan JP total), supaya tidak
   * generate ulang porsi yang sudah dijadwalkan. jpTouched: true supaya tidak
   * ketimpa efek pre-fill targetJpPerRombel Mata Pelajaran di updateRow().
   */
  function addRowFromPembagianMengajar(item: PembagianMengajar) {
    const jpTersisa = item.jpTersisa ?? item.jpPerMinggu;
    addRow({
      classId: item.kelasId,
      subjectId: item.mataPelajaranId,
      teacherId: item.guruId,
      jpTarget: Math.max(jpTersisa, 1),
      jpTouched: true,
    });
  }

  function updateRow(clientId: string, patch: Partial<RequirementRow>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.clientId !== clientId) return r;
        const merged = { ...r, ...patch };
        // Pre-fill jpTarget dari targetJpPerRombel Mata Pelajaran kalau user belum pernah ubah manual.
        if (patch.subjectId !== undefined && !r.jpTouched) {
          const mapel = mapelList.find((m) => m.id === patch.subjectId);
          if (mapel?.targetJpPerRombel != null) merged.jpTarget = mapel.targetJpPerRombel;
        }
        return merged;
      })
    );
  }

  function removeRow(clientId: string) {
    setRows((prev) => prev.filter((r) => r.clientId !== clientId));
  }

  function runGenerate() {
    setGenerateError(null);
    setSaveMessage(null);
    if (!selectedModel) {
      setGenerateError("Pilih Schedule Model dulu.");
      return;
    }
    if (rows.length === 0) {
      setGenerateError("Tambahkan minimal satu baris kebutuhan (kelas + mapel + guru + target JP).");
      return;
    }
    const requirements: GenerationRequirement[] = rows.map((r) => ({
      id: r.clientId,
      classId: r.classId,
      subjectId: r.subjectId,
      teacherId: r.teacherId,
      roomId: r.roomId || null,
      activityType: r.activityType,
      jpTarget: r.jpTarget,
    }));
    startTransition(async () => {
      const result = await generateCandidatesAction(context.id, selectedModel.id, requirements);
      if (!result.ok) {
        setGenerateError(result.error);
        setPreview(null);
        return;
      }
      setPreview({
        candidates: result.data.candidates as unknown as PreviewCandidate[],
        outcomes: result.data.outcomes,
      });
    });
  }

  function saveCandidates() {
    if (!preview) return;
    setSaveMessage(null);
    startTransition(async () => {
      const drafts = preview.candidates.map((c) => c.draft);
      const result = await saveCandidatesAction(drafts as never);
      if (!result.ok) {
        setGenerateError(result.error);
        return;
      }
      setSaveMessage(
        `${result.data.savedCount} assignment disimpan sebagai candidate.` +
          (result.data.skippedCount > 0 ? ` ${result.data.skippedCount} dilewati karena bentrok — cek Tab Review.` : "")
      );
      setPreview(null);
      setRows([]);
      loadReview();
      setTab("review");
    });
  }

  function loadReview() {
    setReviewError(null);
    startTransition(async () => {
      const result = await listCandidatesWithConflictsAction(context.id);
      if (!result.ok) {
        setReviewError(result.error);
        return;
      }
      setReviewRows(result.data);
      setReviewLoaded(true);
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function removeCandidate(id: string) {
    startTransition(async () => {
      const result = await deleteAssignmentAction(id);
      if (result.ok) {
        setReviewRows((prev) => prev.filter((r) => r.assignment.id !== id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }

  function runOptimize() {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : reviewRows.map((r) => r.assignment.id);
    if (ids.length === 0) return;
    const modelId = reviewRows[0]?.assignment.scheduleModelId ?? selectedModelId;
    setOptimization(null);
    startTransition(async () => {
      const result = await optimizeCandidatesAction(context.id, modelId, ids);
      if (result.ok) setOptimization(result.data);
      else setReviewError(result.error);
    });
  }

  function applyOpt() {
    if (!optimization) return;
    startTransition(async () => {
      const result = await applyOptimizationAction(optimization.changes);
      if (result.ok) {
        setOptimization(null);
        loadReview();
      }
    });
  }

  function runCommit() {
    setCommitErr(null);
    setCommitMessage(null);
    setPostCommitConflicts([]);
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setCommitErr("Pilih minimal satu candidate untuk di-commit.");
      return;
    }
    if (label.trim().length < 2) {
      setCommitErr("Isi label version minimal 2 karakter.");
      return;
    }
    startTransition(async () => {
      const result = await commitAssignmentsAction(context.id, ids, label.trim(), changeSummary.trim() || null);
      if (!result.ok) {
        setCommitErr(result.error);
        return;
      }
      setCommitMessage(`Berhasil commit — Schedule Version baru dibuat (${result.data.versionId}).`);
      // Blocking conflict sudah dicegah di lapisan usecases (batch dibatalkan
      // seluruhnya kalau ada) — sisa di sini murni non-blocking (mis.
      // JP_MISMATCH Bagian 22.5), ditampilkan sebagai info pasca-commit,
      // bukan untuk mencegah apa pun.
      setPostCommitConflicts(Object.values(result.data.conflictsByAssignment).flat());
      setSelectedIds(new Set());
      setLabel("");
      setChangeSummary("");
      loadReview();
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-16 pt-6">
      <div>
        <h1 className="text-[20px] font-semibold text-ink-900">Jadwal Cerdas</h1>
        <p className="text-[13px] text-ink-500">
          Konteks aktif: <strong>{formatContextLabel(activeContext)}</strong> — generate, tinjau, dan commit candidate jadwal.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border">
        <TabButton active={tab === "generate"} onClick={() => setTab("generate")} icon={<Sparkles size={14} />}>
          Generate
        </TabButton>
        <TabButton
          active={tab === "review"}
          onClick={() => {
            setTab("review");
            if (!reviewLoaded) loadReview();
          }}
          icon={<Wand2 size={14} />}
        >
          Review &amp; Commit {candidateAssignments.length > 0 && `(${candidateAssignments.length})`}
        </TabButton>
      </div>

      {tab === "generate" && (
        <div className="space-y-5">
          {scheduleModels.length === 0 ? (
            <Card>
              <EmptyState
                title="Belum ada Schedule Model"
                description="Buat Schedule Model dulu di halaman Akademik → tab Model Jadwal sebelum menyusun Jadwal Cerdas."
              />
            </Card>
          ) : (
            <>
              <Card className="space-y-3">
                <p className="text-[13px] font-semibold text-ink-900">1. Pilih Scope</p>
                <div className="max-w-sm">
                  <label className="mb-1.5 block text-[12.5px] font-medium text-ink-700">Schedule Model</label>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15"
                  >
                    {scheduleModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.namaModel}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedModel && (
                  <p className="text-[12px] text-ink-500">
                    Hari aktif: {selectedModel.hariAktif.map(formatHari).join(", ")} · Room mode: {selectedModel.modeRuangan}
                  </p>
                )}
              </Card>

              <Card className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-ink-900">2. Pilih dari Pembagian Mengajar (opsional)</p>
                    <p className="text-[12px] text-ink-500">
                      Cara paling aman — otomatis mengisi Kelas + Mapel + Guru + sisa JP, mengurangi salah pilih (Bagian 73).
                    </p>
                  </div>
                </div>

                {pembagianMengajarList.length === 0 ? (
                  <p className="py-3 text-center text-[12.5px] text-ink-400">
                    Belum ada Pembagian Mengajar aktif. Kelola di menu Data → Pembagian Mengajar, atau lewati dan isi baris manual di bawah.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {pembagianMengajarList.map((item) => {
                      const jpTersisa = item.jpTersisa ?? item.jpPerMinggu;
                      const habis = jpTersisa <= 0;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border px-3.5 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink-900">{item.guruNama ?? "—"}</p>
                            <p className="truncate text-[12px] text-ink-400">
                              {item.mataPelajaranNama ?? "—"} · {item.kelasLabel ?? "—"}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge tone={habis ? "neutral" : "info"}>{jpTersisa} JP tersisa</Badge>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={habis}
                              onClick={() => addRowFromPembagianMengajar(item)}
                            >
                              <ListChecks size={13} /> Pakai
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-ink-900">3. Load Constraints (kebutuhan penempatan)</p>
                  <Button variant="secondary" size="sm" onClick={() => addRow()}>
                    <Plus size={14} /> Tambah Baris Manual
                  </Button>
                </div>

                {rows.length === 0 ? (
                  <p className="py-4 text-center text-[12.5px] text-ink-400">
                    Belum ada baris. Tambahkan kombinasi kelas + mapel + guru + target JP yang perlu digenerate.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {rows.map((row) => (
                      <div key={row.clientId} className="grid grid-cols-12 items-end gap-2 rounded-xl border border-border p-3">
                        <div className="col-span-2">
                          <label className="mb-1 block text-[11px] font-medium text-ink-500">Kelas</label>
                          <select
                            value={row.classId}
                            onChange={(e) => updateRow(row.clientId, { classId: e.target.value })}
                            className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-[12.5px] outline-none focus:border-brand-600/50"
                          >
                            <option value="">Pilih</option>
                            {kelasList.map((k) => (
                              <option key={k.id} value={k.id}>
                                {k.tingkat} {k.namaRombel}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="mb-1 block text-[11px] font-medium text-ink-500">Mapel</label>
                          <select
                            value={row.subjectId}
                            onChange={(e) => updateRow(row.clientId, { subjectId: e.target.value })}
                            className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-[12.5px] outline-none focus:border-brand-600/50"
                          >
                            <option value="">Pilih</option>
                            {mapelList.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.nama}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="mb-1 block text-[11px] font-medium text-ink-500">Guru</label>
                          <select
                            value={row.teacherId}
                            onChange={(e) => updateRow(row.clientId, { teacherId: e.target.value })}
                            className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-[12.5px] outline-none focus:border-brand-600/50"
                          >
                            <option value="">Pilih</option>
                            {guruList.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.namaGuru}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="mb-1 block text-[11px] font-medium text-ink-500">Ruangan</label>
                          <select
                            value={row.roomId}
                            onChange={(e) => updateRow(row.clientId, { roomId: e.target.value })}
                            className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-[12.5px] outline-none focus:border-brand-600/50"
                          >
                            <option value="">(Tanpa ruangan)</option>
                            {ruanganList.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.nama}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="mb-1 block text-[11px] font-medium text-ink-500">Aktivitas</label>
                          <select
                            value={row.activityType}
                            onChange={(e) => updateRow(row.clientId, { activityType: e.target.value as JenisSlot })}
                            className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-[12.5px] outline-none focus:border-brand-600/50"
                          >
                            <option value="belajar_mengajar">Belajar Mengajar</option>
                            <option value="upacara">Upacara</option>
                            <option value="religi">Religi</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                        <div className="col-span-1">
                          <label className="mb-1 block text-[11px] font-medium text-ink-500">Target JP</label>
                          <input
                            type="number"
                            min={1}
                            max={40}
                            value={row.jpTarget}
                            onChange={(e) => updateRow(row.clientId, { jpTarget: Number(e.target.value), jpTouched: true })}
                            className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-[12.5px] outline-none focus:border-brand-600/50"
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button
                            onClick={() => removeRow(row.clientId)}
                            className="rounded-lg p-2 text-ink-400 hover:bg-surface-muted hover:text-rose"
                            aria-label="Hapus baris"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {generateError && (
                  <p className="flex items-center gap-1.5 text-[12.5px] text-rose">
                    <AlertTriangle size={13} /> {generateError}
                  </p>
                )}

                <div className="flex justify-end">
                  <Button onClick={runGenerate} loading={isPending}>
                    <Sparkles size={14} /> Generate Candidate
                  </Button>
                </div>
              </Card>

              {preview && (
                <Card className="space-y-3">
                  <p className="text-[13px] font-semibold text-ink-900">4. Hasil Generate (preview, belum tersimpan)</p>
                  <div className="space-y-2">
                    {preview.outcomes.map((o) => (
                      <div key={o.requirementId} className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2 text-[12.5px]">
                        <span>
                          {kelasMap.get(o.classId) ?? "?"} · {mapelMap.get(o.subjectId) ?? "?"} · {guruMap.get(o.teacherId) ?? "?"}
                        </span>
                        <span className="flex items-center gap-2">
                          <Badge tone={o.unplaced === 0 ? "success" : "warning"}>
                            {o.placed}/{o.jpTarget} JP ditempatkan
                          </Badge>
                          {o.unplaced > 0 && (
                            <span className="flex items-center gap-1 text-amber">
                              <Info size={12} /> {o.unplaced} JP tidak dapat slot (semua penuh/bentrok)
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  {saveMessage && (
                    <p className="flex items-center gap-1.5 text-[12.5px] text-emerald">
                      <CheckCircle2 size={13} /> {saveMessage}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <Button onClick={saveCandidates} loading={isPending} disabled={preview.candidates.length === 0}>
                      Simpan sebagai Candidate ({preview.candidates.length} slot)
                    </Button>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {tab === "review" && (
        <div className="space-y-5">
          {reviewError && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-rose">
              <AlertTriangle size={13} /> {reviewError}
            </p>
          )}

          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-ink-900">Candidate Review</p>
              <Button variant="secondary" size="sm" onClick={loadReview} loading={isPending}>
                <RefreshCw size={13} /> Muat ulang
              </Button>
            </div>

            {reviewRows.length === 0 ? (
              <EmptyState title="Belum ada candidate" description="Generate dulu di Tab Generate, lalu simpan hasilnya sebagai candidate." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-border text-left text-ink-500">
                      <th className="w-8 py-2"></th>
                      <th className="py-2">Hari</th>
                      <th className="py-2">Periode</th>
                      <th className="py-2">Kelas</th>
                      <th className="py-2">Mapel</th>
                      <th className="py-2">Guru</th>
                      <th className="py-2">Ruangan</th>
                      <th className="py-2">Conflict</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {URUTAN_HARI.filter((d) => reviewRows.some((r) => r.assignment.day === d))
                      .flatMap((d) => reviewRows.filter((r) => r.assignment.day === d))
                      .map(({ assignment, conflicts }) => {
                        const blocking = conflicts.filter((c) => c.blocking);
                        const warnings = conflicts.filter((c) => !c.blocking);
                        return (
                          <tr key={assignment.id} className="border-b border-border/60">
                            <td className="py-2">
                              <input type="checkbox" checked={selectedIds.has(assignment.id)} onChange={() => toggleSelect(assignment.id)} />
                            </td>
                            <td className="py-2">{formatHari(assignment.day)}</td>
                            <td className="py-2">
                              {assignment.periodStart === assignment.periodEnd ? assignment.periodStart : `${assignment.periodStart}-${assignment.periodEnd}`}
                            </td>
                            <td className="py-2">{kelasMap.get(assignment.classId) ?? "?"}</td>
                            <td className="py-2">{mapelMap.get(assignment.subjectId) ?? "?"}</td>
                            <td className="py-2">{guruMap.get(assignment.teacherId) ?? "?"}</td>
                            <td className="py-2">{assignment.roomId ? ruanganMap.get(assignment.roomId) ?? "?" : "—"}</td>
                            <td className="py-2">
                              {blocking.length === 0 && warnings.length === 0 ? (
                                <Badge tone="success">Bersih</Badge>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  {blocking.map((c) => (
                                    <Badge key={c.conflictId} tone="danger" title={c.message}>
                                      {CONFLICT_TYPE_LABEL[c.type] ?? c.type}
                                    </Badge>
                                  ))}
                                  {warnings.map((c) => (
                                    <Badge key={c.conflictId} tone="warning" title={c.message}>
                                      {CONFLICT_TYPE_LABEL[c.type] ?? c.type}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => removeCandidate(assignment.id)}
                                className="rounded-lg p-1.5 text-ink-400 hover:bg-surface-muted hover:text-rose"
                                aria-label="Hapus"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {reviewRows.length > 0 && (
            <Card className="space-y-3">
              <p className="text-[13px] font-semibold text-ink-900">Optimasi (opsional)</p>
              <p className="text-[12px] text-ink-500">
                Mencoba memindahkan candidate yang bentrok (blocking conflict) ke slot lain yang bebas. Assignment yang sudah bersih tidak diubah.
              </p>
              <div className="flex justify-end">
                <Button variant="secondary" onClick={runOptimize} loading={isPending}>
                  <Wand2 size={14} /> Jalankan Optimasi{selectedIds.size > 0 ? ` (${selectedIds.size} terpilih)` : " (semua candidate)"}
                </Button>
              </div>

              {optimization && (
                <div className="space-y-3 rounded-xl border border-border p-4">
                  <div className="flex items-center gap-4 text-[13px]">
                    <span>
                      Sebelum: <strong className="text-rose">{optimization.beforeConflictCount}</strong> blocking conflict
                    </span>
                    <span>→</span>
                    <span>
                      Sesudah: <strong className={optimization.afterConflictCount === 0 ? "text-emerald" : "text-amber"}>{optimization.afterConflictCount}</strong> blocking conflict
                    </span>
                  </div>
                  <div className="space-y-1">
                    {optimization.changes.length === 0 ? (
                      <p className="text-[12.5px] text-ink-500">Tidak ada perubahan yang diusulkan.</p>
                    ) : (
                      optimization.changes.map((c) => (
                        <p key={c.assignmentId} className="text-[12px] text-ink-700">
                          {formatHari(c.from.day)} periode {c.from.periodStart}
                          {" → "}
                          {c.to ? `${formatHari(c.to.day)} periode ${c.to.periodStart}` : <span className="text-rose">tidak ditemukan slot bebas</span>}
                        </p>
                      ))
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setOptimization(null)}>
                      Keep Current
                    </Button>
                    <Button size="sm" onClick={applyOpt} loading={isPending} disabled={optimization.changes.every((c) => !c.to)}>
                      Apply Optimization
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {reviewRows.length > 0 && (
            <Card className="space-y-3">
              <p className="text-[13px] font-semibold text-ink-900">Final Validation &amp; Commit</p>
              <p className="text-[12px] text-ink-500">
                Hanya candidate terpilih ({selectedIds.size}) yang akan di-commit. Blocking conflict apa pun pada salah satu yang dipilih akan membatalkan
                seluruh batch (tidak ada commit sebagian).
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Label Version" placeholder="mis. Semester Ganjil 2025/2026 — v1" value={label} onChange={(e) => setLabel(e.target.value)} />
                <Input label="Change Summary (opsional)" value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} />
              </div>
              {commitErr && (
                <p className="flex items-center gap-1.5 text-[12.5px] text-rose">
                  <AlertTriangle size={13} /> {commitErr}
                </p>
              )}
              {commitMessage && (
                <p className="flex items-center gap-1.5 text-[12.5px] text-emerald">
                  <CheckCircle2 size={13} /> {commitMessage}
                </p>
              )}
              {postCommitConflicts.length > 0 && (
                <div className="space-y-1.5 rounded-lg border border-border/60 bg-surface-muted/50 p-2.5">
                  <p className="text-[12px] font-medium text-ink-700">Catatan non-blocking pasca-commit:</p>
                  {postCommitConflicts.map((c) => (
                    <p key={c.conflictId} className="flex items-start gap-1.5 text-[12px] text-ink-500">
                      <Badge tone={c.severity === "warning" ? "warning" : "info"}>{CONFLICT_TYPE_LABEL[c.type] ?? c.type}</Badge>
                      <span>{c.message}</span>
                    </p>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={runCommit} loading={isPending}>
                  Commit {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
        active ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-900"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
