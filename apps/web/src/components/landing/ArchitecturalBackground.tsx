"use client";

import React from "react";
import { cn } from "../../lib/utils";

interface ArchitecturalBackgroundProps {
  theme: "dark" | "light";
}

export function ArchitecturalBackground({ theme }: ArchitecturalBackgroundProps) {
  const isDark = theme === "dark";

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* 1. Full-Bleed Ambient Lateral Glows (Eliminates empty void on 1920px+ monitors) */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background: isDark
            ? `radial-gradient(ellipse 90% 45% at 50% -8%, rgba(245, 158, 11, 0.08) 0%, rgba(16, 185, 129, 0.04) 40%, transparent 75%),
               radial-gradient(ellipse 35% 50% at 0% 35%, rgba(16, 185, 129, 0.05) 0%, transparent 70%),
               radial-gradient(ellipse 35% 50% at 100% 35%, rgba(245, 158, 11, 0.045) 0%, transparent 70%)`
            : `radial-gradient(ellipse 90% 45% at 50% -8%, rgba(245, 158, 11, 0.06) 0%, rgba(99, 102, 241, 0.03) 40%, transparent 75%),
               radial-gradient(ellipse 35% 50% at 0% 35%, rgba(99, 102, 241, 0.03) 0%, transparent 70%),
               radial-gradient(ellipse 35% 50% at 100% 35%, rgba(245, 158, 11, 0.03) 0%, transparent 70%)`,
        }}
      />

      {/* 2. Precision Vector SVG Grid with CAD Crosshairs at Intersections */}
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          maskImage: "radial-gradient(ellipse 90% 75% at 50% 20%, black 45%, transparent 95%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 75% at 50% 20%, black 45%, transparent 95%)",
        }}
      >
        <defs>
          <pattern
            id="precision-grid-pattern"
            width="56"
            height="56"
            patternUnits="userSpaceOnUse"
          >
            {/* Grid square lines */}
            <path
              d="M 56 0 L 0 0 0 56"
              fill="none"
              stroke={isDark ? "rgba(255, 255, 255, 0.035)" : "rgba(15, 23, 42, 0.045)"}
              strokeWidth="1"
            />
            {/* Crosshair micro-notch at intersection (0,0) */}
            <path
              d="M -3 0 L 3 0 M 0 -3 L 0 3"
              fill="none"
              stroke={isDark ? "rgba(245, 158, 11, 0.22)" : "rgba(99, 102, 241, 0.25)"}
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#precision-grid-pattern)" />
      </svg>

      {/* 3. Fluid Lateral Horizon Lines (Scales naturally to 1920px, 2560px, etc.) */}
      <div className="absolute inset-x-0 top-24 h-px bg-gradient-to-r from-transparent via-amber-500/15 dark:via-amber-400/10 to-transparent" />
      <div className="absolute inset-x-0 top-[560px] h-px bg-gradient-to-r from-transparent via-slate-400/10 dark:via-white/[0.04] to-transparent" />

      {/* 4. Architectural Corner Framing Targets */}
      <div className="absolute top-6 left-6 text-[9px] font-mono text-slate-400/40 dark:text-zinc-600 tracking-widest hidden xl:block">
        SYS.GRID // 56px_PRECISION
      </div>
      <div className="absolute top-6 right-6 text-[9px] font-mono text-slate-400/40 dark:text-zinc-600 tracking-widest hidden xl:block">
        STAGE // RUNTIME_ACTIVE
      </div>
    </div>
  );
}
