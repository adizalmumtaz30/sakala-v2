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
  intent: "schedule_target_jp";
  classId: string;
  targetJp: number;
  requirements: GenerationRequirement[];
  result: GenerationResult;
  explanation: string;
  needsClarification: boolean;
  clarification?: string;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractTargetJp(command: string): number | null {
  const match = command.match(/(?:target\s*)?(\d+)\s*jp\b/i);
  return match ? Number(match[1]) : null;
}

function extractClassHint(command: string): string | null {
  const match = command.match(/kelas\s+(?:[VIIXLC]+|\d{1,2})(?:\s*[A-Z])?/i);
  return match?.[0]?.replace(/^kelas\s+/i, "").trim() ?? null;
}

function classMatches(hint: string, tingkat: string, namaRombel: string): boolean {
  const h = normalize(hint);
  const level = normalize(tingkat);
  const rombel = normalize(namaRombel);
  if (h === level || h === rombel || `${level} ${rombel}` === h) return true;
  const roman: Record<string, string> = { "7": "vii", "8": "viii", "9": "ix", "10": "x", "11": "xi", "12": "xii" };
  return h === roman[level] || h.startsWith(`${roman[level] ?? ""} `);
}

function requirementId(index: number): string {
  return `ai_req_${index + 1}`;
}

/**
 * AI planning orchestration. The planner intentionally uses the same
 * constraint-aware candidate generator as Jadwal Cerdas. Natural language is
 * only used to understand intent; the schedule itself is never invented by
 * the language model and is never committed here.
 */
export async function planScheduleFromCommand(
  supabase: SupabaseClient,
  academicContextId: string,
  command: string
): Promise<AiSchedulePlan> {
  const targetJp = extractTargetJp(command);
  const classHint = extractClassHint(command);
  if (!targetJp || targetJp < 1 || targetJp > 40) {
    throw new Error("Saya membutuhkan target JP 1–40. Contoh: “Buatkan target 4 JP untuk Kelas 7.”");
  }
  if (!classHint) {
    throw new Error("Saya membutuhkan kelas yang dituju. Contoh: “Buatkan target 4 JP untuk Kelas 7.”");
  }

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

  const targetClass = kelas.find((k) => classMatches(classHint, String(k.tingkat), k.namaRombel));
  if (!targetClass) throw new Error(`Kelas “${classHint}” tidak ditemukan pada konteks akademik aktif.`);

  const activeAssignments = pembagian.filter((p) => p.status === "aktif" && p.kelasId === targetClass.id);
  if (activeAssignments.length === 0) {
    throw new Error(`Belum ada Pembagian Mengajar aktif untuk ${targetClass.tingkat} ${targetClass.namaRombel}.`);
  }

  // Allocate the requested JP across active teaching assignments, preferring
  // assignments with the largest JP still available. This lets a command
  // that names only a class still resolve its relevant subject/teacher pair.
  let remaining = targetJp;
  const requirements: GenerationRequirement[] = [];
  const ranked = [...activeAssignments].sort((a, b) => (b.jpTersisa ?? b.jpPerMinggu) - (a.jpTersisa ?? a.jpPerMinggu));
  ranked.forEach((item, index) => {
    if (remaining <= 0) return;
    const available = Math.max(0, item.jpTersisa ?? item.jpPerMinggu);
    if (available <= 0) return;
    const allocated = Math.min(remaining, available);
    requirements.push({
      id: requirementId(index),
      classId: item.kelasId,
      subjectId: item.mataPelajaranId,
      teacherId: item.guruId,
      roomId: null,
      activityType: "belajar_mengajar",
      jpTarget: allocated,
    });
    remaining -= allocated;
  });

  if (requirements.length === 0) throw new Error("Tidak ada JP tersisa yang dapat dijadwalkan untuk kelas tersebut.");

  const result = await generateCandidatePreview(supabase, academicContextId, model.id, requirements);
  const classLabel = `${targetClass.tingkat} ${targetClass.namaRombel}`;
  const placed = result.candidates.length;
  const summary = result.outcomes
    .map((o) => `${mapel.find((m) => m.id === o.subjectId)?.nama ?? "Mapel"} (${guru.find((g) => g.id === o.teacherId)?.namaGuru ?? "Guru"}): ${o.placed}/${o.jpTarget} JP`)
    .join(" · ");
  const roomNote = ruangan.length > 0 ? " Ruangan akan dibiarkan fleksibel jika tidak ditentukan oleh pembagian mengajar." : " Tidak ada ruangan yang tersedia untuk dipilih otomatis.";

  return {
    intent: "schedule_target_jp",
    classId: targetClass.id,
    targetJp,
    requirements,
    result,
    explanation: `Saya menemukan rancangan ${placed}/${targetJp} JP untuk ${classLabel}. ${summary}.${roomNote} Hasil ini masih candidate dan belum mengubah jadwal committed.`,
    needsClarification: placed < targetJp,
    clarification: placed < targetJp ? `Baru ${placed} dari ${targetJp} JP yang dapat ditempatkan tanpa bentrok. Saya tidak akan memaksa slot yang melanggar constraint.` : undefined,
  };
}
