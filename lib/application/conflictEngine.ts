// Application layer — orchestration lintas-entity. Conflict Engine (Bagian
// 23/86) TIDAK bisa jadi bagian Domain layer murni karena butuh data entity
// lain (assignment lain, slot template, status aktif guru/kelas/ruangan) —
// itu tanggung jawab Data Access, yang hanya boleh dipanggil dari sini.
//
// validateAssignmentCandidate() adalah pintu masuk TUNGGAL Conflict Engine —
// dipanggil oleh scheduleAssignment.usecases.ts sebelum create/update/commit.
// Bagian 68 (Aturan Absolut): "BLOCKING CONFLICT wajib mencegah commit."

import type { SupabaseClient } from "@supabase/supabase-js";
import { guruRepository } from "@/lib/data-access/guru.repository";
import { kelasRepository } from "@/lib/data-access/kelas.repository";
import { ruanganRepository } from "@/lib/data-access/ruangan.repository";
import { mataPelajaranRepository } from "@/lib/data-access/mata-pelajaran.repository";
import { jamPelajaranRepository } from "@/lib/data-access/jamPelajaran.repository";
import { slotTemplateRepository } from "@/lib/data-access/slotTemplate.repository";
import { scheduleModelRepository } from "@/lib/data-access/scheduleModel.repository";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import { pembagianMengajarRepository } from "@/lib/data-access/pembagianMengajar.repository";
import { isFixedSlot } from "@/lib/domain/slotTemplate";
import { periodsOverlap, type ScheduleAssignmentDraft } from "@/lib/domain/scheduleAssignment";
import { summarizeJp } from "@/lib/domain/pembagianMengajar";
import { isBlockingSeverity, nextConflictId, toJpReconciliationState, type ScheduleConflict } from "@/lib/domain/conflict";

/**
 * Menjalankan seluruh pengecekan Bagian 22 (invariant) terhadap satu
 * kandidat assignment (baru atau hasil edit) dan mengembalikan daftar
 * conflict terstruktur (Bagian 23). excludeId dipakai saat validasi UPDATE
 * supaya assignment tidak dianggap konflik dengan dirinya sendiri.
 *
 * Engine ini TIDAK menolak/melempar error sendiri — pemanggil (usecases)
 * yang memutuskan apa yang boleh terjadi berdasarkan hasil (lihat
 * assertNoBlockingConflicts di scheduleAssignment.usecases.ts), supaya UI
 * (step 14/15 nanti) tetap bisa menampilkan Warning/Info tanpa mencegah draft.
 */
