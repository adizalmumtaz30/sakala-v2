"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

// Bagian 6.3 route contract — daftar route yang bisa dicari lewat Command Palette
const routes = [
  { title: "Dashboard", href: "/" },
  { title: "Guru", href: "/guru" },
  { title: "Mata Pelajaran", href: "/mata-pelajaran" },
  { title: "Kelas", href: "/kelas" },
  { title: "Ruangan", href: "/ruangan" },
  { title: "Akademik", href: "/akademik" },
  { title: "Jadwal Cerdas", href: "/jadwal-cerdas" },
  { title: "Jadwal", href: "/jadwal" },
  { title: "Analitik", href: "/analitik" },
  { title: "Riwayat", href: "/riwayat" },
  { title: "Notifikasi", href: "/notifikasi" },
  { title: "AI", href: "/ai" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(
    () => routes.filter((r) => r.title.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-900/30 pt-[15vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl2 border border-border bg-surface shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
          <Search size={16} className="text-ink-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari route, guru, jadwal, mapel..."
            className="flex-1 bg-transparent text-[13.5px] text-ink-900 outline-none placeholder:text-ink-400"
          />
          <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-400">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-[12.5px] text-ink-400">Tidak ada hasil.</p>
          )}
          {results.map((r) => (
            <button
              key={r.href}
              onClick={() => {
                router.push(r.href);
                setOpen(false);
                setQuery("");
              }}
              className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[13px] text-ink-700 hover:bg-surface-muted"
            >
              {r.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
