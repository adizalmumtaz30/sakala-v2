"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ChevronRight, Link2, RefreshCw, Save, Search, ShieldCheck, Sparkles, UploadCloud, X } from "lucide-react";
import { adoptCurriculumItemsAction, listCurriculumIntelligenceAction, getCurriculumDraftAction, saveCurriculumDraftAction, clearCurriculumDraftAction, recordCurriculumGenerateEventAction, getPreviouslyAdoptedSubjectsAction, deleteCurriculumSourceAction, extractCurriculumPdfAction, saveExtractedCurriculumSourceAction, promoteCurriculumSourceToOfficialAction, type ExtractedCurriculumRow } from "../mata-pelajaran/curriculum-actions";

export const dynamic = "force-dynamic";

type Source = { id: string; institution: string; name: string; official_url: string; status: string };
type Version = { id: string; source_id: string; curriculum_name: string; regulation_number: string | null; regulation_year: number | null; regulation_title: string | null; effective_status: string; document_url: string | null; verification_status: string };

function institutionLabel(raw: string): string {
  if (raw === "kementerian_agama") return "Kemenag";
  if (raw === "kemendikdasmen") return "Kemendikdasmen";
  return raw;
}
type Item = { id: string; curriculum_version_id: string; subject_name: string; class_level: string; allocation_unit: string | null; official_allocation: number | null; weekly_target: number | null; derivation_status: string; extraction_status: string };
type Context = { id: string; tahun_pelajaran: string; semester: string; jenjang: string; institution: string; is_active: boolean };
type Kelas = { id: string; tingkat: string; nama_rombel: string };
type Candidate = Item & { manualTarget: number | null };
type StatusFilter = "all" | "new" | "changed" | "unchanged" | "review";