export async function validateAssignmentCandidate(
  supabase: SupabaseClient,
  draft: ScheduleAssignmentDraft,
  excludeId?: string
): Promise<ScheduleConflict[]> {
  const conflicts: ScheduleConflict[] = [];

  const [
    scheduleModel,
    jamPelajaranList,
    slotTemplates,
    siblingAssignments,
    guruList,
    kelasList,
    mapelList,
    ruanganList,
  ] = await Promise.all([
    scheduleModelRepository.findById(supabase, draft.scheduleModelId),
    jamPelajaranRepository.findByContext(supabase, draft.academicContextId),
    slotTemplateRepository.findByModel(supabase, draft.scheduleModelId),
    scheduleAssignmentRepository.findActiveByContextAndDay(supabase, draft.academicContextId, draft.day, excludeId),
    guruRepository.findAll(supabase),
    kelasRepository.findAll(supabase),
    mataPelajaranRepository.findAll(supabase),
    ruanganRepository.findAll(supabase),
  ]);

  // --- CONTEXT_MISMATCH (Bagian 23.2) — Schedule Model wajib milik konteks yang sama. ---
  if (!scheduleModel) {
    conflicts.push(
      makeConflict("error", "MISSING_REQUIRED_FIELD", "schedule", [draft.scheduleModelId], [], "Schedule Model tidak ditemukan.", "Pilih Schedule Model yang valid.")
    );
    // Tanpa Schedule Model, sisa pengecekan (room mode, hari aktif) tidak bisa dilakukan — hentikan di sini.
    return conflicts;
  }
  if (scheduleModel.academicContextId !== draft.academicContextId) {
    conflicts.push(
      makeConflict(
        "error",
        "CONTEXT_MISMATCH",
        "schedule",
        [scheduleModel.id],
        [],
        "Schedule Model yang dipilih berasal dari konteks akademik yang berbeda.",
        "Pilih Schedule Model yang termasuk konteks akademik aktif."
      )
    );
  }

  // --- INVALID_PERIOD (Bagian 23.2) — hari wajib termasuk hari aktif model,
  // dan setiap nomor urut dalam rentang periodStart..periodEnd wajib
  // terdaftar di Jam Pelajaran (Phase 04) untuk hari tersebut. ---
  if (!scheduleModel.hariAktif.includes(draft.day)) {
    conflicts.push(
      makeConflict("error", "INVALID_PERIOD", "schedule", [], [], `Hari "${draft.day}" bukan hari aktif pada Schedule Model ini.`, "Pilih hari yang termasuk hari aktif model, atau ubah konfigurasi Schedule Model.")
    );
  }
  const jpNomorUrutHariIni = new Set(
    jamPelajaranList.filter((jp) => jp.hari === draft.day && jp.jenis === "pembelajaran").map((jp) => jp.nomorUrut)
  );
  const periodRange = rangeInclusive(draft.periodStart, draft.periodEnd);
  const missingPeriods = periodRange.filter((n) => !jpNomorUrutHariIni.has(n));
  if (missingPeriods.length > 0) {
    conflicts.push(
      makeConflict(
        "error",
        "INVALID_PERIOD",
        "schedule",
        [],
        [],
        `Periode ${missingPeriods.join(", ")} tidak terdaftar sebagai Jam Pelajaran "pembelajaran" pada hari ${draft.day}.`,
        "Tambahkan Jam Pelajaran yang sesuai di Akademik Core, atau sesuaikan rentang periode."
      )
    );
  }

  // --- FIXED_SLOT (Bagian 22.4) — periode yang tumpang tindih dengan Slot
  // Template fixed (selain "belajar_mengajar") tidak boleh diisi assignment
  // biasa. Assignment yang memang sengaja activityType-nya sama dengan slot
  // fixed tersebut (mis. menjadwalkan Upacara eksplisit) tidak dianggap konflik. ---
  const fixedSlotsHariIni = slotTemplates.filter((s) => s.hari === draft.day && isFixedSlot(s.jenisSlot));
  for (const slot of fixedSlotsHariIni) {
    const overlaps = periodRange.includes(slot.nomorUrut);
    if (overlaps && draft.activityType === "belajar_mengajar") {
      conflicts.push(
        makeConflict(
          "error",
          "FIXED_SLOT",
          "slot",
          [slot.id],
          [],
          `Periode ${slot.nomorUrut} pada hari ${draft.day} adalah slot tetap (${slot.jenisSlot}) — tidak bisa diisi pengajaran biasa.`,
          "Pilih periode lain, atau ubah jenis aktivitas assignment ini agar sesuai slot tetap."
        )
      );
    }
  }

  // --- TEACHER_OVERLAP / CLASS_OVERLAP / ROOM_OVERLAP (Bagian 22.1-22.3) ---
  for (const sibling of siblingAssignments) {
    if (!periodsOverlap(draft.periodStart, draft.periodEnd, sibling.periodStart, sibling.periodEnd)) continue;

    if (sibling.teacherId === draft.teacherId) {
      conflicts.push(
        makeConflict(
          "error",
          "TEACHER_OVERLAP",
          "teacher",
          [draft.teacherId],
          [sibling.id],
          `Guru sudah mengajar kelas lain pada periode ${sibling.periodStart}-${sibling.periodEnd} hari ${draft.day}.`,
          "Pilih guru lain, atau ubah periode agar tidak tumpang tindih."
        )
      );
    }
    if (sibling.classId === draft.classId) {
      conflicts.push(
        makeConflict(
          "error",
          "CLASS_OVERLAP",
          "class",
          [draft.classId],
          [sibling.id],
          `Kelas sudah memiliki mata pelajaran lain pada periode ${sibling.periodStart}-${sibling.periodEnd} hari ${draft.day}.`,
          "Ubah periode, atau hapus/pindahkan assignment yang bentrok terlebih dahulu."
        )
      );
    }
    // Bagian 22.3 — room conflict hanya berlaku kalau room mode Schedule Model bukan "tidak_dipakai".
    if (scheduleModel.modeRuangan !== "tidak_dipakai" && draft.roomId && sibling.roomId === draft.roomId) {
      conflicts.push(
        makeConflict(
          "error",
          "ROOM_OVERLAP",
          "room",
          [draft.roomId],
          [sibling.id],
          `Ruangan sudah dipakai kelas lain pada periode ${sibling.periodStart}-${sibling.periodEnd} hari ${draft.day}.`,
          "Pilih ruangan lain, atau ubah periode."
        )
      );
    }
  }

  // --- MISSING_REQUIRED_FIELD (Bagian 20.1 / 23.2) — room mode "wajib" mengharuskan roomId terisi;
  // "tidak_dipakai" mengharuskan roomId kosong (bukan diinfer). ---
  if (scheduleModel.modeRuangan === "wajib" && !draft.roomId) {
    conflicts.push(
      makeConflict("error", "MISSING_REQUIRED_FIELD", "room", [], [], "Schedule Model ini mewajibkan ruangan, tapi assignment belum memilih ruangan.", "Pilih ruangan untuk assignment ini.")
    );
  }
  if (scheduleModel.modeRuangan === "tidak_dipakai" && draft.roomId) {
    conflicts.push(
      makeConflict("warning", "MISSING_REQUIRED_FIELD", "room", [], [], "Schedule Model ini tidak memakai ruangan, tapi assignment mengisi ruangan.", "Kosongkan ruangan, atau ubah room mode Schedule Model.")
    );
  }

  // --- INACTIVE_ENTITY (Bagian 22.6) — guru/kelas/mapel/ruangan nonaktif
  // tidak boleh dipakai di assignment BARU berstatus committed. Untuk
  // draft/candidate, hanya warning (supaya tetap bisa disusun sebagai
  // rencana) — hard block khusus di jalur commit (lihat usecases). ---
  const guru = guruList.find((g) => g.id === draft.teacherId);
  const kelas = kelasList.find((k) => k.id === draft.classId);
  const mapel = mapelList.find((m) => m.id === draft.subjectId);
  const ruangan = draft.roomId ? ruanganList.find((r) => r.id === draft.roomId) : null;

  if (guru && guru.status === "nonaktif") {
    conflicts.push(inactiveConflict("teacher", guru.id, "Guru", draft.status));
  }
  if (kelas && kelas.status === "nonaktif") {
    conflicts.push(inactiveConflict("class", kelas.id, "Kelas", draft.status));
  }
  if (mapel && mapel.status === "nonaktif") {
    conflicts.push(inactiveConflict("subject", mapel.id, "Mata pelajaran", draft.status));
  }
  if (ruangan && ruangan.status === "nonaktif") {
    conflicts.push(inactiveConflict("room", ruangan.id, "Ruangan", draft.status));
  }

  // --- JP_MISMATCH (Bagian 22.5) — target JP per minggu (Pembagian Mengajar,
  // Bagian 35-36/72-75) vs jadwal yang SUDAH COMMITTED untuk kombinasi
  // Guru+Mapel+Kelas yang sama. Spesifikasi eksplisit bunyinya "committed
  // schedule must reconcile" — sengaja HANYA dievaluasi saat kandidat ini
  // sendiri berstatus "committed", supaya menyusun draft/candidate secara
  // bertahap tidak berisik dengan warning "belum lengkap" tiap nambah baris
  // (Jadwal Cerdas sudah menampilkan JP tersisa live, lihat
  // app/jadwal-cerdas/JadwalCerdasWorkspace.tsx). Hanya berlaku untuk
  // activityType "belajar_mengajar" — aktivitas tetap (Upacara dll.) tidak
  // punya target JP. Kombinasi tanpa Pembagian Mengajar aktif dilewati
  // (additive by design, bukan semua assignment wajib punya target).
  if (draft.activityType === "belajar_mengajar" && draft.status === "committed") {
    const target = await pembagianMengajarRepository.findActiveByCombination(
      supabase,
      draft.academicContextId,
      draft.teacherId,
      draft.subjectId,
      draft.classId
    );
    if (target) {
      const semuaAssignmentKonteks = await scheduleAssignmentRepository.findByContext(supabase, draft.academicContextId);
      const jpCommittedLain = semuaAssignmentKonteks
        .filter(
          (a) =>
            a.id !== excludeId &&
            a.status === "committed" &&
            a.teacherId === draft.teacherId &&
            a.subjectId === draft.subjectId &&
            a.classId === draft.classId
        )
        .reduce((sum, a) => sum + (a.periodEnd - a.periodStart + 1), 0);
      const totalJpCommitted = jpCommittedLain + (draft.periodEnd - draft.periodStart + 1);
      const { jpTersisa, status } = summarizeJp(target.jpPerMinggu, totalJpCommitted);
      const state = toJpReconciliationState(status);

      if (state === "over") {
        conflicts.push(
          makeConflict(
            "warning",
            "JP_MISMATCH",
            "schedule",
            [],
            [],
            `Total JP committed untuk kombinasi Guru+Mapel+Kelas ini menjadi ${totalJpCommitted} JP, melebihi target ${target.jpPerMinggu} JP/minggu di Pembagian Mengajar.`,
            "Kurangi rentang periode assignment ini, arsipkan/pindahkan assignment committed lain pada kombinasi yang sama, atau naikkan Target JP per Minggu di Pembagian Mengajar."
          )
        );
      } else if (state === "incomplete") {
        conflicts.push(
          makeConflict(
            "info",
            "JP_MISMATCH",
            "schedule",
            [],
            [],
            `Setelah commit ini, kombinasi Guru+Mapel+Kelas mencapai ${totalJpCommitted} dari target ${target.jpPerMinggu} JP/minggu (sisa ${jpTersisa} JP belum committed).`,
            "Tambahkan assignment committed lain untuk kombinasi ini sampai target JP terpenuhi, atau abaikan kalau memang sengaja dijadwalkan bertahap."
          )
        );
      }
      // state === "complete" — target pas terpenuhi, tidak ada conflict.
    }
  }

  return conflicts;
}

