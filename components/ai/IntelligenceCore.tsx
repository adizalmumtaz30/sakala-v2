"use client";

import type { ReactNode } from "react";

export type IntelligenceState = "idle" | "analyzing" | "found" | "ready";

type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, { box: number; stroke: number; core: number; node: number }> = {
  sm: { box: 28, stroke: 1.25, core: 4, node: 2.2 },
  md: { box: 36, stroke: 1.35, core: 5, node: 2.4 },
  lg: { box: 48, stroke: 1.5, core: 6, node: 2.7 },
};

export function IntelligenceCore({ state = "idle", size = "md" }: { state?: IntelligenceState; size?: Size }) {
  const s = SIZE[size];
  const active = state === "analyzing";
  const found = state === "found";

  return (
    <span
      aria-hidden="true"
      className={`sakala-intelligence-core sakala-intelligence-core--${state}`}
      style={{ width: s.box, height: s.box }}
    >
      <svg viewBox="0 0 48 48" width="100%" height="100%" fill="none">
        <g className="sakala-core-orbit sakala-core-orbit--a">
          <ellipse cx="24" cy="24" rx="15.5" ry="8.5" transform="rotate(-25 24 24)" stroke="currentColor" strokeWidth={s.stroke} opacity={active || found ? 0.78 : 0.46} />
          <circle cx="10.8" cy="17.2" r={s.node} fill="currentColor" opacity="0.55" />
        </g>
        <g className="sakala-core-orbit sakala-core-orbit--b">
          <ellipse cx="24" cy="24" rx="15.5" ry="8.5" transform="rotate(42 24 24)" stroke="currentColor" strokeWidth={s.stroke} opacity={active || found ? 0.62 : 0.34} />
          <circle cx="36.8" cy="14.6" r={s.node} fill="currentColor" opacity="0.48" />
        </g>
        <g className="sakala-core-orbit sakala-core-orbit--c">
          <ellipse cx="24" cy="24" rx="14" ry="7" transform="rotate(88 24 24)" stroke="currentColor" strokeWidth={s.stroke} opacity={active ? 0.45 : 0.22} />
          <circle cx="31.8" cy="37.1" r={s.node} fill="currentColor" opacity="0.4" />
        </g>
        <circle cx="24" cy="24" r={s.core + (found ? 0.5 : 0)} fill="currentColor" opacity={found ? 0.95 : 0.84} />
        {found && <circle cx="24" cy="24" r={s.core + 3.5} stroke="currentColor" strokeWidth={0.8} opacity="0.16" className="sakala-core-found-ring" />}
      </svg>
      <style jsx>{`
        .sakala-intelligence-core { display:inline-flex; align-items:center; justify-content:center; flex:0 0 auto; color:var(--color-violet); }
        .sakala-core-orbit { transform-origin:24px 24px; transform-box:fill-box; }
        .sakala-intelligence-core--analyzing .sakala-core-orbit--a { animation:sakala-orbit-a 4.8s linear infinite; }
        .sakala-intelligence-core--analyzing .sakala-core-orbit--b { animation:sakala-orbit-b 6.4s linear infinite reverse; }
        .sakala-intelligence-core--analyzing .sakala-core-orbit--c { animation:sakala-orbit-c 7.2s linear infinite; }
        .sakala-intelligence-core--analyzing svg > circle { animation:sakala-core-breathe 1.8s ease-in-out infinite; transform-origin:24px 24px; }
        .sakala-core-found-ring { animation:sakala-found .45s ease-out both; transform-origin:24px 24px; }
        @keyframes sakala-orbit-a { to { transform:rotate(360deg); } }
        @keyframes sakala-orbit-b { to { transform:rotate(360deg); } }
        @keyframes sakala-orbit-c { to { transform:rotate(360deg); } }
        @keyframes sakala-core-breathe { 0%,100% { transform:scale(1); opacity:.82; } 50% { transform:scale(1.08); opacity:1; } }
        @keyframes sakala-found { from { transform:scale(.7); opacity:0; } to { transform:scale(1); opacity:.16; } }
        @media (prefers-reduced-motion: reduce) { .sakala-intelligence-core--analyzing .sakala-core-orbit, .sakala-intelligence-core--analyzing svg > circle, .sakala-core-found-ring { animation:none !important; } }
      `}</style>
    </span>
  );
}

export function IntelligencePerimeter({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div className={`relative ${active ? "sakala-perimeter sakala-perimeter--active" : ""}`}>
      <div className="relative z-10">{children}</div>
      {active && (
        <svg aria-hidden="true" className="sakala-perimeter-trace" viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect x="0.6" y="0.6" width="98.8" height="98.8" rx="2.6" fill="none" pathLength="1000" />
        </svg>
      )}
      <style jsx>{`
        .sakala-perimeter { isolation:isolate; }
        .sakala-perimeter-trace { position:absolute; inset:-1px; width:calc(100% + 2px); height:calc(100% + 2px); pointer-events:none; overflow:visible; z-index:20; opacity:.55; }
        .sakala-perimeter-trace rect { stroke:var(--color-violet); stroke-width:1.1; stroke-linecap:round; stroke-dasharray:90 910; stroke-dashoffset:1000; fill:none; opacity:.42; animation:sakala-perimeter-trace 5.2s linear infinite; vector-effect:non-scaling-stroke; }
        @keyframes sakala-perimeter-trace { to { stroke-dashoffset:0; } }
        @media (prefers-reduced-motion: reduce) { .sakala-perimeter-trace rect { animation:none; stroke-dasharray:260 740; stroke-dashoffset:0; opacity:.24; } }
      `}</style>
    </div>
  );
}
