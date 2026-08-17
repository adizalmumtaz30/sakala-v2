import type { SupabaseClient } from "@supabase/supabase-js";
import { listScheduleModels } from "@/lib/application/scheduleModel.usecases";
import { listGuru } from "@/lib/application/guru.usecases";
import { listKelas } from "@/lib/application/kelas.usecases";
import { listMataPelajaran } from "@/lib/application/mata-pelajaran.usecases";
import { listRuangan } from "@/lib/application/ruangan.usecases";
import { listPembagianMengajar } from "@/lib/application/pembagianMengajar.usecases";
import { generateCandidatePreview, type GenerationResult } from "@/lib/application/candidateGenerator";
import type { GenerationRequirement } from "@/lib/domain/candidateGeneration";

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
  interpretedTargets?: Array<{ subjectId: string; subjectName: string; targetJp: number; existingJp: number; remainingJp: number }>;
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

function romanToArabic(value: string): string {
  const map: Record<string, string> = { vii: "7", viii: "8", ix: "9", x: "10", xi: "11", xii: "12" };
  return map[value.toLowerCase()] ?? value;
}

function extractClassHint(command: string): string | null {
  const match = command.match(/(?:kelas|rombel)\s+(?:[IVXLC]+|\d{1,2})(?:\s*[A-Z0-9_-]+)?/i);
  if (!match) return null;
  return match[0].replace(/^(kelas|rombel)\s+/i, "").trim();
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
    "sejarah kebudayaan islam": ["ski", "sejarah kebudayaan islam ski"],
    "pendidikan pancasila": ["pancasila", "ppkn", "pendidikan pancasila ppkn"],
    "bahasa indonesia": ["b indonesia", "bahasa indo"],
    "ilmu pengetahuan alam": ["ipa", "sains"],
    "ilmu pengetahuan sosial": ["ips"],
    "bahasa inggris": ["b inggris", "english"],
    "pendidikan jasmani olahraga dan kesehatan": ["pjok", "penjas", "pjkr", "pendidikan jasmani"],
    "informatika": ["tik", "teknologi informasi dan komunikasi"],
    "seni budaya": ["sbdp", "seni"],
    "mulok btq": ["btq", "baca tulis quran", "baca tulis al quran", "muatan lokal btq", "mulok"],
  };
  return [n, ...(aliases[n] ?? [])];
}

function subjectMatches(input: string, subjectName: string): boolean {
  const a = normalize(input);
  const b = normalize(subjectName);
  if (a === b || b.includes(a) || a.includes(b)) return true;
  const known = Object.entries({
    "alquran hadis": ["quran hadis", "quran hadits", "al quran hadis"],
    "akidah akhlak": ["aqidah akhlak", "akidah akhlaq"],
    "sejarah kebudayaan islam": ["ski"],
    "pendidikan pancasila": ["ppkn", "pancasila"],
    "ilmu pengetahuan alam": ["ipa", "sains"],
    "ilmu pengetahuan sosial": ["ips"],
    "pendidikan jasmani olahraga dan kesehatan": ["pjok", "penjas"],
    "informatika": ["tik"],
    "seni budaya": ["sbdp"],
    "mulok btq": ["btq", "mulok"],
  } as Record<string, string[]>);
  return Object.entries(known).some(([canonical, aliases]) =>
    aliases.includes(a) && (b === canonical || b.includes(canonical) || canonical.includes(b))
  );
}

function parseTargetRows(command: string): Array<{ subject: string; jp: number }> {
  const rows: Array<{ subject: string; jp: number }> = [];
  const lines = command.split(/\r?\n/).map((line) => line.replace(/^[\s\d.)-]+/, "").trim()).filter(Boolean);
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
 * Natural language is used only to understand the user's intent. All actual
 * slot selection is delegated to the existing constraint-aware candidate
 * generator. The planner is preview-only and never commits a schedule.
 */
