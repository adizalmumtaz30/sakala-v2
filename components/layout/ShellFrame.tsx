"use client";

import { useEffect, useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";

const COLLAPSE_KEY = "sakala:sidebar-collapsed";
export const SIDEBAR_WIDE = 240;
export const SIDEBAR_NARROW = 68;

export default function ShellFrame({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed, hydrated]);

  const width = collapsed ? SIDEBAR_NARROW : SIDEBAR_WIDE;

  return (
    <>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex flex-1 flex-col transition-[margin-left] duration-200 ease-out" style={{ marginLeft: width }}>
        {children}
      </div>
    </>
  );
}
