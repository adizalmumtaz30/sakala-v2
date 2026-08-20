"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({ reset }: { reset: () => void }) {
  useEffect(() => {
    // Keep the error surface intentionally quiet; retry is the primary recovery action.
  }, []);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-3xl items-center px-4 py-10">
      <section role="alert" className="w-full rounded-[20px] border border-border/70 bg-surface p-6 text-center shadow-[0_8px_30px_rgba(15,23,42,.06)] sm:p-8">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          <AlertTriangle size={18} />
        </span>
        <h1 className="mt-4 text-base font-semibold text-ink-900">Dashboard belum dapat dimuat</h1>
        <p className="mx-auto mt-1.5 max-w-md text-[11px] leading-5 text-ink-500">
          Terjadi kendala saat mengambil data Dashboard. Coba lagi untuk memuat ulang konteks akademik aktif.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-5 inline-flex items-center gap-2 rounded-[11px] bg-brand-600 px-3.5 py-2.5 text-[10px] font-semibold text-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35"
        >
          <RefreshCw size={13} />
          Coba lagi
        </button>
      </section>
    </main>
  );
}