export async function planScheduleFromCommand(
  supabase: SupabaseClient,
  academicContextId: string,
  command: string
): Promise<AiSchedulePlan> {
  const [models, guru, kelas, mapel, ruangan, pembagian] = await Promise.all([
    listScheduleModels(supabase, academicContextId),
    listGuru(supabase),
    listKelas(supabase),
    listMataPelajaran(supabase),
    listRuangan(supabase),
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
      throw new Error("Saya sudah memahami data target JP-nya. Tinggal tentukan kelas yang menjadi tujuan karena ada lebih dari satu kelas dalam konteks aktif.");
    }
    throw new Error(`Kelas “${classHint ?? ""}” tidak ditemukan pada konteks akademik aktif.`);
  }

  const activeAssignments = pembagian.filter((p) => p.status === "aktif" && p.kelasId === targetClass.id);
  if (activeAssignments.length === 0) {
    throw new Error(`Belum ada Pembagian Mengajar aktif untuk ${targetClass.tingkat} ${targetClass.namaRombel}.`);
  }

  const parsedRows = parseTargetRows(command);
  const bulkMode = parsedRows.length >= 2;
  const singleTarget = extractSingleTargetJp(command);

  const requirements: GenerationRequirement[] = [];
  const interpretedTargets: AiSchedulePlan["interpretedTargets"] = [];
  const usedAssignmentIds = new Set<string>();

  if (bulkMode) {
    for (const row of parsedRows) {
      const subject = mapel.find((m) => subjectMatches(row.subject, m.nama));
      if (!subject) throw new Error(`Mata pelajaran “${row.subject}” belum ditemukan di data SAKALA.`);
      const assignments = activeAssignments
        .filter((p) => p.mataPelajaranId === subject.id)
        .sort((a, b) => (b.jpTersisa ?? b.jpPerMinggu) - (a.jpTersisa ?? a.jpPerMinggu));
      if (assignments.length === 0) throw new Error(`Belum ada Pembagian Mengajar aktif untuk ${subject.nama} pada kelas ${targetClass.tingkat} ${targetClass.namaRombel}.`);

      let remaining = row.jp;
      let existing = 0;
      for (const assignment of assignments) {
        const available = Math.max(0, assignment.jpTersisa ?? assignment.jpPerMinggu);
        const existingForAssignment = Math.max(0, assignment.jpPerMinggu - available);
        existing += existingForAssignment;
        if (remaining <= 0 || available <= 0) continue;
        const allocated = Math.min(remaining, available);
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
      interpretedTargets.push({ subjectId: subject.id, subjectName: subject.nama, targetJp: row.jp, existingJp: Math.min(existing, row.jp), remainingJp: Math.max(0, remaining) });
    }
  } else {
    if (!singleTarget || singleTarget < 1 || singleTarget > 40) {
      throw new Error("Saya belum menemukan target JP yang dapat dipahami. Anda pode memberikan daftar mapel dan JP langsung; tidak diperlukan format perintah khusus.");
    }
    let remaining = singleTarget;
    const ranked = [...activeAssignments].sort((a, b) => (b.jpTersisa ?? b.jpPerMinggu) - (a.jpTersisa ?? a.jpPerMinggu));
    for (const assignment of ranked) {
      if (remaining <= 0) break;
      const available = Math.max(0, assignment.jpTersisa ?? assignment.jpPerMinggu);
      if (!available) continue;
      const allocated = Math.min(remaining, available);
      requirements.push({ id: requirementId(requirements.length), classId: assignment.kelasId, subjectId: assignment.mataPelajaranId, teacherId: assignment.guruId, roomId: null, activityType: "belajar_mengajar", jpTarget: allocated });
      usedAssignmentIds.add(assignment.id);
      remaining -= allocated;
    }
  }

  const targetJp = bulkMode ? parsedRows.reduce((sum, row) => sum + row.jp, 0) : singleTarget!;
  const existingJp = bulkMode ? interpretedTargets!.reduce((sum, item) => sum + item.existingJp, 0) : 0;
  const remainingJp = requirements.reduce((sum, item) => sum + item.jpTarget, 0);

  if (!requirements.length) throw new Error("Tidak ada JP yang masih perlu dijadwalkan untuk kelas tersebut.");

  // The same generator used by Jadwal Cerdas is the source of truth for slot
  // validity. Existing committed occupancy is loaded by that generator, so
  // the AI can fill a partially populated timetable without overwriting it.
  const result = await generateCandidatePreview(supabase, academicContextId, model.id, requirements);
  const classLabel = `${targetClass.tingkat} ${targetClass.namaRombel}`;
  const placed = result.candidates.length;
  const summary = result.outcomes
    .map((o) => `${mapel.find((m) => m.id === o.subjectId)?.nama ?? "Mapel"}: ${o.placed}/${o.jpTarget} JP`)
    .join(" · ");
  const unresolved = Math.max(0, targetJp - existingJp - placed);
  const assignmentCount = usedAssignmentIds.size;

  return {
    intent: bulkMode ? "schedule_full_week" : "schedule_target_jp",
    classId: targetClass.id,
    targetJp,
    existingJp,
    remainingJp,
    requirements,
    result,
    explanation: bulkMode
      ? `Saya memahami ${parsedRows.length} mata pelajaran dengan total target ${targetJp} JP untuk ${classLabel}. ${existingJp} JP sudah terwakili oleh jadwal/pembagian yang ada; ${placed} JP berhasil dirancang pada slot yang tersedia. ${summary} Candidate ini memakai ${assignmentCount} Pembagian Mengajar dan belum mengubah jadwal committed.${ruangan.length ? " Ruang tetap dipilih oleh engine sesuai ketersediaan/constraint." : " Tidak ada data ruangan aktif yang tersedia."}`
      : `Saya menemukan rancangan ${placed}/${targetJp} JP untuk ${classLabel}. ${summary}. Hasil masih candidate dan belum mengubah jadwal committed.`,
    needsClarification: unresolved > 0,
    clarification: unresolved > 0
      ? `Belum seluruh target dapat ditempatkan. ${unresolved} JP masih belum memiliki slot yang valid tanpa melanggar constraint. Saya tidak akan memaksa slot yang bentrok.`
      : undefined,
    interpretedTargets,
  };
}
