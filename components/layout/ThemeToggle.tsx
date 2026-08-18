"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("sakala-theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-surface text-ink-500 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-muted hover:text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand/25"
      aria-label={dark ? "Gunakan tema terang" : "Gunakan tema gelap"}
      title={dark ? "Tema terang" : "Tema gelap"}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
