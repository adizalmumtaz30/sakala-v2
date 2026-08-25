import type { SupabaseClient } from "@supabase/supabase-js";
import { listScheduleModels } from "@/lib/application/scheduleModel.usecases";
import { listKelas } from "@/lib/application/kelas.usecases";
import { listMataPelajaran } from "@/lib/application/mata-pelajaran.usecases";
import { listPembagianMengajar } from "@/lib/application/pembagianMengajar.usecases";
import { generateCandidatePreview, type GenerationResult } from "@/lib/application/candidateGenerator";
import type { GenerationRequirement } from "@/lib/domain/candidateGeneration";
import { findClosestMatch } from "@/lib/domain/fuzzyMatch";

export interface AiSchedulePlan {
  intent: "schedule_target_jp" | "schedule_full_week";
  classId: string;
  targetJp: number;
  existingJp: number;
  remainingJp: number;
  requirements: GenerationRequirement[];
  result: GenerationResult;
  explanation: string;
  needsClarification: boolean;
  clarification?: string;
  interpretedTargets?: Array<{
    subjectId: string;
    subjectName: string;
    targetJp: number;
    existingJp: number;
    remainingJp: number;
  }>;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// §35/§36 — kalau operator salah ketik/tidak baku, AI seharusnya menawarkan
// koreksi ("Maksud Anda X?"), bukan langsung gagal dengan pesan generik.
// Lihat lib/domain/fuzzyMatch.ts untuk implementasi (dipakai bersama dengan client).

function romanToArabic(value: string): string {
  const map: Record<string, string> = {
    vii: "7",
    viii: "8",
    ix: "9",
    x: "10",
    xi: "11",
    xii: "12",
  };
  return map[value.toLowerCase()] ?? value;
}

function extractClassHint(command: string): string | null {
  const match = command.match(/(?:kelas|rombel)\s+(?:[IVXLC]+|\d{1,2})(?:\s*[A-Z0-9_-]+)?/i);
  return match?.[0]?.replace(/^(kelas|rombel)\s+/i, "").trim() ?? null;
}

function classMatches(hint: string, tingkat: string, namaRombel: string): boolean {
  const h = normalize(romanToArabic(hint));
  const level = normalize(romanToArabic(String(tingkat)));
  const rombel = normalize(namaRombel);
  return h === level || h === rombel || h === `${level} ${rombel}` || h.startsWith(`${level} `);
}

function subjectAliases(name: string): string[] {
  const n = normalize(name);
  const aliases: Record<string, string[]> = {
    "alquran hadis": ["al quran hadis", "quran hadis", "al quran dan hadis", "alquran hadits", "quran hadits"],
    "akidah akhlak": ["aqidah akhlak", "akidah akhlaq", "aqidah akhlaq"],
    "sejarah kebudayaan islam": ["ski"],
    "pendidikan pancasila": ["pancasila", "ppkn"],
    "bahasa indonesia": ["b indonesia", "bahasa indo"],
    "ilmu pengetahuan alam": ["ipa", "sains"],
    "ilmu pengetahuan sosial": ["ips"],
    "bahasa inggris": ["b inggris", "english"],
    "pendidikan jasmani olahraga dan kesehatan": ["pjok", "penjas", "pjkr", "pendidikan jasmani"],
    informatika: ["tik"],
    "seni budaya": ["sbdp", "seni"],
    "mulok btq": ["btq", "baca tulis quran", "baca tulis al quran", "muatan lokal btq", "mulok"],
  };
  return [n, ...(aliases[n] ?? [])];
}

function subjectMatches(input: string, subjectName: string): boolean {
  const a = normalize(input);
  const b = normalize(subjectName);
  if (a === b || b.includes(a) || a.includes(b)) return true;
  const aliases = subjectAliases(subjectName);
  return aliases.includes(a) || aliases.some((alias) => normalize(alias) === a);
}

function parseTargetRows(command: string): Array<{ subject: string; jp: number }> {
  const rows: Array<{ subject: string; jp: number }> = [];
  const lines = command
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s\d.)-]+/, "").trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^(.+?)\s+(\d+)\s*(?:JP)?\s*$/i);
    if (!match) continue;
    const subject = match[1].replace(/[–—:]+$/, "").trim();
    const jp = Number(match[2]);
    if (subject && Number.isInteger(jp) && jp > 0 && jp <= 20) rows.push({ subject, jp });
  }
  return rows;
}

function extractSingleTargetJp(command: string): number | null {
  const match = command.match(/(?:target\s*)?(\d+)\s*jp\b/i);
  return match ? Number(match[1]) : null;
}

