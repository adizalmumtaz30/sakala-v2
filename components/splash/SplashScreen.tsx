"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// Bagian 42 & 76 — SPLASHSCREEN STATE MACHINE.
// BOOT → ASSET READY → SESSION CHECK → PROFILE READY → ACADEMIC CONTEXT READY
// → CORE DATA READY → SHELL READY → READY
// Tidak ada infinite spinner: setiap fase punya batas waktu, dan kalau asset
// gagal dimuat kita masuk failure path (EXPLAIN → RETRY → SAFE EXIT) alih-alih
// diam macet. Auth (Bagian 40) sudah dihapus total, jadi SESSION CHECK di sini
// murni tahap seremonial (selalu langsung lolos) — bukan dihapus dari urutan
// supaya state machine tetap sesuai spesifikasi.
const PHASES = [
  { key: "boot", label: "Memulai SAKALA" },
  { key: "asset", label: "Menyiapkan aset" },
  { key: "session", label: "Memeriksa sesi" },
  { key: "profile", label: "Memuat profil sekolah" },
  { key: "context", label: "Memuat konteks akademik" },
  { key: "core", label: "Menyiapkan data inti" },
  { key: "shell", label: "Menyusun tampilan" },
  { key: "ready", label: "Siap" },
] as const;

const SEEN_KEY = "sakala:splash:seen";

interface SplashScreenProps {
  schoolProfileNama: string | null;
  activeContextLabel: string | null;
}

export default function SplashScreen({ schoolProfileNama, activeContextLabel }: SplashScreenProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [assetFailed, setAssetFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    setMounted(true);
    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // sessionStorage tidak tersedia (mis. private mode strict) — anggap belum pernah lihat
    }
    if (alreadySeen) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible || assetFailed) return;
    // PROFILE READY dan ACADEMIC CONTEXT READY sudah nyata (data di-fetch di
    // server sebelum splash ini pernah render), jadi fase-fase itu tidak perlu
    // dipalsukan menunggu — cuma direpresentasikan sebentar biar urutan tetap
    // terbaca oleh pengguna. Reduced motion: lompat cepat, tanpa animasi.
    const stepMs = reducedMotion ? 60 : 220;
    PHASES.forEach((_, i) => {
      if (i === 0) return;
      const t = setTimeout(() => setPhaseIndex(i), stepMs * i);
      timers.current.push(t);
    });
    const doneAt = stepMs * (PHASES.length - 1) + (reducedMotion ? 80 : 260);
    const finish = setTimeout(() => {
      setExiting(true);
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        // abaikan — paling apes splash muncul lagi sesi berikutnya
      }
      const remove = setTimeout(() => setVisible(false), reducedMotion ? 0 : 380);
      timers.current.push(remove);
    }, doneAt);
    timers.current.push(finish);

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [visible, assetFailed, reducedMotion]);

  const retry = () => {
    setAssetFailed(false);
    setPhaseIndex(0);
  };

  const safeExit = () => {
    setExiting(true);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // abaikan
    }
    setTimeout(() => setVisible(false), 0);
  };

  if (!mounted || !visible) return null;

  const currentPhase = PHASES[phaseIndex];
  const progressPct = Math.round((phaseIndex / (PHASES.length - 1)) * 100);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Memuat SAKALA"
      className={`fixed inset-0 z-[999] flex items-center justify-center bg-[#0B0D14] transition-opacity ${
        reducedMotion ? "" : "duration-[380ms] ease-out"
      } ${exiting ? "opacity-0 pointer-events-none" : "opacity-100"}`}
    >
      {!reducedMotion && <CircuitBackdrop />}

      <div className="relative flex flex-col items-center gap-5 px-6 text-center">
        {assetFailed ? (
          <>
            <div className="text-sm font-medium text-white/90">Gagal memuat aset splash.</div>
            <div className="text-xs text-white/50">Koneksi mungkin terputus saat memuat logo.</div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={retry}
                className="rounded-pill bg-amber px-4 py-1.5 text-xs font-semibold text-[#0B0D14] transition hover:opacity-90"
              >
                Coba lagi
              </button>
              <button
                type="button"
                onClick={safeExit}
                className="rounded-pill border border-white/20 px-4 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/5"
              >
                Lanjutkan tanpa splash
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className={`relative flex h-24 w-24 items-center justify-center ${
                reducedMotion ? "" : "animate-[splashLogoIn_520ms_var(--easing)_both]"
              }`}
            >
              {!reducedMotion && (
                <div className="absolute inset-[-18px] rounded-full bg-[radial-gradient(circle,rgba(246,166,35,0.35)_0%,rgba(49,183,246,0.22)_55%,transparent_75%)] blur-md animate-[splashGlow_2.2s_ease-in-out_infinite]" />
              )}
              <Image
                src="/logo.png"
                alt="SAKALA"
                width={96}
                height={96}
                priority
                className="relative object-contain"
                onError={() => setAssetFailed(true)}
              />
            </div>

            <div className={reducedMotion ? "" : "animate-[splashFadeUp_420ms_var(--easing)_both_120ms]"}>
              <div className="text-lg font-semibold tracking-wide text-white">SAKALA</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                Enterprise Scheduling Intelligence
              </div>
            </div>

            <div className="mt-2 w-56">
              <div className="h-1 w-full overflow-hidden rounded-pill bg-white/10">
                <div
                  className={`h-full rounded-pill bg-gradient-to-r from-amber to-cyan ${
                    reducedMotion ? "" : "transition-[width] duration-200 ease-out"
                  }`}
                  style={{ width: `${Math.max(progressPct, 6)}%` }}
                />
              </div>
              <div className="mt-2 text-[11px] text-white/45">
                {currentPhase.label}
                {currentPhase.key === "profile" && schoolProfileNama ? ` · ${schoolProfileNama}` : ""}
                {currentPhase.key === "context" && activeContextLabel ? ` · ${activeContextLabel}` : ""}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Dekorasi circuit wire/node — murni SVG statis + CSS animation ringan,
// dimatikan total kalau reduced motion (parent tidak me-render komponen ini).
function CircuitBackdrop() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.35]"
      viewBox="0 0 800 500"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="url(#splashWireGradient)" strokeWidth="1" strokeLinecap="round">
        <path className="animate-[splashWire_2.6s_ease-in-out_infinite]" d="M40 80 H260 L300 120 H520" />
        <path
          className="animate-[splashWire_2.6s_ease-in-out_infinite]"
          style={{ animationDelay: "0.4s" }}
          d="M760 420 H540 L500 380 H280"
        />
        <path
          className="animate-[splashWire_2.6s_ease-in-out_infinite]"
          style={{ animationDelay: "0.8s" }}
          d="M60 440 H180 L220 400 H400 L440 440 H600"
        />
        <path
          className="animate-[splashWire_2.6s_ease-in-out_infinite]"
          style={{ animationDelay: "1.2s" }}
          d="M740 60 H620 L580 100 H420"
        />
      </g>
      {[
        [40, 80], [260, 80], [520, 120], [760, 420], [540, 420], [280, 380],
        [60, 440], [220, 400], [440, 440], [740, 60], [420, 100],
      ].map(([cx, cy], i) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="3.5"
          fill={i % 2 === 0 ? "#F6A623" : "#31B7F6"}
          className="animate-[splashNode_1.8s_ease-in-out_infinite]"
          style={{ animationDelay: `${(i % 5) * 0.25}s` }}
        />
      ))}
      <defs>
        <linearGradient id="splashWireGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F6A623" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#31B7F6" stopOpacity="0.5" />
        </linearGradient>
      </defs>
    </svg>
  );
}