export default function GenerateKurikulumPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [versionId, setVersionId] = useState("");
  const [level, setLevel] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [candidate, setCandidate] = useState<Candidate[]>([]);
  const [baseline, setBaseline] = useState<Record<string, number | null>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [updateOpen, setUpdateOpen] = useState(false);
  const [sourceDrawer, setSourceDrawer] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [updateMode, setUpdateMode] = useState<"previous" | "new">("previous");
  const [sourceUrl, setSourceUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [updateReady, setUpdateReady] = useState(false);
  const [message, setMessage] = useState("");
  // V4 poin 35 — Error State: kartu terpisah dengan tombol "Coba lagi",
  // bukan paragraf abu-abu generik. Dipakai untuk kegagalan real (load data
  // gagal, commit gagal) — bukan info/status biasa yang tetap pakai `message`.
  const [errorMessage, setErrorMessage] = useState("");
  const [errorRetry, setErrorRetry] = useState<"load" | "commit" | null>(null);
  const [busy, setBusy] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [syncStep, setSyncStep] = useState(0);
  const [compareOpen, setCompareOpen] = useState(false);
  const [newSubjectsToConfirm, setNewSubjectsToConfirm] = useState<string[] | null>(null);
  const [success, setSuccess] = useState(false);
  // V4 poin 3 — Status Konteks: "↻ Konteks berubah" dideteksi dari sinyal
  // nyata (localStorage tahun/semester terakhir dibuka di halaman ini),
  // bukan status buatan.
  const [contextChangeNotice, setContextChangeNotice] = useState<{ from: string; to: string } | null>(null);
  // V4 poin 31 — Data Tidak Ditemukan: mata pelajaran yang pernah di-Commit
  // untuk konteks ini tapi hilang dari hasil Generate terbaru.
  const [previousSubjects, setPreviousSubjects] = useState<{ subjectName: string; classLevel: string }[]>([]);
  // V4 poin 20 — Bulk Edit: panel input inline, bukan window.prompt().
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkValue, setBulkValue] = useState("");
  // V4 poin 17-19 — Target JP inline-edit-on-click + Detail drawer per mapel.
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  // V4 poin 24 — real-time validation: nilai draft diperbarui tiap ketikan
  // (bukan cuma saat blur/Enter), supaya "✓ Target diterima"/"⚠ Melebihi
  // alokasi" langsung berubah saat operator mengetik, bukan menunggu commit.
  const [editingDraftValue, setEditingDraftValue] = useState<string>("");
  const [totalJpDetailOpen, setTotalJpDetailOpen] = useState(false);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  // V4 poin 9 — Source Library search + filter.
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceInstitutionFilter, setSourceInstitutionFilter] = useState("");
  const [sourceYearFilter, setSourceYearFilter] = useState<number | "">("");
  // V4 poin 10 — Duplicate Source Detection: konfirmasi eksplisit kalau
  // sourceUrl yang diketik cocok persis dengan official_url sumber yang
  // sudah tersimpan.
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  // Laporan user #2 — tombol hapus sumber (lama & baru).
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [confirmDeleteSourceId, setConfirmDeleteSourceId] = useState<string | null>(null);
  // Laporan user #3 (PDF, versi gratis tanpa API berbayar) — ekstraksi
  // heuristik pdf-parse. Selalu masuk sebagai tier-2/unverified; baru bisa
  // dipakai Commit setelah admin eksplisit menekan "Tandai Resmi".
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [pdfFileName, setPdfFileName] = useState("");
  const [extractedRows, setExtractedRows] = useState<ExtractedCurriculumRow[]>([]);
  const [extractError, setExtractError] = useState("");
  const [extractClassLevel, setExtractClassLevel] = useState("");
  const [extractInstitution, setExtractInstitution] = useState<"Kemenag" | "Kemendikdasmen">("Kemenag");
  const [savingExtracted, setSavingExtracted] = useState(false);
  const [promotingSourceId, setPromotingSourceId] = useState<string | null>(null);

  const activeContext = contexts.find((x) => x.is_active) ?? null;
  const verifiedVersions = useMemo(() => versions.filter((v) => v.verification_status === "verified"), [versions]);
  // Library "Sumber sebelumnya" tampilkan SEMUA versi (termasuk hasil import
  // PDF yang belum ditinjau) — supaya operator bisa melihat & menandainya
  // resmi. verifiedVersions (di atas) tetap dipakai khusus untuk auto-pilih
  // & Generate, supaya yang belum ditinjau tidak diam-diam ikut ke-generate.
  const libraryVersions = versions;
  const activeVersion = versions.find((x) => x.id === versionId) ?? null;
  const activeSource = sources.find((x) => x.id === activeVersion?.source_id) ?? null;
  // V4 poin 9 — filter Source Library dari data institusi/tahun yang benar-benar ada.
  const distinctInstitutions = useMemo(() => Array.from(new Set(sources.map((s) => s.institution).filter(Boolean))), [sources]);
  const distinctYears = useMemo(() => Array.from(new Set(libraryVersions.map((v) => v.regulation_year).filter((y): y is number => y != null))).sort((a, b) => b - a), [libraryVersions]);
  const filteredVersions = libraryVersions.filter((v) => {
    const inst = sources.find((s) => s.id === v.source_id)?.institution ?? "";
    const matchesSearch = v.curriculum_name.toLowerCase().includes(sourceSearch.toLowerCase());
    const matchesInstitution = !sourceInstitutionFilter || inst === sourceInstitutionFilter;
    const matchesYear = sourceYearFilter === "" || v.regulation_year === sourceYearFilter;
    return matchesSearch && matchesInstitution && matchesYear;
  });
  // V4 poin 10 — cocok persis dengan official_url sumber yang sudah tersimpan.
  const duplicateSource = sourceUrl.trim() ? sources.find((s) => s.official_url && s.official_url.trim().toLowerCase() === sourceUrl.trim().toLowerCase()) ?? null : null;
  const levels = useMemo(() => Array.from(new Set(items.filter((i) => i.curriculum_version_id === versionId).map((i) => i.class_level))), [items, versionId]);
  const validItems = items.filter((i) => i.curriculum_version_id === versionId && (!level || i.class_level === level) && i.extraction_status === "verified" && i.derivation_status !== "blocked");
  const eligibleClasses = classes.filter((c) => !level || c.tingkat === level);

  const changedIds = candidate.filter((x) => x.manualTarget !== baseline[x.id]).map((x) => x.id);
  const newIds = candidate.filter((x) => baseline[x.id] === undefined).map((x) => x.id);
  const changedOnlyIds = changedIds.filter((id) => !newIds.includes(id));
  const unchangedCount = candidate.length - changedIds.length;
  // V4 poin 31 — subjek yang pernah di-Commit tapi tidak muncul di candidate saat ini.
  const missingSubjects = candidate.length > 0 ? previousSubjects.filter((p) => !candidate.some((c) => c.subject_name === p.subjectName && c.class_level === p.classLevel)) : [];
  const reviewIds = candidate.filter((x) => x.manualTarget == null || !Number.isInteger(x.manualTarget) || x.manualTarget < 0).map((x) => x.id);
  const totalTarget = candidate.reduce((sum, x) => sum + (x.manualTarget ?? 0), 0);
  const officialTotal = candidate.reduce((sum, x) => sum + (x.official_allocation ?? 0), 0);
  const visibleCandidate = candidate.filter((x) => {
    const matchesSearch = x.subject_name.toLowerCase().includes(query.toLowerCase());
    const changed = changedOnlyIds.includes(x.id);
    const isNew = newIds.includes(x.id);
    const needsReview = reviewIds.includes(x.id);
    return matchesSearch && (filter === "all" || (filter === "changed" && changed) || (filter === "new" && isNew) || (filter === "unchanged" && !changedIds.includes(x.id)) || (filter === "review" && needsReview));
  });

  const validation = useMemo(() => {
    if (!activeContext) return { status: "blocked", text: "Konteks akademik belum siap." } as const;
    if (!activeVersion || activeVersion.verification_status !== "verified") return { status: "blocked", text: "Pilih kurikulum dengan sumber yang sudah terverifikasi." } as const;
    if (!classIds.length) return { status: "warning", text: "Menyiapkan kelas dari konteks aktif…" } as const;
    if (!candidate.length) return { status: "warning", text: "Konteks siap · Kurikulum siap · Sumber siap" } as const;
    if (reviewIds.length) return { status: "warning", text: `${reviewIds.length} data perlu ditinjau.` } as const;
    return { status: "valid", text: "Konteks siap · Kurikulum siap · Sumber siap" } as const;
  }, [activeContext, activeVersion, classIds.length, candidate.length, reviewIds.length]);

  // V4 poin 3 — bandingkan konteks aktif saat ini dengan yang terakhir kali
  // dibuka di halaman ini (localStorage, per browser). Kalau beda, tampilkan
  // notice "↻ Konteks berubah" alih-alih diam-diam memakai konteks baru.
  useEffect(() => {
    if (!activeContext) return;
    const signature = `${activeContext.tahun_pelajaran}::${activeContext.semester}`;
    const key = "sakala:generate-kurikulum:last-context";
    const previous = window.localStorage.getItem(key);
    if (previous && previous !== signature) {
      const [fromTahun] = previous.split("::");
      setContextChangeNotice({ from: fromTahun, to: activeContext.tahun_pelajaran });
    }
    window.localStorage.setItem(key, signature);
  }, [activeContext?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const draftHydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(() => {
    let mounted = true;
    void (async () => {
      setBusy(true); setErrorMessage(""); setErrorRetry(null);
      const result = await listCurriculumIntelligenceAction("all");
      if (!mounted) return;
      let loadedVersions: Version[] = [];
      if (result.ok) {
        setSources(result.data.sources as Source[]);
        loadedVersions = result.data.versions as Version[];
        setVersions(loadedVersions);
        setItems(result.data.items as Item[]);
      } else { setBusy(false); setErrorMessage(result.error); setErrorRetry("load"); return; }
      try {
        const response = await fetch("/api/target-jp/import?mode=data", { cache: "no-store" });
        if (!response.ok) throw new Error("Data context belum dapat dibaca.");
        const data = await response.json();
        if (!mounted) return;
        const loadedContexts: Context[] = Array.isArray(data.contexts) ? data.contexts : [];
        setContexts(loadedContexts);
        setClasses(Array.isArray(data.classes) ? data.classes : []);

        // GENERATE-KURIKULUM-MASTER-UX-FLOW poin 11 (Persistence) — muat draft
        // tersimpan (kalau ada) sebelum fallback ke auto-pilih versi/kelas,
        // supaya progress sebelumnya tidak tertimpa.
        const activeCtx = loadedContexts.find((c) => c.is_active) ?? null;
        let restoredFromDraft = false;
        if (activeCtx) {
          const draftResult = await getCurriculumDraftAction(activeCtx.id);
          if (mounted && draftResult.ok && draftResult.data) {
            const draft = draftResult.data;
            if (draft.curriculumVersionId) setVersionId(draft.curriculumVersionId);
            if (draft.level) setLevel(draft.level);
            if (draft.classIds.length) setClassIds(draft.classIds);
            if (draft.candidate.length) {
              const itemMap = new Map((result.ok ? (result.data.items as Item[]) : []).map((i) => [i.id, i]));
              const restored: Candidate[] = draft.candidate
                .map((c) => { const item = itemMap.get(c.itemId); return item ? { ...item, manualTarget: c.manualTarget } : null; })
                .filter((x): x is Candidate => x !== null);
              if (restored.length) { setCandidate(restored); setBaseline(draft.baseline); restoredFromDraft = true; }
            }
          }
        }
        if (!restoredFromDraft) {
          const verified = loadedVersions.filter((v) => v.verification_status === "verified");
          if (verified.length === 1) setVersionId(verified[0].id);
        }
        // V4 poin 31 (Data Tidak Ditemukan) — muat daftar mapel yang pernah
        // di-Commit untuk konteks ini, dipakai untuk deteksi "hilang" setelah
        // Generate berikutnya.
        if (activeCtx) {
          const prevResult = await getPreviouslyAdoptedSubjectsAction(activeCtx.id);
          if (mounted && prevResult.ok) setPreviousSubjects(prevResult.data);
        }
      } catch (error) {
        if (mounted) { setErrorMessage(error instanceof Error ? error.message : "Data context belum dapat dibaca."); setErrorRetry("load"); }
      } finally {
        if (mounted) { setBusy(false); draftHydrated.current = true; }
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => loadAll(), [loadAll]);

  // Operator-first handoff: once the canonical context and curriculum are loaded,
  // SAKALA prepares the applicable classes automatically. Manual controls remain
  // available for exceptions, but they are no longer a prerequisite to Generate.
  useEffect(() => {
    if (busy || !activeContext || classIds.length) return;
    if (classes.length) setClassIds(classes.map((c) => c.id));
  }, [busy, activeContext, classes, classIds.length]);

  // GENERATE-KURIKULUM-MASTER-UX-FLOW poin 11 (Persistence) — simpan draft
  // (debounced) tiap kali sumber/parameter/candidate berubah, supaya progress
  // tidak hilang saat operator pindah halaman lalu balik lagi. Tidak menulis
  // draft kosong, dan menunggu hydration awal selesai supaya tidak menimpa
  // draft yang baru saja dimuat dengan state kosong sesaat.
  useEffect(() => {
    if (!draftHydrated.current || !activeContext) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!versionId && candidate.length === 0 && classIds.length === 0) return;
    saveTimer.current = setTimeout(() => {
      void saveCurriculumDraftAction({
        academicContextId: activeContext.id,
        curriculumVersionId: versionId || null,
        level,
        classIds,
        candidate: candidate.map((c) => ({ itemId: c.id, manualTarget: c.manualTarget })),
        baseline,
      });
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [activeContext, versionId, level, classIds, candidate, baseline]);

  function toggleClass(id: string) { setClassIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]); }
  function openUpdate(mode: "previous" | "new") { setUpdateMode(mode); setUpdateReady(false); setMessage(""); setUpdateOpen(true); setSourceSearch(""); setSourceInstitutionFilter(""); setSourceYearFilter(""); setDuplicateAcknowledged(false); }
  function chooseVersion(id: string) { setVersionId(id); setLevel(""); setCandidate([]); setBaseline({}); setSelectedIds([]); setUpdateReady(false); }
  function toggleSelected(id: string) { setSelectedIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]); }
  function updateTarget(id: string, value: string) { setCandidate((current) => current.map((item) => item.id === id ? { ...item, manualTarget: value === "" ? null : Number(value) } : item)); }
  function restoreTarget(id: string) { setCandidate((current) => current.map((item) => item.id === id ? { ...item, manualTarget: baseline[id] ?? item.weekly_target } : item)); }
  function applyBulkTarget() {
    const next = Number(bulkValue);
    if (bulkValue.trim() === "" || !Number.isInteger(next) || next < 0) return;
    setCandidate((current) => current.map((item) => selectedIds.includes(item.id) ? { ...item, manualTarget: next } : item));
    setSelectedIds([]); setBulkEditing(false); setBulkValue("");
  }

  async function handleDeleteSource(sourceId: string) {
    setDeletingSourceId(sourceId);
    const result = await deleteCurriculumSourceAction(sourceId);
    setDeletingSourceId(null);
    setConfirmDeleteSourceId(null);
    if (!result.ok) { setErrorMessage(result.error); setErrorRetry(null); return; }
    setSources((current) => current.filter((s) => s.id !== sourceId));
    setVersions((current) => current.filter((v) => v.source_id !== sourceId));
    if (activeVersion?.source_id === sourceId) { setVersionId(""); setCandidate([]); setBaseline({}); }
  }

  function useStoredSource() {
    if (!duplicateSource) return;
    const matchingVersion = versions.find((v) => v.source_id === duplicateSource.id && v.verification_status === "verified");
    if (matchingVersion) chooseVersion(matchingVersion.id);
    setUpdateMode("previous"); setSourceUrl(""); setFileName(""); setDuplicateAcknowledged(false); setMessage("Menggunakan sumber yang sudah tersimpan.");
  }

  async function applyUpdateSelection() {
    setUpdating(true); setMessage(""); setUpdateReady(false);
    await new Promise((resolve) => setTimeout(resolve, 350));
    if (updateMode === "previous") {
      if (!versionId) { setMessage("Pilih sumber sebelumnya terlebih dahulu."); setUpdating(false); return; }
      setUpdateReady(true); setMessage("Sumber sebelumnya siap digunakan. Data resmi belum diubah.");
    } else if (!sourceUrl.trim() && !fileName) {
      setMessage("Masukkan link atau pilih file terlebih dahulu.");
    } else if (duplicateSource && !duplicateAcknowledged) {
      setMessage("Sumber serupa ditemukan. Pilih salah satu opsi di bawah.");
    } else {
      setUpdateReady(true); setMessage("Sumber baru siap ditinjau. Import sumber baru belum menimpa data resmi.");
    }
    setUpdating(false);
  }

  function generateCandidate() {
    if (!activeVersion || activeVersion.verification_status !== "verified" || !classIds.length) return;
    setProgress(1);
    const steps = [1, 2, 3, 4, 5];
    let index = 0;
    const timer = window.setInterval(() => {
      setProgress(steps[index]);
      index += 1;
      if (index >= steps.length) {
        window.clearInterval(timer);
        const next = validItems.map((item) => ({ ...item, manualTarget: item.weekly_target }));
        setCandidate(next);
        setBaseline(Object.fromEntries(next.map((item) => [item.id, item.weekly_target])));
        setSelectedIds([]); setFilter("all"); setQuery("");
        setMessage(next.length ? "Kurikulum siap ditinjau." : "Belum ada item valid untuk dibuat.");
        // GENERATE-KURIKULUM-MASTER-UX-FLOW poin 17 (Audit Trail) — catat kapan
        // Candidate dibuat, meski ini belum mengubah data resmi (Generate ≠ Commit).
        if (next.length && activeContext) {
          void recordCurriculumGenerateEventAction({ academicContextId: activeContext.id, curriculumVersionName: activeVersion.curriculum_name, itemCount: next.length, classCount: classIds.length });
        }
      }
    }, 180);
  }

  function buildSituationNarrative(): string {
    const parts: string[] = [];
    if (unchangedCount > 0) parts.push(`${unchangedCount} mata pelajaran tetap sama seperti sebelumnya`);
    if (changedOnlyIds.length > 0) {
      const names = candidate.filter((c) => changedOnlyIds.includes(c.id)).slice(0, 3).map((c) => c.subject_name);
      const extra = changedOnlyIds.length > 3 ? ` dan ${changedOnlyIds.length - 3} lainnya` : "";
      parts.push(`${changedOnlyIds.length} mata pelajaran JP-nya berubah dari sebelumnya (${names.join(", ")}${extra})`);
    }
    if (newIds.length > 0) {
      const names = candidate.filter((c) => newIds.includes(c.id)).slice(0, 3).map((c) => c.subject_name);
      const extra = newIds.length > 3 ? ` dan ${newIds.length - 3} lainnya` : "";
      parts.push(`${newIds.length} mata pelajaran baru ditemukan yang sebelumnya belum tercatat (${names.join(", ")}${extra})`);
    }
    if (missingSubjects.length > 0) parts.push(`${missingSubjects.length} mata pelajaran sebelumnya tidak muncul lagi di hasil ini`);
    if (parts.length === 0) return "Belum ada data untuk ditinjau.";
    return parts.join(". ") + ".";
  }

  function targetNote(item: Candidate): { text: string; tone: "ok" | "warn" } {
    if (item.manualTarget == null || !Number.isInteger(item.manualTarget) || item.manualTarget < 0) return { text: "⚠ Perlu ditinjau", tone: "warn" };
    if (item.official_allocation != null && item.manualTarget > item.official_allocation) return { text: "⚠ Melebihi alokasi resmi", tone: "warn" };
    return { text: "✓ Target diterima", tone: "ok" };
  }

  // V4 poin 24 — versi real-time targetNote: dievaluasi dari draft yang sedang
  // diketik (bisa string kosong/parsial saat operator masih mengetik), bukan
  // menunggu commit ke candidate. Baris lain tetap pakai targetNote(item) biasa.
  function targetNoteFromDraft(item: Candidate, draft: string): { text: string; tone: "ok" | "warn" } {
    if (draft.trim() === "") return { text: "⚠ Perlu ditinjau", tone: "warn" };
    const value = Number(draft);
    if (!Number.isInteger(value) || value < 0) return { text: "⚠ Perlu ditinjau", tone: "warn" };
    if (item.official_allocation != null && value > item.official_allocation) return { text: "⚠ Melebihi alokasi resmi", tone: "warn" };
    return { text: "✓ Target diterima", tone: "ok" };
  }

  function beginEditTarget(item: Candidate) {
    setEditingTargetId(item.id);
    setEditingDraftValue(item.manualTarget != null ? String(item.manualTarget) : "");
  }

  async function commitCandidate(confirmedNewSubjects?: string[]) {
    if (validation.status !== "valid" || !activeContext) return;
    setCompareOpen(false); setCommitting(true); setMessage("Menyinkronkan…");
    // V4 poin 32 — step progress ringan, bukan cuma spinner. Step 1-2 mewakili
    // proses lokal sebelum request terkirim; step 3 menyalakan begitu respons
    // server diterima, jadi tetap jujur (tidak menampilkan "selesai" sebelum
    // datanya benar-benar tersimpan).
    setSyncStep(1);
    await new Promise((resolve) => setTimeout(resolve, 200));
    setSyncStep(2);
    const result = await adoptCurriculumItemsAction({
      academicContextId: activeContext.id,
      classIds,
      items: candidate.map((item) => ({ id: item.id, weeklyTarget: item.manualTarget })),
      confirmedNewSubjects,
    });
    if (!result.ok && "needsConfirmation" in result && result.needsConfirmation) {
      // CANDIDATE-before-COMMIT untuk Master Data: belum menulis apa pun.
      // Tampilkan daftar mata pelajaran baru, minta konfirmasi eksplisit
      // sebelum submit ulang dengan confirmedNewSubjects terisi.
      setCommitting(false); setSyncStep(0); setMessage("");
      setNewSubjectsToConfirm(result.newSubjects);
      return;
    }
    if (result.ok) {
      setSyncStep(3);
      setSuccess(true); setMessage(`Kurikulum tersimpan: ${result.data.adopted} kombinasi.`);
      // Draft sudah "terpakai" — hapus supaya sesi berikutnya mulai bersih,
      // bukan merehidrasi candidate yang sudah di-commit.
      void clearCurriculumDraftAction(activeContext.id);
    }
    else if (!("needsConfirmation" in result)) { setMessage(""); setErrorMessage(result.error); setErrorRetry("commit"); }
    setCommitting(false); setSyncStep(0);
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setUpdateReady(false); setExtractError(""); setExtractedRows([]); setPdfFileName(file.name);
    if (file.type !== "application/pdf") { setExtractError("Hanya file PDF yang didukung."); return; }
    setPdfExtracting(true);
    const formData = new FormData(); formData.append("file", file);
    const result = await extractCurriculumPdfAction(formData);
    setPdfExtracting(false);
    if (!result.ok) { setExtractError(result.error); return; }
    if (!result.data.rows.length) { setExtractError("Tidak ada baris \"mata pelajaran · JP\" yang terdeteksi. Coba PDF lain atau masukkan manual lewat Link."); return; }
    setExtractedRows(result.data.rows);
  }

  function removeExtractedRow(subjectName: string) {
    setExtractedRows((current) => current.filter((r) => r.subjectName !== subjectName));
  }

  async function confirmExtractedSource() {
    if (!extractedRows.length || !extractClassLevel) return;
    setSavingExtracted(true);
    const result = await saveExtractedCurriculumSourceAction({ fileName: pdfFileName, institution: extractInstitution, classLevel: extractClassLevel, rows: extractedRows });
    setSavingExtracted(false);
    if (!result.ok) { setExtractError(result.error); return; }
    setExtractedRows([]); setFileName(""); setPdfFileName(""); setExtractClassLevel("");
    setMessage(`Sumber baru tersimpan (${extractedRows.length} mata pelajaran) — status "Perlu ditinjau". Tekan "Tandai Resmi" pada sumber ini di daftar Sumber Sebelumnya setelah dicek manual, baru bisa dipakai untuk Commit.`);
    setUpdateMode("previous");
    void loadAll();
  }

  async function handlePromoteSource(sourceId: string) {
    setPromotingSourceId(sourceId);
    const result = await promoteCurriculumSourceToOfficialAction(sourceId);
    setPromotingSourceId(null);
    if (!result.ok) { setErrorMessage(result.error); setErrorRetry(null); return; }
    setMessage("Sumber ditandai resmi — sekarang bisa dipakai untuk Generate dan Commit.");
    void loadAll();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/akademik/mata-pelajaran" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft className="h-4 w-4" /> Kembali</Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-900">Generate Kurikulum</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-600">Siapkan sumber, generate, tinjau perubahan, lalu sinkronkan ke konteks akademik aktif.</p>
        </div>
        <button type="button" onClick={() => openUpdate("previous")} className="inline-flex items-center gap-2 rounded-xl border border-brand-600 bg-surface px-5 py-3 text-sm font-bold text-brand-700 shadow-soft hover:bg-brand-50" aria-haspopup="dialog"><RefreshCw className="h-4 w-4" /> Update</button>
      </header>

      {/* V4 poin 14 — setelah Generate (Review Mode), Konteks Aktif + Kurikulum
          menyusut jadi satu baris ringkas, bukan dua section penuh seperti
          Setup Mode. */}
      {candidate.length > 0 ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-muted px-4 py-3">
          <p className="text-sm font-semibold text-ink-700">{activeContext ? `${activeContext.jenjang} · ${activeContext.institution} · ${activeContext.tahun_pelajaran} · ${activeContext.semester}` : "Konteks akademik belum siap"} · {activeVersion?.curriculum_name ?? "Belum dipilih"}</p>
          <button type="button" onClick={() => { setCandidate([]); setBaseline({}); }} className="text-xs font-semibold text-brand-700 hover:underline">Kembali ke Setup</button>
        </section>
      ) : <>
      <section className="relative rounded-2xl border border-brand-600/30 bg-brand-50 p-4">
        <button type="button" onClick={() => setContextOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={contextOpen}>
          <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">Konteks Aktif</p><p className="mt-1 font-bold text-brand-700">{activeContext ? `${activeContext.jenjang} · ${activeContext.institution} · ${activeContext.tahun_pelajaran} · ${activeContext.semester}` : "Konteks akademik belum siap"}</p></div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${contextChangeNotice ? "bg-violet-50 text-violet" : activeContext ? "bg-emerald-50 text-emerald" : "bg-amber-50 text-amber"}`}>{contextChangeNotice ? "↻ Konteks berubah" : activeContext ? "✓ Konteks siap" : "⚠ Belum lengkap"}</span>
        </button>
        {contextOpen && <><div className="fixed inset-0 z-20" onClick={() => setContextOpen(false)} /><div className="absolute right-4 top-full z-30 mt-2 w-80 max-w-[calc(100%-2rem)] rounded-xl border border-border bg-surface p-4 shadow-lg"><p className="font-bold text-ink-900">Konteks Akademik</p><div className="mt-3 grid gap-2 text-sm"><span>Jenjang — {activeContext?.jenjang ?? "—"}</span><span>Kementerian — {activeContext?.institution ?? "—"}</span><span>Tahun — {activeContext?.tahun_pelajaran ?? "—"}</span><span>Semester — {activeContext?.semester ?? "—"}</span></div><Link href="/akademik" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Buka Konteks Akademik <ChevronRight className="h-4 w-4" /></Link></div></>}
        {contextChangeNotice && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet/30 bg-surface px-3.5 py-2.5 text-sm"><span className="text-ink-700">Tahun Pelajaran <b>{contextChangeNotice.from}</b> → <b>{contextChangeNotice.to}</b> sejak terakhir dibuka di perangkat ini.</span><button type="button" onClick={() => setContextChangeNotice(null)} className="shrink-0 rounded-lg bg-violet px-3 py-1.5 text-xs font-bold text-white">Perbarui</button></div>}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-ink-500">Kurikulum</p><div className="mt-1 flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-ink-900">{activeVersion?.curriculum_name ?? "Belum dipilih"}</h2>{activeVersion && <span className="text-emerald-700">✓</span>}</div><p className="text-sm text-ink-600">{activeVersion ? `${activeSource ? institutionLabel(activeSource.institution) : "Kemenag"} · ${activeVersion.regulation_year ?? "tahun tidak dicantumkan"}` : "SAKALA akan memilih kurikulum relevan bila hanya ada satu."}</p></div><button type="button" onClick={() => openUpdate("previous")} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-surface-muted">Update</button></div>
        {verifiedVersions.length > 1 && <select aria-label="Pilih kurikulum" value={versionId} onChange={(e) => chooseVersion(e.target.value)} className="mt-4 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"><option value="">Pilih kurikulum</option>{verifiedVersions.map((v) => { const vInst = sources.find((s) => s.id === v.source_id)?.institution; return <option key={v.id} value={v.id}>{v.curriculum_name} · {vInst ? institutionLabel(vInst) : "Kemenag"} · {v.regulation_year ?? "—"}</option>; })}</select>}
      </section>
      </>}

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-ink-900">Sumber &amp; Referensi</h2><p className="mt-1 text-sm text-ink-600">Sumber aktif tetap ringkas; detail tersedia tanpa pindah halaman.</p></div><div className="flex gap-2">{activeVersion && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">✓ Sumber siap</span>}<button type="button" onClick={() => setSourceDrawer(true)} disabled={!activeVersion} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">Lihat detail</button></div></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted p-4"><div><p className="font-semibold text-ink-900">{activeVersion?.curriculum_name ?? "Belum ada sumber aktif"}</p><p className="mt-1 text-sm text-ink-600">{activeSource?.name ?? "Gunakan Update untuk memilih sumber."}</p></div><button type="button" onClick={() => openUpdate("new")} className="text-sm font-bold text-brand-700">Update Sumber</button></div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-ink-900">Generate</h2><p className="mt-1 text-sm text-ink-600">Parameter kelas disiapkan otomatis dari konteks aktif; operator tetap dapat menyesuaikannya.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${validation.status === "valid" ? "bg-emerald-50 text-emerald-700" : validation.status === "warning" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{validation.text}</span></div>
        <div className="mt-4 grid gap-4 md:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Jenjang <span className="font-normal text-ink-500">(opsional)</span></span><select aria-label="Pilih jenjang" value={level} onChange={(e) => { setLevel(e.target.value); setCandidate([]); }} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"><option value="">Semua jenjang dari kurikulum</option>{levels.map((value) => <option key={value}>{value}</option>)}</select></label><div><p className="mb-2 text-sm font-semibold">Kelas</p><div className="flex flex-wrap gap-2">{eligibleClasses.map((kelas) => <button key={kelas.id} type="button" onClick={() => toggleClass(kelas.id)} aria-pressed={classIds.includes(kelas.id)} className={`rounded-lg border px-3 py-2 text-sm ${classIds.includes(kelas.id) ? "border-brand-600 bg-brand-50 text-brand-700" : "border-border text-ink-700"}`}>{kelas.tingkat} · {kelas.nama_rombel}</button>)}{!busy && !eligibleClasses.length && <span className="text-sm text-ink-500">Belum ada kelas yang sesuai.</span>}</div></div></div>
        <button type="button" onClick={generateCandidate} disabled={busy || !activeVersion || activeVersion.verification_status !== "verified" || !classIds.length} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-soft disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Generate Kurikulum</button>
        {progress > 0 && progress < 5 && <div className="mt-4 grid grid-cols-5 gap-2 text-[11px] font-semibold text-ink-500"><span className={progress >= 1 ? "text-emerald-700" : ""}>Membaca sumber {progress >= 1 ? "✓" : "○"}</span><span className={progress >= 2 ? "text-emerald-700" : ""}>Struktur {progress >= 2 ? "✓" : "○"}</span><span className={progress >= 3 ? "text-brand-700" : ""}>Mapel {progress >= 3 ? "●" : "○"}</span><span className={progress >= 4 ? "text-brand-700" : ""}>JP {progress >= 4 ? "●" : "○"}</span><span className={progress >= 5 ? "text-emerald-700" : ""}>Hasil {progress >= 5 ? "✓" : "○"}</span></div>}
      </section>

      {candidate.length > 0 && <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-ink-500">Review Mode</p><h2 className="mt-1 text-xl font-bold text-ink-900">Hasil Generate</h2><p className="mt-1 text-sm text-ink-600">{candidate.length} mata pelajaran · {unchangedCount} tidak berubah · {changedOnlyIds.length} berubah · {newIds.length} baru</p></div><div className="flex flex-wrap rounded-xl bg-surface-muted p-1 text-sm font-semibold"><button onClick={() => setFilter("all")} className={`rounded-lg px-3 py-2 ${filter === "all" ? "bg-surface shadow-sm" : "text-ink-500"}`}>{candidate.length} Total</button><button onClick={() => setFilter("unchanged")} className={`rounded-lg px-3 py-2 ${filter === "unchanged" ? "bg-surface shadow-sm" : "text-ink-500"}`}>{unchangedCount} Tetap</button><button onClick={() => setFilter("changed")} className={`rounded-lg px-3 py-2 ${filter === "changed" ? "bg-surface shadow-sm" : "text-ink-500"}`}>{changedOnlyIds.length} Berubah</button><button onClick={() => setFilter("new")} className={`rounded-lg px-3 py-2 ${filter === "new" ? "bg-surface shadow-sm" : "text-ink-500"}`}>{newIds.length} Baru</button></div></div>
        {/* Laporan user #4 — penjelasan situasi nyata dalam bahasa ringkas,
            bukan cuma angka. Disusun murni dari data candidate/baseline yang
            sudah ada, bukan narasi buatan. */}
        <p className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-700">{buildSituationNarrative()}</p>
        <div className="flex flex-wrap gap-2"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari mata pelajaran..." className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm" /></div><button onClick={() => setFilter("review")} className={`rounded-lg border px-3 py-2 text-sm ${filter === "review" ? "border-amber bg-amber-50" : "border-border"}`}>Perlu ditinjau {reviewIds.length}</button></div>
        {selectedIds.length > 0 && <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-600/30 bg-brand-50 p-3 text-sm">
          <strong>{selectedIds.length} mata pelajaran dipilih</strong>
          {bulkEditing ? (
            <div className="flex items-center gap-2"><input type="number" min="0" step="1" autoFocus value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") applyBulkTarget(); if (e.key === "Escape") { setBulkEditing(false); setBulkValue(""); } }} placeholder="Target JP" className="w-28 rounded-lg border border-border bg-surface px-3 py-2 font-semibold" aria-label="Target JP untuk semua yang dipilih" /><button onClick={applyBulkTarget} className="rounded-lg bg-brand-600 px-3 py-2 font-bold text-white">Terapkan</button><button onClick={() => { setBulkEditing(false); setBulkValue(""); }} className="rounded-lg border border-border bg-surface px-3 py-2">Batal</button></div>
          ) : (
            <div className="flex gap-2"><button onClick={() => setBulkEditing(true)} className="rounded-lg bg-brand-600 px-3 py-2 font-bold text-white">Atur Target JP</button><button onClick={() => { setSelectedIds([]); setBulkEditing(false); setBulkValue(""); }} className="rounded-lg border border-border bg-surface px-3 py-2">Batalkan</button></div>
          )}
        </div>}
        {/* V4 poin 36 — Desktop/tablet: tabel dengan scroll terkontrol. Mobile: stacked rows. */}
        <div className="hidden overflow-x-auto rounded-xl border border-border md:block"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-surface-muted"><tr><th className="w-10 px-3 py-3"><input type="checkbox" aria-label="Pilih semua" checked={visibleCandidate.length > 0 && visibleCandidate.every((x) => selectedIds.includes(x.id))} onChange={(e) => setSelectedIds(e.target.checked ? visibleCandidate.map((x) => x.id) : [])} /></th><th className="px-3 py-3">Mata Pelajaran</th><th className="px-3 py-3">JP Resmi</th><th className="px-3 py-3">Target JP</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Aksi</th></tr></thead><tbody>{visibleCandidate.map((item) => { const changed = changedIds.includes(item.id); const invalid = reviewIds.includes(item.id); const isEditing = editingTargetId === item.id; const note = targetNote(item); return <tr key={item.id} className={`group border-t border-border transition ${selectedIds.includes(item.id) ? "bg-brand-50/50" : "hover:bg-surface-muted"}`}><td className="px-3 py-3"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} aria-label={`Pilih ${item.subject_name}`} /></td><td className="px-3 py-3"><p className="font-semibold text-ink-900">{item.subject_name}</p><p className="text-xs text-ink-500">{item.class_level}</p></td><td className="px-3 py-3">{item.official_allocation ?? "—"}</td><td className="px-3 py-3">
          {isEditing ? (
            <input type="number" min="0" step="1" autoFocus value={editingDraftValue} onChange={(e) => setEditingDraftValue(e.target.value)} onBlur={() => { updateTarget(item.id, editingDraftValue); setEditingTargetId(null); }} onKeyDown={(e) => { if (e.key === "Enter") { updateTarget(item.id, editingDraftValue); setEditingTargetId(null); } if (e.key === "Escape") setEditingTargetId(null); }} className={`w-24 rounded-lg border px-3 py-2 font-semibold ${invalid ? "border-amber/60 bg-amber-50" : "border-border bg-surface"}`} aria-label={`Target JP ${item.subject_name}`} />
          ) : (
            <button type="button" onClick={() => beginEditTarget(item)} className={`w-24 rounded-lg border px-3 py-2 text-left font-semibold ${invalid ? "border-amber/60 bg-amber-50" : "border-transparent hover:border-border hover:bg-surface"}`} aria-label={`Edit Target JP ${item.subject_name}, sekarang ${item.manualTarget ?? "kosong"}`}>{item.manualTarget ?? "—"}</button>
          )}
          {/* V4 poin 24 — feedback real-time, langsung di row, tidak menunggu Save. */}
          <p className={`mt-1 text-[11px] font-semibold ${(isEditing ? targetNoteFromDraft(item, editingDraftValue) : note).tone === "warn" ? "text-amber-700" : "text-emerald-700"}`}>{(isEditing ? targetNoteFromDraft(item, editingDraftValue) : note).text}</p>
          {changed && <p className="mt-0.5 text-[11px] text-amber-700">{baseline[item.id] ?? "—"} → {item.manualTarget ?? "—"}</p>}
        </td><td className="px-3 py-3">{invalid ? <span className="text-amber-700">⚠ Perlu ditinjau</span> : newIds.includes(item.id) ? <span className="text-brand-700">Baru</span> : changed ? <span className="text-amber-700">Berubah</span> : <span className="text-emerald-700">✓ Tetap</span>}</td><td className="px-3 py-3"><div className="flex items-center gap-3 opacity-60 transition-opacity group-hover:opacity-100"><button onClick={() => beginEditTarget(item)} className="text-xs font-semibold text-ink-600 hover:text-brand-700">Edit</button><button onClick={() => setDetailItemId(item.id)} className="text-xs font-semibold text-ink-600 hover:text-brand-700">Detail</button><button onClick={() => restoreTarget(item.id)} className="text-xs font-semibold text-ink-600 hover:text-brand-700">Kembalikan</button></div></td></tr>; })}</tbody></table></div>

        <div className="space-y-3 md:hidden">{visibleCandidate.map((item) => { const changed = changedIds.includes(item.id); const invalid = reviewIds.includes(item.id); const isEditing = editingTargetId === item.id; const note = targetNote(item); return <div key={item.id} className={`rounded-xl border p-4 ${selectedIds.includes(item.id) ? "border-brand-600/40 bg-brand-50/50" : "border-border"}`}>
          <div className="flex items-start justify-between gap-2"><label className="flex items-start gap-2"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} aria-label={`Pilih ${item.subject_name}`} className="mt-1" /><span><span className="block font-semibold text-ink-900">{item.subject_name}</span><span className="block text-xs text-ink-500">{item.class_level}</span></span></label>{invalid ? <span className="text-xs font-semibold text-amber-700">⚠ Ditinjau</span> : newIds.includes(item.id) ? <span className="text-xs font-semibold text-brand-700">Baru</span> : changed ? <span className="text-xs font-semibold text-amber-700">Berubah</span> : <span className="text-xs font-semibold text-emerald-700">✓ Tetap</span>}</div>
          <div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-ink-500">JP Resmi: <b className="text-ink-800">{item.official_allocation ?? "—"}</b></span>
            {isEditing ? (
              <input type="number" min="0" step="1" autoFocus value={editingDraftValue} onChange={(e) => setEditingDraftValue(e.target.value)} onBlur={() => { updateTarget(item.id, editingDraftValue); setEditingTargetId(null); }} onKeyDown={(e) => { if (e.key === "Enter") { updateTarget(item.id, editingDraftValue); setEditingTargetId(null); } if (e.key === "Escape") setEditingTargetId(null); }} className={`w-24 rounded-lg border px-3 py-2 text-right font-semibold ${invalid ? "border-amber/60 bg-amber-50" : "border-border bg-surface"}`} aria-label={`Target JP ${item.subject_name}`} />
            ) : (
              <button type="button" onClick={() => beginEditTarget(item)} className={`w-24 rounded-lg border px-3 py-2 text-right font-semibold ${invalid ? "border-amber/60 bg-amber-50" : "border-border"}`} aria-label={`Edit Target JP ${item.subject_name}, sekarang ${item.manualTarget ?? "kosong"}`}>{item.manualTarget ?? "—"}</button>
            )}
          </div>
          <p className={`mt-1 text-right text-[11px] font-semibold ${(isEditing ? targetNoteFromDraft(item, editingDraftValue) : note).tone === "warn" ? "text-amber-700" : "text-emerald-700"}`}>{(isEditing ? targetNoteFromDraft(item, editingDraftValue) : note).text}</p>
          {changed && <p className="mt-0.5 text-right text-[11px] text-amber-700">{baseline[item.id] ?? "—"} → {item.manualTarget ?? "—"}</p>}
          <div className="mt-3 flex items-center justify-end gap-3 border-t border-border pt-2"><button onClick={() => beginEditTarget(item)} className="text-xs font-semibold text-ink-600">Edit</button><button onClick={() => setDetailItemId(item.id)} className="text-xs font-semibold text-ink-600">Detail</button><button onClick={() => restoreTarget(item.id)} className="text-xs font-semibold text-ink-600">Kembalikan</button></div>
        </div>; })}</div>
        {/* V4 poin 23 — Total JP tetap kelihatan ringkas (tidak disembunyikan),
            tapi sekarang bisa diklik untuk rincian per mata pelajaran —
            match spek tanpa menyembunyikan info dasar di baliknya. */}
        <button type="button" onClick={() => setTotalJpDetailOpen((v) => !v)} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted p-4 text-left hover:bg-surface-muted/70"><div><p className="font-bold text-ink-900">Total Target JP: {totalTarget}</p><p className="mt-1 text-xs text-ink-500">JP resmi: {officialTotal} · Perubahan: {totalTarget - candidate.reduce((s, x) => s + (baseline[x.id] ?? 0), 0) >= 0 ? "+" : ""}{totalTarget - candidate.reduce((s, x) => s + (baseline[x.id] ?? 0), 0)} JP · <span className="underline">{totalJpDetailOpen ? "Sembunyikan rincian" : "Lihat rincian"}</span></p></div><span className={`text-sm font-semibold ${totalTarget > 0 ? "text-emerald-700" : "text-amber-700"}`}>{totalTarget > 0 ? "✓ Target diterima" : "⚠ Total perlu ditinjau"}</span></button>
        {totalJpDetailOpen && <div className="rounded-xl border border-border p-3"><table className="w-full text-left text-xs"><thead><tr className="text-ink-400"><th className="pb-1.5 font-medium">Mata Pelajaran</th><th className="pb-1.5 font-medium">JP Resmi</th><th className="pb-1.5 font-medium">Target</th><th className="pb-1.5 font-medium">Perubahan</th></tr></thead><tbody>{candidate.map((item) => { const delta = (item.manualTarget ?? 0) - (baseline[item.id] ?? 0); return <tr key={item.id} className="border-t border-border"><td className="py-1.5 text-ink-800">{item.subject_name}</td><td className="py-1.5 text-ink-600">{item.official_allocation ?? "—"}</td><td className="py-1.5 font-semibold text-ink-900">{item.manualTarget ?? "—"}</td><td className={`py-1.5 font-semibold ${delta > 0 ? "text-emerald-700" : delta < 0 ? "text-rose-700" : "text-ink-400"}`}>{delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${delta}`}</td></tr>; })}</tbody></table></div>}
        {missingSubjects.length > 0 && <div className="rounded-xl border border-amber/30 bg-amber-50 p-4 text-sm"><p className="font-bold text-amber-700">{missingSubjects.length} mata pelajaran sebelumnya tidak ditemukan.</p><ul className="mt-2 space-y-1 text-ink-700">{missingSubjects.map((m) => <li key={`${m.subjectName}::${m.classLevel}`}>{m.subjectName} <span className="text-ink-400">· {m.classLevel}</span></li>)}</ul><p className="mt-2 text-xs text-ink-500">Data sebelumnya tetap dipertahankan — Commit tidak menghapus apapun, hanya menambah/memperbarui data yang ada di hasil Generate ini.</p></div>}
      </section>}

      {candidate.length > 0 && !success && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        {committing ? (
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-ink-500"><span className={syncStep >= 1 ? "text-emerald" : ""}>Menyimpan kurikulum {syncStep >= 1 ? "✓" : "○"}</span><span className={syncStep >= 2 ? "text-emerald" : ""}>Memperbarui mata pelajaran {syncStep >= 2 ? "✓" : "○"}</span><span className={syncStep >= 3 ? "text-emerald" : ""}>Memperbarui Target JP {syncStep >= 3 ? "✓" : "○"}</span></div>
        ) : <p className="text-sm font-semibold text-ink-700">{changedIds.length} perubahan belum disimpan</p>}
        <button type="button" onClick={() => setCompareOpen(true)} disabled={validation.status !== "valid" || committing} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" /> {committing ? "Menyinkronkan…" : "Simpan & Sinkronkan"}</button>
      </div></div>}

      {success && <section className="rounded-2xl border border-emerald/30 bg-emerald-50 p-5"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-700" /><div className="min-w-0 flex-1"><h2 className="font-bold text-emerald">Kurikulum tersimpan</h2><p className="mt-1 text-sm text-emerald-700">{candidate.length} mata pelajaran · {changedIds.length} diperbarui · {newIds.length} ditambahkan · 0 dihapus</p>
        {/* Laporan user #5 — bagian mana yang berubah, bukan cuma angka.
            Diambil dari data commit yang sama persis dipakai server action,
            bukan ringkasan terpisah yang bisa berbeda dari yang benar-benar tersimpan. */}
        {changedOnlyIds.length > 0 && <div className="mt-3 text-sm text-emerald-700"><p className="font-semibold">Diperbarui:</p><ul className="mt-1 list-inside list-disc space-y-0.5">{candidate.filter((c) => changedOnlyIds.includes(c.id)).map((c) => <li key={c.id}>{c.subject_name}: {baseline[c.id] ?? "—"} → {c.manualTarget ?? "—"} JP</li>)}</ul></div>}
        {newIds.length > 0 && <div className="mt-3 text-sm text-emerald-700"><p className="font-semibold">Ditambahkan:</p><ul className="mt-1 list-inside list-disc space-y-0.5">{candidate.filter((c) => newIds.includes(c.id)).map((c) => <li key={c.id}>{c.subject_name} — {c.manualTarget ?? "—"} JP</li>)}</ul></div>}
        <div className="mt-3 flex gap-2"><Link href="/akademik/mata-pelajaran" className="rounded-lg bg-surface px-3 py-2 text-sm font-semibold">Lihat Mata Pelajaran</Link><Link href="/pembagian-mengajar/target-jp" className="rounded-lg bg-surface px-3 py-2 text-sm font-semibold">Lihat Target JP</Link></div></div></div></section>}

      {candidate.length === 0 && !busy && <section className="rounded-2xl border border-dashed border-border p-8 text-center"><p className="font-semibold text-ink-900">Belum ada hasil kurikulum.</p><p className="mt-1 text-sm text-ink-500">Pilih kurikulum dan sumber untuk mulai.</p></section>}
      {errorMessage && <div role="alert" className="rounded-xl border border-rose/30 bg-rose-50 p-4 text-sm"><p className="font-bold text-rose">{errorMessage}</p><button type="button" onClick={() => { if (errorRetry === "load") loadAll(); else if (errorRetry === "commit") void commitCandidate(); setErrorMessage(""); setErrorRetry(null); }} className="mt-3 rounded-lg bg-rose px-3 py-2 text-xs font-bold text-white">Coba lagi</button></div>}
      {message && <p role="status" className="rounded-xl border border-border bg-surface-muted p-4 text-sm leading-6 text-ink-700">{message}</p>}

      {detailItemId && (() => {
        const item = candidate.find((x) => x.id === detailItemId);
        if (!item) return null;
        return <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setDetailItemId(null)}><aside className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between"><h2 className="text-xl font-bold text-ink-900">{item.subject_name}</h2><button onClick={() => setDetailItemId(null)} aria-label="Tutup"><X className="h-5 w-5" /></button></div>
          <div className="mt-6 space-y-4 text-sm"><div><p className="font-semibold text-ink-500">JP Resmi</p><p className="mt-1 text-lg font-bold text-ink-900">{item.official_allocation ?? "—"}</p></div><div><p className="font-semibold text-ink-500">Target JP</p><p className="mt-1 text-lg font-bold text-ink-900">{item.manualTarget ?? "—"}</p></div><div><p className="font-semibold text-ink-500">Sebelumnya</p><p className="mt-1 text-ink-700">{baseline[item.id] ?? "Belum ada (mata pelajaran baru)"}</p></div><div><p className="font-semibold text-ink-500">Sumber</p><p className="mt-1 text-ink-700">{activeVersion?.curriculum_name ?? "—"}</p></div></div>
          <div className="mt-6 flex flex-wrap gap-2"><button onClick={() => setDetailItemId(null)} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white">Gunakan {item.manualTarget ?? "—"}</button>{baseline[item.id] != null && <button onClick={() => { restoreTarget(item.id); setDetailItemId(null); }} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Pertahankan {baseline[item.id]}</button>}</div>
        </aside></div>;
      })()}

      {sourceDrawer && activeVersion && <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setSourceDrawer(false)}><aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-ink-500">Source Preview</p><h2 className="mt-1 text-xl font-bold">{activeVersion.curriculum_name}</h2><p className="text-sm text-ink-600">{activeSource ? institutionLabel(activeSource.institution) : "Kemenag"} · {activeVersion.regulation_year ?? "—"}</p></div><button onClick={() => setSourceDrawer(false)} aria-label="Tutup"><X className="h-5 w-5" /></button></div><div className="mt-6 space-y-4 text-sm"><div><p className="font-semibold">Status</p>{(() => { const s = activeVersion.verification_status; const cfg = s === "verified" ? { text: "✓ Siap digunakan", cls: "text-emerald-700" } : s === "blocked" ? { text: "× Tidak dapat digunakan", cls: "text-rose-700" } : { text: "⚠ Perlu ditinjau", cls: "text-amber-700" }; return <p className={`mt-1 ${cfg.cls}`}>{cfg.text}</p>; })()}</div><div><p className="font-semibold">Sumber</p><p className="mt-1">{activeSource?.name ?? "Regulasi resmi"}</p></div><div><p className="font-semibold">Regulasi</p><p className="mt-1 text-ink-600">{activeVersion.regulation_number ?? "Belum dicantumkan"}{activeVersion.regulation_title ? ` · ${activeVersion.regulation_title}` : ""}</p></div><div className="flex gap-2 pt-3"><button onClick={() => setSourceDrawer(false)} disabled={activeVersion.verification_status === "blocked"} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Gunakan sumber</button><button onClick={() => setSourceDrawer(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Tutup</button></div></div></aside></div>}

      {updateOpen && <div className="fixed inset-0 z-50 bg-black/20 p-4" onClick={() => setUpdateOpen(false)}><div role="dialog" aria-modal="true" className="mx-auto mt-[8vh] max-h-[84vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Update</p><h2 className="mt-1 text-xl font-bold">Perbarui pilihan kurikulum</h2><p className="mt-1 text-sm text-ink-600">Menggunakan konteks aktif · {activeContext?.jenjang ?? "—"} · {activeContext?.institution ?? "—"} · {activeContext?.tahun_pelajaran ?? "—"} · {activeContext?.semester ?? "—"}</p></div><button onClick={() => setUpdateOpen(false)} aria-label="Tutup"><X className="h-5 w-5" /></button></div><div className="mt-5 flex rounded-xl bg-surface-muted p-1"><button onClick={() => setUpdateMode("previous")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${updateMode === "previous" ? "bg-surface shadow-sm" : "text-ink-500"}`}>Sumber sebelumnya</button><button onClick={() => setUpdateMode("new")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${updateMode === "new" ? "bg-surface shadow-sm" : "text-ink-500"}`}>Sumber baru</button></div>{updateMode === "previous" ? <div className="mt-4 space-y-2"><div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"><Search className="h-4 w-4 text-ink-400" /><input value={sourceSearch} onChange={(e) => setSourceSearch(e.target.value)} placeholder="Cari sumber..." className="w-full bg-transparent text-sm outline-none" /></div>{(distinctInstitutions.length > 1 || distinctYears.length > 1) && <div className="flex flex-wrap gap-4"><div className="flex flex-wrap gap-1.5"><button onClick={() => setSourceInstitutionFilter("")} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${!sourceInstitutionFilter ? "bg-brand-600 text-white" : "bg-surface-muted text-ink-600"}`}>Semua</button>{distinctInstitutions.map((inst) => <button key={inst} onClick={() => setSourceInstitutionFilter(inst)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sourceInstitutionFilter === inst ? "bg-brand-600 text-white" : "bg-surface-muted text-ink-600"}`}>{institutionLabel(inst)}</button>)}</div><div className="flex flex-wrap gap-1.5"><button onClick={() => setSourceYearFilter("")} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sourceYearFilter === "" ? "bg-brand-600 text-white" : "bg-surface-muted text-ink-600"}`}>Semua Tahun</button>{distinctYears.map((y) => <button key={y} onClick={() => setSourceYearFilter(y)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sourceYearFilter === y ? "bg-brand-600 text-white" : "bg-surface-muted text-ink-600"}`}>{y}</button>)}</div></div>}{filteredVersions.map((v) => { const src = sources.find((s) => s.id === v.source_id); const inst = src?.institution; const isConfirming = confirmDeleteSourceId === v.source_id; const needsPromotion = src && (src.status !== "official"); return <div key={v.id} className={`w-full rounded-xl border p-4 text-left ${versionId === v.id ? "border-brand-600 bg-brand-50" : "border-border"}`}>
          <button type="button" onClick={() => chooseVersion(v.id)} className="w-full text-left"><p className="font-semibold">{v.curriculum_name}</p><p className="mt-1 text-sm text-ink-600">{inst ? institutionLabel(inst) : "Kemenag"} · {v.regulation_year ?? "—"}</p>{versionId === v.id && <p className="mt-1 text-xs font-bold text-emerald-700">✓ Dipilih</p>}{needsPromotion && <p className="mt-1 text-xs font-bold text-amber">⚠ Perlu ditinjau — belum bisa dipakai Commit</p>}</button>
          <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-border pt-2">
            {needsPromotion && src && <button type="button" onClick={() => void handlePromoteSource(src.id)} disabled={promotingSourceId === src.id} className="flex items-center gap-1 text-xs font-semibold text-brand-700 disabled:opacity-50"><ShieldCheck className="h-3.5 w-3.5" /> {promotingSourceId === src.id ? "Menandai…" : "Tandai Resmi"}</button>}
            {isConfirming ? (
              <div className="flex items-center gap-2 text-xs"><span className="text-ink-600">Hapus sumber ini?</span><button type="button" onClick={() => void handleDeleteSource(v.source_id)} disabled={deletingSourceId === v.source_id} className="rounded-lg bg-rose px-2.5 py-1.5 font-bold text-white disabled:opacity-50">{deletingSourceId === v.source_id ? "Menghapus…" : "Ya, hapus"}</button><button type="button" onClick={() => setConfirmDeleteSourceId(null)} className="rounded-lg border border-border px-2.5 py-1.5 font-semibold">Batal</button></div>
            ) : (
              <button type="button" onClick={() => setConfirmDeleteSourceId(v.source_id)} className="text-xs font-semibold text-rose">Hapus sumber</button>
            )}
          </div>
        </div>; })}{!filteredVersions.length && <p className="py-4 text-center text-sm text-ink-500">Tidak ada sumber yang cocok.</p>}</div> : <div className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="rounded-xl border border-border p-4"><span className="mb-2 flex items-center gap-2 text-sm font-semibold"><Link2 className="h-4 w-4" /> Link</span><input value={sourceUrl} onChange={(e) => { setSourceUrl(e.target.value); setDuplicateAcknowledged(false); }} placeholder="https://..." inputMode="url" className="w-full rounded-lg border border-border px-3 py-2 text-sm" /></label>
            <label className="cursor-pointer rounded-xl border border-border p-4"><span className="mb-2 flex items-center gap-2 text-sm font-semibold"><UploadCloud className="h-4 w-4" /> Import PDF</span><input type="file" accept=".pdf" onChange={(e) => void onFileChange(e)} className="w-full text-sm" /><span className="mt-2 block text-xs text-ink-500">{pdfExtracting ? "Membaca PDF…" : fileName || "Ekstraksi teks otomatis (gratis, heuristik — bukan AI)"}</span></label>
          </div>

          {/* Preview hasil ekstraksi PDF — operator meninjau & mengoreksi
              sebelum disimpan. Ini titik "human review" yang membuat status
              boleh dinaikkan lewat Tandai Resmi nanti. */}
          {extractError && <p className="rounded-xl border border-rose/30 bg-rose-50 px-3.5 py-2.5 text-sm text-rose">{extractError}</p>}
          {extractedRows.length > 0 && <div className="rounded-xl border border-brand-600/30 bg-brand-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-brand-700"><Sparkles className="h-4 w-4" /> {extractedRows.length} baris terdeteksi dari "{pdfFileName}" — tinjau dulu</div>
            <p className="mt-1 text-xs text-ink-600">Ekstraksi heuristik (pola teks "mapel · angka JP"), bukan AI — mungkin ada yang salah tangkap atau kelewat. Hapus baris yang tidak sesuai.</p>
            <ul className="mt-3 max-h-52 space-y-1 overflow-y-auto">{extractedRows.map((r) => <li key={r.subjectName} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-sm"><span>{r.subjectName} — <b>{r.weeklyTarget} JP</b></span><button type="button" onClick={() => removeExtractedRow(r.subjectName)} aria-label={`Hapus ${r.subjectName}`} className="text-ink-400 hover:text-rose"><X className="h-4 w-4" /></button></li>)}</ul>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-ink-600">Jenjang kelas untuk semua baris ini<select value={extractClassLevel} onChange={(e) => setExtractClassLevel(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-900"><option value="">Pilih jenjang</option>{["VII", "VIII", "IX", "X", "XI", "XII"].map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}</select></label>
              <label className="text-xs font-semibold text-ink-600">Kementerian/Badan<select value={extractInstitution} onChange={(e) => setExtractInstitution(e.target.value as "Kemenag" | "Kemendikdasmen")} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-900"><option value="Kemenag">Kemenag</option><option value="Kemendikdasmen">Kemendikdasmen</option></select></label>
            </div>
            <button type="button" onClick={() => void confirmExtractedSource()} disabled={savingExtracted || !extractClassLevel || !extractedRows.length} className="mt-3 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{savingExtracted ? "Menyimpan…" : "Simpan sebagai sumber baru"}</button>
          </div>}

          {duplicateSource && !duplicateAcknowledged && <div className="rounded-xl border border-amber/30 bg-amber-50 p-4 text-sm"><p className="font-bold text-amber">Sumber serupa ditemukan.</p><p className="mt-1 text-ink-700">"{duplicateSource.name}" sudah tersimpan dengan link yang sama.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={useStoredSource} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white">Gunakan yang tersimpan</button><button type="button" onClick={() => setDuplicateAcknowledged(true)} className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold">Gunakan sumber baru</button></div></div>}
        </div>}
        <div className="mt-5 flex items-center justify-between gap-3"><p className="text-sm text-ink-600">{updateReady ? "✓ Pilihan siap digunakan" : "Data resmi belum berubah."}</p><button type="button" onClick={() => void applyUpdateSelection()} disabled={updating || (updateMode === "new" && !sourceUrl.trim())} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${updating ? "animate-spin" : ""}`} /> {updating ? "Mencari…" : "Gunakan sumber"}</button></div>
      </div></div>}

      {compareOpen && <div className="fixed inset-0 z-[60] bg-black/20 p-4" onClick={() => setCompareOpen(false)}><div role="dialog" aria-modal="true" className="mx-auto mt-[12vh] w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Automatic Compare</p><h2 className="mt-1 text-xl font-bold">Perubahan ditemukan</h2><p className="mt-1 text-sm text-ink-600">{changedIds.length} perubahan perlu ditinjau sebelum sinkronisasi.</p><div className="mt-4 space-y-2 rounded-xl bg-surface-muted p-4 text-sm">{changedIds.slice(0, 8).map((id) => { const item = candidate.find((x) => x.id === id); return item ? <div key={id} className="flex justify-between gap-3"><span>{item.subject_name}</span><strong>{baseline[id] ?? "—"} → {item.manualTarget ?? "—"}</strong></div> : null; })}{changedIds.length > 8 && <p className="text-xs text-ink-500">+ {changedIds.length - 8} perubahan lainnya</p>}{newIds.length > 0 && <p className="pt-2 text-sm font-semibold text-brand-700">{newIds.length} mata pelajaran baru ditemukan.</p>}</div><p className="mt-4 text-sm text-ink-600">Saran: gunakan hasil terbaru. Data yang tidak berubah tidak perlu ditinjau satu per satu.</p><div className="mt-5 flex flex-wrap justify-end gap-2"><button onClick={() => setCompareOpen(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Tinjau perbedaan</button><button onClick={() => void commitCandidate()} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white">Gunakan hasil terbaru</button></div></div></div>}

      {newSubjectsToConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/20 p-4" onClick={() => setNewSubjectsToConfirm(null)}>
          <div role="dialog" aria-modal="true" className="mx-auto mt-[12vh] w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Master Data Baru</p>
            <h2 className="mt-1 text-xl font-bold">{newSubjectsToConfirm.length} mata pelajaran baru akan dibuat</h2>
            <p className="mt-1 text-sm text-ink-600">
              Kurikulum ini memuat mata pelajaran yang belum ada di data Mata Pelajaran sekolah. SAKALA akan membuatnya
              (kategori: Akademik, prioritas: Normal — bisa disesuaikan nanti di halaman Mata Pelajaran).
            </p>
            <div className="mt-4 space-y-1.5 rounded-xl bg-surface-muted p-4 text-sm">
              {newSubjectsToConfirm.map((name) => (
                <div key={name} className="font-medium text-ink-900">{name}</div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button onClick={() => setNewSubjectsToConfirm(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">
                Batal
              </button>
              <button
                onClick={() => {
                  const confirmed = newSubjectsToConfirm;
                  setNewSubjectsToConfirm(null);
                  void commitCandidate(confirmed);
                }}
                className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white"
              >
                Buat & Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