function requirementId(index: number): string {
  return `ai_req_${index + 1}`;
}

/**
 * AI Schedule Copilot is preview-only. Natural language identifies intent;
 * target_jp is the authoritative weekly workload source; the constraint-aware
 * candidate generator remains the sole source of truth for valid time slots.
 */
export async function planScheduleFromCommand(
  supabase: SupabaseClient,
  academicContextId: string,
  command: string
): Promise<AiSchedulePlan> {
  const [models, kelas, mapel, pembagian] = await Promise.all([
    listScheduleModels(supabase, academicContextId),
    listKelas(supabase),
    listMataPelajaran(supabase),
    listPembagianMengajar(supabase, academicContextId),
  ]);

  const model = models[0];
  if (!model) throw new Error("Belum ada Schedule Model untuk konteks akademik aktif.");

  const classHint = extractClassHint(command);
  const targetClass = classHint
    ? kelas.find((k) => classMatches(classHint, String(k.tingkat), k.namaRombel))
    : kelas.length === 1
      ? kelas[0]
      : undefined;

  if (!targetClass) {
    if (!classHint && kelas.length > 1) {
      throw new Error("Tentukan kelas/rombel terlebih dahulu karena konteks aktif memiliki lebih dari satu kelas.");
    }
    const suggestion = classHint ? findClosestMatch(classHint, kelas.map((k) => `${k.tingkat} ${k.namaRombel}`)) : null;
    throw new Error(
      suggestion
        ? `Kelas "${classHint}" tidak ditemukan. Maksud Anda "${suggestion}"?`
        : `Kelas "${classHint ?? ""}" tidak ditemukan pada konteks akademik aktif.`
    );
  }

  const activeAssignments = pembagian.filter(
    (p) => p.status === "aktif" && p.kelasId === targetClass.id,
  );
  if (activeAssignments.length === 0) {
    throw new Error(`Belum ada Pembagian Mengajar aktif untuk ${targetClass.tingkat} ${targetClass.namaRombel}.`);
  }

  // IMPORTANT: target_jp is the official source of weekly workload. The AI
  // must never reconstruct the official JP from mata_pelajaran or stale
  // Pembagian Mengajar values.
  const { data: officialTargets, error: targetError } = await supabase
    .from("target_jp")
    .select("mata_pelajaran_id,target_jp")
    .eq("academic_context_id", academicContextId)
    .eq("kelas_id", targetClass.id)
    .order("mata_pelajaran_id");

  if (targetError) throw new Error(`Gagal membaca Target JP resmi: ${targetError.message}`);
  if (!officialTargets?.length) {
    throw new Error(`Belum ada Target JP resmi untuk ${targetClass.tingkat} ${targetClass.namaRombel}. Isi Target JP terlebih dahulu.`);
  }

  const officialBySubject = new Map(
    officialTargets.map((row) => [row.mata_pelajaran_id, Number(row.target_jp)]),
  );

  const parsedRows = parseTargetRows(command);
  const explicitSubjects = parsedRows.length > 0
    ? parsedRows
        .map((row) => mapel.find((m) => subjectMatches(row.subject, m.nama)))
        .filter((subject): subject is (typeof mapel)[number] => Boolean(subject))
    : [];

  if (parsedRows.length > 0 && explicitSubjects.length !== parsedRows.length) {
    const missing = parsedRows.filter(
      (row) => !mapel.some((m) => subjectMatches(row.subject, m.nama)),
    );
    const withSuggestions = missing.map((row) => {
      const suggestion = findClosestMatch(row.subject, mapel.map((m) => m.nama));
      return suggestion ? `"${row.subject}" — maksud Anda "${suggestion}"?` : `"${row.subject}" (tidak dikenali)`;
    });
    throw new Error(`Mata pelajaran belum ditemukan di SAKALA: ${withSuggestions.join(", ")}.`);
  }

  // If the command contains a subject list, use that list only as a selector.
  // The JP values still come from target_jp. If no list is supplied, plan the
  // complete official weekly target for the selected class.
  const selectedSubjectIds = new Set(explicitSubjects.map((subject) => subject.id));
  const selectedTargets = officialTargets.filter((row) =>
    selectedSubjectIds.size === 0 || selectedSubjectIds.has(row.mata_pelajaran_id),
  );

  if (!selectedTargets.length) {
    throw new Error("Tidak ada Target JP resmi yang cocok dengan permintaan AI.");
  }

  const requirements: GenerationRequirement[] = [];
  const interpretedTargets: NonNullable<AiSchedulePlan["interpretedTargets"]> = [];
  const usedAssignmentIds = new Set<string>();

  for (const target of selectedTargets) {
    const subject = mapel.find((m) => m.id === target.mata_pelajaran_id);
    if (!subject) continue;

    const officialJp = officialBySubject.get(target.mata_pelajaran_id) ?? 0;
    const assignments = activeAssignments
      .filter((p) => p.mataPelajaranId === target.mata_pelajaran_id)
      .sort((a, b) => (b.jpTersisa ?? b.jpPerMinggu) - (a.jpTersisa ?? a.jpPerMinggu));

    if (assignments.length === 0) {
      interpretedTargets.push({
        subjectId: subject.id,
        subjectName: subject.nama,
        targetJp: officialJp,
        existingJp: 0,
        remainingJp: officialJp,
      });
      continue;
    }

    let remaining = officialJp;
    let existing = 0;

    for (const assignment of assignments) {
      const available = Math.max(0, assignment.jpTersisa ?? assignment.jpPerMinggu);
      const countedAvailable = Math.min(officialJp - existing, available);
      existing += Math.max(0, Math.min(officialJp, assignment.jpPerMinggu) - countedAvailable);

      if (remaining <= 0 || available <= 0) continue;
      const allocated = Math.min(remaining, available, officialJp);
      if (allocated <= 0) continue;

      requirements.push({
        id: requirementId(requirements.length),
        classId: assignment.kelasId,
        subjectId: assignment.mataPelajaranId,
        teacherId: assignment.guruId,
        roomId: null,
        activityType: "belajar_mengajar",
        jpTarget: allocated,
      });
      usedAssignmentIds.add(assignment.id);
      remaining -= allocated;
    }

    interpretedTargets.push({
      subjectId: subject.id,
      subjectName: subject.nama,
      targetJp: officialJp,
      existingJp: Math.min(officialJp, Math.max(0, officialJp - remaining - requirements.filter((r) => r.subjectId === subject.id).reduce((sum, r) => sum + r.jpTarget, 0))),
      remainingJp: Math.max(0, remaining),
    });
  }

  const targetJp = selectedTargets.reduce((sum, row) => sum + Number(row.target_jp), 0);
  const plannedJp = requirements.reduce((sum, item) => sum + item.jpTarget, 0);
  const existingJp = interpretedTargets.reduce((sum, item) => sum + item.existingJp, 0);
  const remainingJp = interpretedTargets.reduce((sum, item) => sum + item.remainingJp, 0);

  if (!requirements.length) {
    throw new Error("Tidak ada JP tersisa yang dapat dirancang. Target JP resmi mungkin sudah terpenuhi oleh jadwal yang ada.");
  }

  const result = await generateCandidatePreview(
    supabase,
    academicContextId,
    model.id,
    requirements,
  );

  const classLabel = `${targetClass.tingkat} ${targetClass.namaRombel}`;
  const placed = result.candidates.length;
  const summary = result.outcomes
    .map((o) => `${mapel.find((m) => m.id === o.subjectId)?.nama ?? "Mapel"}: ${o.placed}/${o.jpTarget} JP`)
    .join(" · ");
  const unresolved = Math.max(0, remainingJp - placed);
  const explicitRequest = parsedRows.length > 0;
  const singleTarget = extractSingleTargetJp(command);

  return {
    intent: explicitRequest || singleTarget ? "schedule_target_jp" : "schedule_full_week",
    classId: targetClass.id,
    targetJp,
    existingJp,
    remainingJp,
    requirements,
    result,
    explanation: explicitRequest
      ? `Target JP resmi menjadi sumber kebenaran. Saya menggunakan ${explicitSubjects.length} mata pelajaran yang diminta untuk ${classLabel}; angka JP dari perintah AI tidak menimpa angka resmi di target_jp. Total target resmi yang dipilih ${targetJp} JP, ${placed} JP berhasil dibuat sebagai candidate. ${summary}. Candidate belum mengubah jadwal committed.`
      : `Saya membaca Target JP resmi langsung dari target_jp untuk ${classLabel}: ${selectedTargets.length} mata pelajaran dengan total ${targetJp} JP/minggu. ${placed} JP berhasil dibuat sebagai candidate. ${summary}. Tidak ada perubahan ke jadwal committed.`,
    needsClarification: unresolved > 0,
    clarification: unresolved > 0
      ? `Belum seluruh target resmi dapat ditempatkan. ${unresolved} JP masih belum memiliki slot valid tanpa melanggar constraint. SAKALA tidak memaksa slot yang bentrok.`
      : undefined,
    interpretedTargets,
  };
}
