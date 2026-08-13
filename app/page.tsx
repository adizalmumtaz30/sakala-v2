import Link from "next/link";
import { Check, Circle, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/primitives";

// Bagian 2 — Master Build Pipeline. Dashboard sengaja BELUM dibangun
// ("Dashboard tidak dibangun sebagai langkah pertama") — halaman ini
// menggantikannya sementara sebagai status build yang jujur.
const pipeline = [
  { step: "01", label: "Governance & Source of Truth", done: true },
  { step: "02", label: "Product / IA Contract", done: true },
  { step: "03", label: "Technical Foundation", done: true },
  { step: "04", label: "Design Tokens", done: true },
  { step: "05", label: "Application Shell", done: true },
  { step: "06", label: "Foundation Components", done: true },
  { step: "07", label: "Surface / Data / Form Systems", done: true },
  { step: "08", label: "State / Feedback / Recovery System", done: true },
  { step: "09", label: "Academic Context + Admin Profile", done: true, href: "/akademik" },
  { step: "10", label: "Core Data — Guru", done: true, href: "/guru" },
  { step: "10", label: "Core Data — Mata Pelajaran", done: true, href: "/mata-pelajaran" },
  { step: "10", label: "Core Data — Kelas", done: true, href: "/kelas" },
  { step: "10", label: "Core Data — Ruangan", done: true, href: "/ruangan" },
  { step: "11", label: "Akademik Core — Periode Akademik", done: true, href: "/akademik" },
  { step: "11", label: "Akademik Core — Jam Pelajaran", done: true, href: "/akademik" },
  { step: "12–13", label: "Schedule Model + Validation Engine", done: false },
  { step: "14", label: "Jadwal Cerdas", done: false },
  { step: "15", label: "Jadwal Operational Workspace", done: false },
  { step: "16", label: "Dashboard", done: false },
];

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 pt-6">
      <div>
        <h1 className="text-[20px] font-bold text-ink-900">Status Build — SAKALA V2</h1>
        <p className="text-[13px] text-ink-500">
          Mengikuti Master Build Pipeline (Bagian 2/69). Dashboard baru dibangun setelah data,
          state, dan komponen inti stabil. Status terkini: <strong>Phase 04 selesai</strong> — Akademik Core (Periode Akademik & Jam Pelajaran per konteks aktif).
        </p>
      </div>

      <Card>
        <div className="flex flex-col divide-y divide-border">
          {pipeline.map((p, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              {p.done ? (
                <Check size={16} className="shrink-0 text-emerald" />
              ) : (
                <Circle size={14} className="ml-0.5 shrink-0 text-ink-300" />
              )}
              <span className="w-10 shrink-0 text-[11px] font-mono text-ink-300">{p.step}</span>
              <span className={`flex-1 text-[13px] ${p.done ? "text-ink-900" : "text-ink-400"}`}>{p.label}</span>
              {p.href && (
                <Link href={p.href} className="flex items-center gap-1 text-[12px] font-medium text-brand-600 hover:text-brand-700">
                  Buka <ArrowRight size={13} />
                </Link>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
