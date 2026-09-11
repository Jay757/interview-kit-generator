"use client";

import React from "react";
import Link from "next/link";
import { cn } from "../../lib/utils";

interface LandingFooterProps {
  theme: "dark" | "light";
}

export function LandingFooter({ theme }: LandingFooterProps) {
  return (
    <footer
      className={cn(
        "relative z-10 border-t py-10 sm:py-12 transition-colors",
        theme === "dark"
          ? "bg-[#06070a] border-white/[0.06] text-zinc-500"
          : "bg-slate-100 border-slate-200 text-slate-600"
      )}
    >
      <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-8 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-bold text-xs">
            TR
          </div>
          <span
            className={cn(
              "font-bold text-xs tracking-tight",
              theme === "dark" ? "text-slate-200" : "text-slate-800"
            )}
          >
            TRAO PREP
          </span>
          <span className="text-[11px] text-zinc-500">
            © {new Date().getFullYear()} Autonomous Interview Intelligence.
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs font-mono">
          <a href="#simulator" className="hover:text-amber-400 transition-colors">
            Simulator
          </a>
          <a href="#features" className="hover:text-amber-400 transition-colors">
            Features
          </a>
          <a href="#comparison" className="hover:text-amber-400 transition-colors">
            Comparison
          </a>
          <a href="#workflow" className="hover:text-amber-400 transition-colors">
            Workflow
          </a>
          <Link href="/kits" className="hover:text-amber-400 transition-colors">
            My Kits
          </Link>
        </div>
      </div>
    </footer>
  );
}
