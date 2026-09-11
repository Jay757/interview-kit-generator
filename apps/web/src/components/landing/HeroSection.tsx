"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck, Globe2, Calendar, Layers } from "lucide-react";
import { cn } from "../../lib/utils";

interface HeroSectionProps {
  theme: "dark" | "light";
  isUserLoggedIn: boolean;
}

export function HeroSection({ theme, isUserLoggedIn }: HeroSectionProps) {
  return (
    <section className="relative z-10 pt-16 pb-20 sm:pt-24 sm:pb-28 lg:pt-32 lg:pb-36 max-w-[1400px] w-full mx-auto px-4 sm:px-8 lg:px-12 text-center">
      {/* Shimmer Announcement Pill with entrance animation */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border mb-6 sm:mb-8 text-xs font-medium shadow-sm transition-all duration-300 hover:scale-[1.02] max-w-full"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span
          className={cn(
            "font-mono tracking-tight truncate",
            theme === "dark" ? "text-zinc-300" : "text-slate-700"
          )}
        >
          Deterministic Second-Pass Engine • Zero Hallucinations
        </span>
        <span className="text-amber-500 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded shrink-0">
          Live
        </span>
      </motion.div>

      {/* Master Responsive Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight max-w-6xl mx-auto leading-[1.08] sm:leading-[1.05] mb-6 sm:mb-8"
      >
        Stop guessing your interview.{" "}
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-amber-200 to-emerald-400">
          Engineered prep from real company intelligence.
        </span>
      </motion.h1>

      {/* Subtitle / Value Proposition */}
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        className={cn(
          "text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed mb-10 sm:mb-12 font-normal px-2",
          theme === "dark" ? "text-zinc-400" : "text-slate-600"
        )}
      >
        Paste any job description and company URL. Our autonomous spider crawls engineering blogs,
        handbooks, and interview debriefs — generating a gap-proof question bank, flippable 3D
        flashcards, and a day-by-day study roadmap.
      </motion.p>

      {/* Action CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14 sm:mb-16"
      >
        <Link
          href={isUserLoggedIn ? "/kits/new" : "/register"}
          className="group w-full sm:w-auto px-7 py-4 sm:px-8 sm:py-4.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-bold text-sm sm:text-base hover:brightness-105 active:scale-[0.99] transition-all shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2.5"
        >
          <span>Create Your Prep Kit Now</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
        <a
          href="#simulator"
          className={cn(
            "w-full sm:w-auto px-7 py-4 sm:px-8 sm:py-4.5 rounded-xl border font-semibold text-sm sm:text-base transition-all flex items-center justify-center gap-2.5",
            theme === "dark"
              ? "bg-[#0f121d] border-white/[0.1] text-zinc-200 hover:bg-[#151928] hover:border-white/20"
              : "bg-white border-slate-300 text-slate-800 hover:bg-slate-50 shadow-sm"
          )}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Explore Interactive Simulator</span>
        </a>
      </motion.div>

      {/* Proof Indicators Strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto pt-8 border-t border-slate-200/80 dark:border-white/[0.08]"
      >
        <div className="flex items-center justify-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
          <div className="text-left">
            <div className="text-xs sm:text-sm font-bold">100% Coverage</div>
            <div className="text-[11px] text-zinc-500">Every MUST requirement checked</div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Globe2 className="w-5 h-5 text-indigo-400 shrink-0" />
          <div className="text-left">
            <div className="text-xs sm:text-sm font-bold">Autonomous Crawl</div>
            <div className="text-[11px] text-zinc-500">No hardcoded career links</div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Calendar className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-left">
            <div className="text-xs sm:text-sm font-bold">Arithmetic Schedule</div>
            <div className="text-[11px] text-zinc-500">Exact N-day integer timeboxing</div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Layers className="w-5 h-5 text-purple-400 shrink-0" />
          <div className="text-left">
            <div className="text-xs sm:text-sm font-bold">State Preservation</div>
            <div className="text-[11px] text-zinc-500">Manual edits never clobbered</div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
