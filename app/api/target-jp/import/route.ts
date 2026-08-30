import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicContext } from "@/lib/application/academicContext.usecases";
import { buildControlledTemplateWorkbook, type ControlledTemplateColumn } from "@/lib/import/controlled-template";
import { bufferToBodyInit } from "@/lib/utils/response";
import { recordAuditEvent } from "@/lib/application/auditLog.usecases";
import { toPlainDatabaseError } from "@/lib/utils/databaseError";
import { upsertTargetJp } from "@/lib/application/targetJp.usecases";

const columns: ControlledTemplateColumn[] = [
  { key: "AcademicContext", required: true, format: "Pilih/ikuti Academic Context SAKALA", example: "2026/2027 · Ganjil" },
  { key: "Kelas", required: true, format: "Pilih/ikuti Kelas Master SAKALA", example: "7A" },
  { key: "KodeMapel", required: true, format: "Kode Mata Pelajaran Master SAKALA", example: "BIND" },
  { key: "MataPelajaran", required: false, format: "Nama mapel sebagai fallback validasi", example: "Bahasa Indonesia" },
  { key: "TargetJP", required: true, format: "Bilangan bulat 0–10", example: "5" },
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("mode") === "data") {
    try {
      const supabase = await createClient();

      // Context is the canonical prerequisite for Generate Kurikulum.
      // Read it first and do not let optional Target-JP/master reads block
      // the context handoff to the client.
      const activeContext = await getActiveAcademicContext(supabase);
      const contexts = activeContext
        ? [{ id: activeContext.id, tahun_pelajaran: activeContext.tahunPelajaran, semester: activeContext.semester, jenjang: activeContext.jenjang, institution: activeContext.institution, is_active: activeContext.isActive }]
        : [];

      let classes: Array<{ id: string; nama_rombel: string; tingkat: string; tahun_ajaran: string; semester: string }> = [];
      if (activeContext) {
        const { data, error } = await supabase
          .from("kelas")
          .select("id,nama_rombel,tingkat,tahun_ajaran,semester")
          .eq("tahun_ajaran", activeContext.tahunPelajaran)
          .eq("semester", activeContext.semester)
          .order("tingkat")
          .order("nama_rombel");
        if (error) throw error;
        classes = data ?? [];
      }

      // These datasets are supplementary to the Generate context handoff.
      // Keep them best-effort so a Target-JP policy/RLS issue cannot make the
      // otherwise valid Academic Context appear as "not ready" in Generate.
      const [subjectsResult, targetsResult] = await Promise.all([
        supabase.from("mata_pelajaran").select("id,nama,kode").order("nama"),
        supabase.from("target_jp").select("academic_context_id,kelas_id,mata_pelajaran_id,target_jp").eq("academic_context_id", activeContext?.id ?? "00000000-0000-0000-0000-000000000000"),
      ]);

      return NextResponse.json({
        contexts,
        classes,
        subjects: subjectsResult.data ?? [],
        targets: targetsResult.data ?? [],
      });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal membaca data context." }, { status: 500 });
    }
  }

  const buffer = buildControlledTemplateWorkbook(columns, [
    ["2026/2027 · Ganjil", "7A", "BIND", "Bahasa Indonesia", "5"],
    ["2026/2027 · Ganjil", "7A", "MAT", "Matematika", "4"],
  ], { module: "target-jp", label: "Target JP", schemaVersion: "2.3" });
  return new NextResponse(bufferToBodyInit(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Template_Target_JP_SAKALA_V2.3.xlsx"',
    },
  });
}

function text(v: unknown) { return String(v ?? "").trim(); }
function normalize(v: unknown) { return text(v).toLowerCase().replace(/\s+/g, " "); }
function key(v: unknown) { return normalize(v).replace(/[·|]/g, " "); }

async function parse(file: File) {
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) throw new Error("File terlalu besar. Maksimal 5 MB.");
  const name = file.name.toLowerCase();
  if (![".xlsx", ".xls", ".csv"].some((ext) => name.endsWith(ext))) throw new Error("Format file harus XLSX, XLS, atau CSV.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Sheet pertama tidak ditemukan.");
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
}

