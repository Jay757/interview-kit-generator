"use client";

import React from "react";
import { motion } from "framer-motion";
import { Cpu, Globe2, ShieldCheck, Calendar, Layers, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface FeaturesBentoProps {
  theme: "dark" | "light";
}

export function FeaturesBento({ theme }: FeaturesBentoProps) {
  return (
    <motion.section
      id="features"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative z-10 py-16 sm:py-24 max-w-[1400px] w-full mx-auto px-4 sm:px-8 lg:px-12"
    >
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 mb-3">
          <Cpu className="w-3.5 h-3.5" /> Core Engineering Advantages
        </div>
        <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
          Designed to outperform generic AI models.
        </h2>
        <p
          className={cn(
            "text-xs sm:text-sm sm:leading-relaxed",
            theme === "dark" ? "text-zinc-400" : "text-slate-600"
          )}
        >
          We don&apos;t just ask an LLM for questions. Trao executes an isolated 5-stage pipeline
          with deterministic guarantees and zero hallucinations.
        </p>
      </div>

      {/* Bento Grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {/* Card 1: Autonomous Web Spider (Col span 2) */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "md:col-span-2 p-6 sm:p-8 rounded-2xl border relative overflow-hidden group transition-all duration-300",
            theme === "dark"
              ? "bg-[#10131d] border-white/[0.08] hover:border-white/20 shadow-xl"
              : "bg-white border-slate-200 hover:border-slate-300 shadow-md"
          )}
        >
          {/* SVG Visual Graphic in Background */}
          <div className="absolute right-0 top-0 w-80 h-full opacity-15 pointer-events-none hidden sm:flex items-center justify-center">
            <svg
              width="320"
              height="320"
              viewBox="0 0 200 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="100"
                cy="100"
                r="80"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="4 4"
                className="text-indigo-400 opacity-60"
              />
              <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="1" className="text-amber-500" />
              <circle cx="100" cy="100" r="20" fill="currentColor" className="text-indigo-500/20" />
              <line x1="100" y1="20" x2="100" y2="180" stroke="currentColor" strokeWidth="1" className="text-zinc-600" />
              <line x1="20" y1="100" x2="180" y2="100" stroke="currentColor" strokeWidth="1" className="text-zinc-600" />
            </svg>
          </div>

          <div className="relative z-10 max-w-lg space-y-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <Globe2 className="w-5 h-5" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
              Autonomous Spider & Cultural Scraping
            </h3>
            <p
              className={cn(
                "text-xs sm:text-sm leading-relaxed",
                theme === "dark" ? "text-zinc-400" : "text-slate-600"
              )}
            >
              Companies bury interview rubrics in obscure locations — engineering blogs, public
              handbooks, or open-source contribution guidelines. Trao traverses links dynamically,
              skipping broken pages and extracting true company DNA rather than guessing.
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Adaptive Path Heuristics
              </span>
              <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                SSRF Protected
              </span>
              <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Rate-Limit Resilience
              </span>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Second-Pass Coverage Loop (Col span 1) */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "p-6 sm:p-8 rounded-2xl border relative overflow-hidden group transition-all duration-300 flex flex-col justify-between",
            theme === "dark"
              ? "bg-[#10131d] border-white/[0.08] hover:border-white/20 shadow-xl"
              : "bg-white border-slate-200 hover:border-slate-300 shadow-md"
          )}
        >
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold tracking-tight">Second-Pass Coverage Loop</h3>
            <p
              className={cn(
                "text-xs sm:text-sm leading-relaxed",
                theme === "dark" ? "text-zinc-400" : "text-slate-600"
              )}
            >
              A prep kit that misses must-have requirements is useless. Our second pass compares
              every generated question against the extracted requirement IDs, detecting gaps and
              forcing targeted regenerations until coverage hits 100%.
            </p>
          </div>

          <div
            className={cn(
              "mt-6 p-3 rounded-xl border text-xs font-mono flex items-center gap-2",
              theme === "dark"
                ? "bg-[#151928] border-white/[0.06] text-emerald-400"
                : "bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold"
            )}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>0 Uncovered Must-Haves Guarantee</span>
          </div>
        </motion.div>

        {/* Card 3: Deterministic Arithmetic Schedule (Col span 1) */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "p-6 sm:p-8 rounded-2xl border relative overflow-hidden group transition-all duration-300 flex flex-col justify-between",
            theme === "dark"
              ? "bg-[#10131d] border-white/[0.08] hover:border-white/20 shadow-xl"
              : "bg-white border-slate-200 hover:border-slate-300 shadow-md"
          )}
        >
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold tracking-tight">Arithmetic Scheduling</h3>
            <p
              className={cn(
                "text-xs sm:text-sm leading-relaxed",
                theme === "dark" ? "text-zinc-400" : "text-slate-600"
              )}
            >
              Allocating study topics across N days is pure arithmetic, not an LLM hallucination.
              Our algorithm prioritizes complex system architecture early and weights review on
              the final day.
            </p>
          </div>

          <div
            className={cn(
              "mt-6 flex items-center justify-between text-xs font-mono border-t pt-3",
              theme === "dark" ? "text-zinc-400 border-white/[0.06]" : "text-slate-600 border-slate-200"
            )}
          >
            <span>Exact Integer Minutes</span>
            <span className="text-amber-500 font-semibold">Pure TypeScript</span>
          </div>
        </motion.div>

        {/* Card 4: Editable & Pinned State Preservation (Col span 2) */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "md:col-span-2 p-6 sm:p-8 rounded-2xl border relative overflow-hidden group transition-all duration-300",
            theme === "dark"
              ? "bg-[#10131d] border-white/[0.08] hover:border-white/20 shadow-xl"
              : "bg-white border-slate-200 hover:border-slate-300 shadow-md"
          )}
        >
          <div className="space-y-4 max-w-xl">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
              Reshapeable Kits & State Preservation
            </h3>
            <p
              className={cn(
                "text-xs sm:text-sm leading-relaxed",
                theme === "dark" ? "text-zinc-400" : "text-slate-600"
              )}
            >
              Your prep kit is a living document, not a rigid report. Add your own notes, reorder
              questions, or regenerate an entire section. Any question marked as edited or pinned
              will permanently survive subsequent AI regenerations.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-2">
              <div
                className={cn(
                  "p-3 rounded-lg border text-xs font-mono",
                  theme === "dark" ? "bg-[#161a28] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                )}
              >
                <span className="text-amber-500 font-bold block mb-1">Inline Editing</span>
                <span className={theme === "dark" ? "text-[11px] text-zinc-400" : "text-[11px] text-slate-500"}>
                  Instant updates
                </span>
              </div>
              <div
                className={cn(
                  "p-3 rounded-lg border text-xs font-mono",
                  theme === "dark" ? "bg-[#161a28] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                )}
              >
                <span className="text-emerald-500 font-bold block mb-1">Pinned Items</span>
                <span className={theme === "dark" ? "text-[11px] text-zinc-400" : "text-[11px] text-slate-500"}>
                  Never overwritten
                </span>
              </div>
              <div
                className={cn(
                  "p-3 rounded-lg border text-xs font-mono",
                  theme === "dark" ? "bg-[#161a28] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                )}
              >
                <span className="text-purple-500 font-bold block mb-1">Section Regen</span>
                <span className={theme === "dark" ? "text-[11px] text-zinc-400" : "text-[11px] text-slate-500"}>
                  Targeted updates
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