function inactiveConflict(entityType: ScheduleConflict["entityType"], entityId: string, label: string, status: ScheduleAssignmentDraft["status"]): ScheduleConflict {
  // Bagian 22.6 — blocking penuh hanya untuk assignment baru yang langsung committed;
  // draft/candidate diizinkan sebagai warning supaya proses penyusunan tetap fleksibel.
  const severity = status === "committed" ? "error" : "warning";
  return makeConflict(
    severity,
    "INACTIVE_ENTITY",
    entityType,
    [entityId],
    [],
    `${label} berstatus nonaktif.`,
    `Aktifkan kembali ${label.toLowerCase()} tersebut, atau pilih ${label.toLowerCase()} lain.`
  );
}

function makeConflict(
  severity: ScheduleConflict["severity"],
  type: ScheduleConflict["type"],
  entityType: ScheduleConflict["entityType"],
  entityIds: string[],
  scheduleIds: string[],
  message: string,
  resolutionHint: string
): ScheduleConflict {
  return {
    conflictId: nextConflictId(),
    severity,
    type,
    entityType,
    entityIds,
    scheduleIds,
    message,
    resolutionHint,
    blocking: isBlockingSeverity(severity),
  };
}

function rangeInclusive(start: number, end: number): number[] {
  const out: number[] = [];
  for (let n = start; n <= end; n += 1) out.push(n);
  return out;
}
