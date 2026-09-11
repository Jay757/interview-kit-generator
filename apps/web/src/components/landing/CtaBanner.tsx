"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface CtaBannerProps {
  theme: "dark" | "light";
  isUserLoggedIn: boolean;
}

export function CtaBanner({ theme, isUserLoggedIn }: CtaBannerProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative z-10 py-14 sm:py-20 max-w-[1400px] w-full mx-auto px-4 sm:px-8 lg:px-12"
    >
      <div
        className={cn(
          "rounded-3xl p-8 sm:p-12 md:p-16 text-center relative overflow-hidden border shadow-2xl",
          theme === "dark"
            ? "bg-[#0c0f18] border-white/[0.1] shadow-black/80"
            : "bg-gradient-to-b from-slate-50 to-white border-slate-200 shadow-xl"
        )}
      >
        {/* Crisp Architectural Radial Top Highlight (No AI blur blob) */}
        <div
          className="absolute inset-x-0 top-0 h-40 pointer-events-none"
          style={{
            background:
              theme === "dark"
                ? "radial-gradient(ellipse 60% 80% at 50% -20%, rgba(245, 158, 11, 0.12) 0%, transparent 80%)"
                : "radial-gradient(ellipse 60% 80% at 50% -20%, rgba(245, 158, 11, 0.08) 0%, transparent 80%)",
          }}
        />

        <div className="relative z-10 max-w-2xl mx-auto space-y-5 sm:space-y-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5" /> Start With Any Target Role
          </span>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Ready to walk into your next interview completely prepared?
          </h2>
          <p
            className={cn(
              "text-xs sm:text-sm md:text-base",
              theme === "dark" ? "text-zinc-400" : "text-slate-600"
            )}
          >
            Generate your first tailored interview kit in seconds. Zero generic questions, zero
            uncovered requirements.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href={isUserLoggedIn ? "/kits/new" : "/register"}
              className="w-full sm:w-auto px-8 py-3.5 sm:py-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 group active:scale-[0.98]"
            >
              <span>Generate Your First Kit</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
