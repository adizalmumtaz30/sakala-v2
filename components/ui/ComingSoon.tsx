import { Construction } from "lucide-react";

export default function ComingSoon({ title, step }: { title: string; step: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 pt-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber">
        <Construction size={20} />
      </div>
      <h1 className="text-[16px] font-semibold text-ink-900">{title}</h1>
      <p className="text-[13px] text-ink-500">
        Belum dibangun — menyusul di {step} pada Master Build Pipeline.
      </p>
    </div>
  );
}
