import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getGuruById } from "@/lib/application/guru.usecases";
import { ErrorState, Card, Badge } from "@/components/ui/primitives";
import Avatar from "@/components/ui/Avatar";

// Detail Guru (Bagian 86-87) — informasi tambahan dilengkapi di sini setelah
// Guru dibuat cepat lewat form minimal. Statistik pengajaran/jadwal (JP, kelas,
// mapel) sengaja BELUM ditampilkan di pack ini: modul Pembagian Mengajar belum
// dibangun, dan SAKALA tidak boleh menampilkan angka dummy (Bagian 03D).

export default async function GuruDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const supabase = await createClient();
    const guru = await getGuruById(supabase, id);
    if (!guru) notFound();

    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <Link href="/guru" className="flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-ink-900">
          <ArrowLeft size={15} /> Kembali ke Guru
        </Link>

        <Card className="flex items-center gap-4">
          <Avatar name={guru.namaGuru} size="lg" />
          <div className="flex-1">
            <h1 className="text-[18px] font-bold text-ink-900">{guru.namaGuru}</h1>
            <p className="text-[12.5px] text-ink-400">{guru.kodeGuru}</p>
          </div>
          <Badge tone={guru.status === "aktif" ? "success" : "neutral"}>
            {guru.status === "aktif" ? "Aktif" : "Nonaktif"}
          </Badge>
        </Card>

        <Card>
          <h2 className="mb-3.5 text-[13px] font-semibold text-ink-900">Informasi</h2>
          <dl className="grid grid-cols-2 gap-y-3 text-[13px]">
            <dt className="text-ink-500">NIP</dt>
            <dd className="text-right text-ink-900">{guru.nip || "—"}</dd>
            <dt className="text-ink-500">NUPTK</dt>
            <dd className="text-right text-ink-900">{guru.nuptk || "—"}</dd>
            <dt className="text-ink-500">Email</dt>
            <dd className="text-right text-ink-900">{guru.email || "—"}</dd>
            <dt className="text-ink-500">Nomor Telepon</dt>
            <dd className="text-right text-ink-900">{guru.noTelepon || "—"}</dd>
          </dl>
          <p className="mt-4 text-[12px] text-ink-400">
            Untuk mengubah data, gunakan tombol Edit pada daftar Guru.
          </p>
        </Card>
      </div>
    );
  } catch {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat data guru dari Supabase. Cek koneksi dan environment variable kamu." />
      </div>
    );
  }
}
