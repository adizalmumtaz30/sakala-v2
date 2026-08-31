"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, User, School2, BookOpen, DoorOpen } from "lucide-react";
import { globalSearchAction } from "@/app/(shell)/search-actions";
import type { GlobalSearchResult } from "@/lib/application/globalSearch.usecases";

// Bagian 6.3 route contract — daftar route yang bisa dicari lewat Command Palette
const routes = [
  { title: "Dashboard", href: "/" },
  { title: "Guru", href: "/guru" },
  { title: "Mata Pelajaran", href: "/mata-pelajaran" },
  { title: "Kelas", href: "/kelas" },
  { title: "Ruangan", href: "/ruangan" },
  { title: "Akademik", href: "/akademik" },
  { title: "Generate Kurikulum", href: "/akademik/generate-kurikulum" },
  { title: "Target JP", href: "/pembagian-mengajar/target-jp" },
  { title: "Pembagian Mengajar", href: "/pembagian-mengajar" },
  { title: "Jadwal Cerdas", href: "/jadwal?mode=cerdas" },
  { title: "Jadwal", href: "/jadwal" },
  { title: "Analitik", href: "/analitik" },
  { title: "Riwayat", href: "/riwayat" },
  { title: "Notifikasi", href: "/notifikasi" },
  { title: "AI", href: "/ai" },
];

const TYPE_ICON: Record<GlobalSearchResult["type"], typeof User> = { guru: User, kelas: School2, mapel: BookOpen, ruangan: DoorOpen };
const TYPE_LABEL: Record<GlobalSearchResult["type"], string> = { guru: "Guru", kelas: "Kelas", mapel: "Mata Pelajaran", ruangan: "Ruangan" };

/** Event global supaya tombol search di Header (dan tempat lain kalau perlu) bisa buka palette ini tanpa perlu lifting state/context. */
export const OPEN_COMMAND_PALETTE_EVENT = "sakala:open-command-palette";

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entityResults, setEntityResults] = useState<GlobalSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setEntityResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await globalSearchAction(query);
      setEntityResults(results);
      setSearching(false);
    }, 220);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const routeResults = useMemo(
    () => routes.filter((r) => r.title.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  if (!open) return null;

  function go(href: string) {
    router.push(href);
    setOpen(false);
    setQuery("");
  }

  const hasAnyResult = routeResults.length > 0 || entityResults.length > 0;

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
          {searching ? <Loader2 size={16} className="animate-spin text-ink-400" /> : <Search size={16} className="text-ink-400" />}
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari guru, kelas, mapel, ruangan, atau halaman..."
            className="flex-1 bg-transparent text-[13.5px] text-ink-900 outline-none placeholder:text-ink-400"
          />
          <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-400">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {!hasAnyResult && !searching && (
            <p className="px-3 py-6 text-center text-[12.5px] text-ink-400">{query.trim().length >= 2 ? "Tidak ada hasil." : "Ketik minimal 2 huruf untuk mencari data guru, kelas, mapel, atau ruangan."}</p>
          )}
          {entityResults.length > 0 && (
            <div className="mb-1">
              <p className="px-3 pb-1 pt-1.5 text-[9.5px] font-bold uppercase tracking-[.08em] text-ink-300">Data</p>
              {entityResults.map((r) => {
                const Icon = TYPE_ICON[r.type];
                return (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => go(r.href)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-ink-700 hover:bg-surface-muted"
                  >
                    <Icon size={14} className="shrink-0 text-ink-400" />
                    <span className="min-w-0 flex-1 truncate">{r.label}</span>
                    {r.sublabel && <span className="shrink-0 text-[10.5px] text-ink-400">{r.sublabel}</span>}
                    <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[9px] font-semibold text-ink-400">{TYPE_LABEL[r.type]}</span>
                  </button>
                );
              })}
            </div>
          )}
          {routeResults.length > 0 && (
            <div>
              {entityResults.length > 0 && <p className="px-3 pb-1 pt-1.5 text-[9.5px] font-bold uppercase tracking-[.08em] text-ink-300">Halaman</p>}
              {routeResults.map((r) => (
                <button
                  key={r.href}
                  onClick={() => go(r.href)}
                  className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[13px] text-ink-700 hover:bg-surface-muted"
                >
                  {r.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
