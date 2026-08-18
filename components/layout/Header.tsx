"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Bell, ChevronDown, Wifi, WifiOff, GraduationCap, Moon, Sun } from "lucide-react";

function initialsOf(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}

export default function Header({
  schoolProfileNama,
  activeContextLabel,
}: {
  schoolProfileNama: string | null;
  activeContextLabel: string | null;
}) {
  const online = useOnlineStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("sakala-theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-surface/85 px-8 backdrop-blur"
      style={{ height: "var(--shell-topbar-h)" }}
    >
      <button className="flex max-w-md flex-1 items-center gap-2 rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-left text-ink-400 transition-all duration-150 hover:border-brand-600/30 hover:shadow-soft focus:border-brand-600/40 focus:shadow-soft focus:outline-none">
        <Search size={16} />
        <span className="flex-1 text-[13px]">Cari guru, jadwal, mapel...</span>
        <kbd className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-400">⌘K</kbd>
      </button>

      <Link
        href="/akademik"
        className={`hidden items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors md:flex ${
          activeContextLabel
            ? "border-border bg-surface text-ink-700 hover:border-brand-600/30"
            : "border-amber/30 bg-amber-50 text-amber hover:border-amber/50"
        }`}
      >
        <GraduationCap size={14} />
        {activeContextLabel ?? "Konteks belum diatur"}
      </Link>

      <div className="ml-auto flex items-center gap-3">
        <div className={`hidden items-center gap-1.5 px-2 text-[12px] font-medium md:flex ${online ? "text-emerald" : "text-rose"}`}>
          <span className="relative flex h-2 w-2">
            {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-60" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${online ? "bg-emerald" : "bg-rose"}`} />
          </span>
          {online ? <Wifi size={14} /> : <WifiOff size={14} />} {online ? "Online" : "Offline"}
        </div>

        <button className="relative rounded-full p-2 text-ink-500 hover:bg-surface-muted" aria-label="Notifikasi">
          <Bell size={18} />
        </button>

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2 transition-colors hover:bg-surface-muted"
            aria-expanded={menuOpen}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700 ring-2 ring-surface ring-offset-1 ring-offset-brand-100">
              {schoolProfileNama ? initialsOf(schoolProfileNama) : "?"}
            </div>
            <ChevronDown size={15} className="text-ink-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
              <Link href="/akademik" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-[13px] text-ink-700 hover:bg-surface-muted">
                Profil Admin Sekolah
              </Link>
              <div className="my-1 border-t border-border" />
              <button type="button" onClick={toggleTheme} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-ink-700 hover:bg-surface-muted">
                {dark ? <Sun size={15} /> : <Moon size={15} />}
                <span className="flex-1">Tampilan</span>
                <span className="text-xs text-ink-400">{dark ? "Gelap" : "Terang"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
