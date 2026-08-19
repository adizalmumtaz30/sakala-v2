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

  const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-surface/85 px-8 backdrop-blur"
      style={{ height: "var(--shell-topbar-h)" }}
    >
      <button
        type="button"
        className={`flex max-w-md flex-1 items-center gap-2 rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-left text-ink-400 transition-all duration-150 hover:border-brand-600/30 hover:shadow-soft ${focusRing}`}
        aria-label="Buka pencarian global"
      >
        <Search size={16} aria-hidden="true" />
        <span className="flex-1 text-[13px]">Cari guru, jadwal, mapel...</span>
        <kbd aria-hidden="true" className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-400">⌘K</kbd>
      </button>

      <Link
        href="/akademik"
        className={`hidden items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors ${focusRing} md:flex ${
          activeContextLabel
            ? "border-border bg-surface text-ink-700 hover:border-brand-600/30"
            : "border-amber/30 bg-amber-50 text-amber hover:border-amber/50"
        }`}
      >
        <GraduationCap size={14} aria-hidden="true" />
        {activeContextLabel ?? "Konteks belum diatur"}
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <div className={`hidden items-center gap-1.5 px-2 text-[12px] font-medium md:flex ${online ? "text-emerald" : "text-rose"}`} role="status" aria-live="polite" aria-label={online ? "Status online" : "Status offline"}>
          <span className="relative flex h-2 w-2" aria-hidden="true">
            {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-60" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${online ? "bg-emerald" : "bg-rose"}`} />
          </span>
          {online ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />} {online ? "Online" : "Offline"}
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className={`group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-ink-500 shadow-sm transition-all duration-180 hover:border-brand-600/30 hover:bg-surface-muted hover:text-ink-700 ${focusRing}`}
          aria-label={dark ? "Gunakan mode terang" : "Gunakan mode gelap"}
          aria-pressed={dark}
          title={dark ? "Mode terang" : "Mode gelap"}
        >
          {dark ? <Sun size={17} strokeWidth={1.9} aria-hidden="true" /> : <Moon size={17} strokeWidth={1.9} aria-hidden="true" />}
          <span className="pointer-events-none absolute right-0 top-full z-30 mt-2 hidden whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-ink-700 shadow-lg group-hover:block">
            {dark ? "Mode terang" : "Mode gelap"}
          </span>
        </button>

        <button type="button" className={`relative flex h-11 w-11 items-center justify-center rounded-full p-2 text-ink-500 hover:bg-surface-muted ${focusRing}`} aria-label="Notifikasi">
          <Bell size={18} aria-hidden="true" />
        </button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex min-h-11 items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2 transition-colors hover:bg-surface-muted ${focusRing}`}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-controls="profile-menu"
            aria-label="Buka menu profil"
          >
            <div aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700 ring-2 ring-surface ring-offset-1 ring-offset-brand-100">
              {schoolProfileNama ? initialsOf(schoolProfileNama) : "?"}
            </div>
            <ChevronDown size={15} className="text-ink-400" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div id="profile-menu" role="menu" className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
              <Link role="menuitem" href="/akademik" onClick={() => setMenuOpen(false)} className={`block rounded-lg px-3 py-3 text-[13px] text-ink-700 hover:bg-surface-muted ${focusRing}`}>
                Profil Admin Sekolah
              </Link>
              <div className="my-1 border-t border-border" aria-hidden="true" />
              <button type="button" role="menuitem" onClick={toggleTheme} className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-ink-700 hover:bg-surface-muted ${focusRing}`}>
                {dark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
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