async function validate(rows: Record<string, unknown>[]) {
  const supabase = await createClient();
  const [{ data: contexts, error: ce }, { data: classes, error: ke }, { data: subjects, error: se }] = await Promise.all([
    supabase.from("academic_context").select("id,tahun_pelajaran,semester"),
    supabase.from("kelas").select("id,nama_rombel,tingkat,tahun_ajaran,semester"),
    supabase.from("mata_pelajaran").select("id,nama,kode"),
  ]);
  if (ce || ke || se) throw new Error(ce?.message || ke?.message || se?.message || "Gagal membaca master data.");
  const contextMap = new Map((contexts ?? []).map(c => [key(`${c.tahun_pelajaran} · ${c.semester}`), c]));
  const classMap = new Map<string, any>();
  for (const c of classes ?? []) { classMap.set(normalize(c.nama_rombel), c); classMap.set(normalize(c.tingkat), c); }
  const subjectByCode = new Map((subjects ?? []).filter(s => s.kode).map(s => [normalize(s.kode), s]));
  const subjectByName = new Map((subjects ?? []).map(s => [normalize(s.nama), s]));
  const seen = new Set<string>();
  return rows.map((raw, i) => {
    const ctxLabel = text(raw.AcademicContext ?? raw.academic_context ?? raw.TahunPelajaran);
    const kelasLabel = text(raw.Kelas ?? raw.kelas ?? raw.Rombel);
    const code = text(raw.KodeMapel ?? raw.kode_mapel ?? raw.Kode);
    const name = text(raw.MataPelajaran ?? raw.mata_pelajaran ?? raw.NamaMapel);
    const jpRaw = text(raw.TargetJP ?? raw.target_jp ?? raw.TargetJPPerRombel);
    const result: any = { row: i + 2, status: "valid", message: "Valid" };
    const context = contextMap.get(key(ctxLabel));
    const kelas = classMap.get(normalize(kelasLabel));
    const subject = subjectByCode.get(normalize(code)) ?? subjectByName.get(normalize(name));
    const jp = Number(jpRaw);
    if (!ctxLabel || !context) { result.status = "error"; result.message = "Academic Context tidak ditemukan."; return result; }
    if (!kelas) { result.status = "error"; result.message = "Kelas/rombel tidak ditemukan."; return result; }
    if (!subject) { result.status = "error"; result.message = "Mata Pelajaran/KodeMapel tidak ditemukan."; return result; }
    if (!Number.isInteger(jp) || jp < 0 || jp > 10) { result.status = "error"; result.message = "TargetJP harus bilangan bulat 0–10."; return result; }
    const unique = `${context.id}:${kelas.id}:${subject.id}`;
    if (seen.has(unique)) { result.status = "error"; result.message = "Duplikasi Context + Kelas + Mata Pelajaran dalam file."; return result; }
    seen.add(unique);
    result.data = { academic_context_id: context.id, kelas_id: kelas.id, mata_pelajaran_id: subject.id, target_jp: jp };
    return result;
  });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "File wajib diunggah." }, { status: 400 });
    const rows = await parse(file); if (!rows.length) return NextResponse.json({ error: "File tidak memiliki data." }, { status: 400 });
    const results = await validate(rows); return NextResponse.json({ rows, results });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal memproses file." }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json(); const rows = Array.isArray(body.rows) ? body.rows : [];
    const results = await validate(rows); const invalid = results.filter((r: any) => r.status !== "valid");
    if (invalid.length) return NextResponse.json({ error: `Import diblokir: ${invalid.length} baris tidak valid.`, results: invalid }, { status: 400 });
    const supabase = await createClient(); const payload = results.map((r: any) => r.data);

    // SAKALA MASTER RULE (Authority Matrix / Zero Duplicate Information):
    // jalur ini menulis LANGSUNG ke target_jp — authority resmi yang juga
    // ditulis Generate Kurikulum → Commit — tanpa lewat rantai verifikasi
    // sumber (curriculum_source/version/item). Ini override manual yang sah
    // (operator boleh koreksi cepat satu angka). Upsert + read-back
    // verification sekarang lewat satu fungsi bersama (upsertTargetJp) yang
    // juga dipakai Generate Kurikulum, supaya kedua jalur tidak bisa divergen.
    let beforeMap: Map<string, number>;
    try {
      const result = await upsertTargetJp(supabase, payload);
      beforeMap = result.beforeMap;
    } catch (upsertErr) {
      const message = upsertErr instanceof Error ? upsertErr.message : toPlainDatabaseError(upsertErr);
      return NextResponse.json({ error: message.startsWith("Tidak dapat") || message.startsWith("Belum bisa") ? `Import ${message.charAt(0).toLowerCase()}${message.slice(1)}` : toPlainDatabaseError(upsertErr) }, { status: 500 });
    }

    for (const p of payload as { academic_context_id: string; kelas_id: string; mata_pelajaran_id: string; target_jp: number }[]) {
      const k = `${p.academic_context_id}:${p.kelas_id}:${p.mata_pelajaran_id}`;
      await recordAuditEvent({
        supabase,
        academicContextId: p.academic_context_id,
        action: "edit",
        entityType: "target_jp",
        entityId: null,
        entityLabel: null,
        before: { targetJp: beforeMap.get(k) ?? null },
        after: { targetJp: p.target_jp },
        source: "import",
        reason: "Import/edit manual Target JP (bypass rantai verifikasi Generate Kurikulum)",
      });
    }

    return NextResponse.json({ upserted: payload.length });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Import gagal." }, { status: 500 }); }
}