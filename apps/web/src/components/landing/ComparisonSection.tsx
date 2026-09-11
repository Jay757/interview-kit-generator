"use client";

import React from "react";
import { motion } from "framer-motion";
import { Target, XCircle, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface ComparisonSectionProps {
  theme: "dark" | "light";
}

const COMPARISON_ROWS = [
  {
    feature: "Company Culture & Stack Crawling",
    chatgpt: "Hallucinates or uses stale memory from training cutoff",
    trao: "Autonomous live crawl of handbook, engineering blog & values",
  },
  {
    feature: "Must-Have Requirement Coverage",
    chatgpt: "Skips hard requirements; outputs whatever sounds plausible",
    trao: "Strict second-pass validation loop guarantees 100% coverage",
  },
  {
    feature: "Study Schedule Allocation",
    chatgpt: "Arbitrary bullet points; no hour/day mathematical calculation",
    trao: "Deterministic arithmetic balances study load across your days",
  },
  {
    feature: "Practice Mode & Active Recall",
    chatgpt: "Static text wall; requires manual copy-pasting into Anki",
    trao: "Integrated 3D flashcards with confidence-weighted revision",
  },
  {
    feature: "Custom Edit & Pin Preservation",
    chatgpt: "Regenerating wipes your custom answers and manual edits",
    trao: "Preserves pinned questions and inline modifications permanently",
  },
  {
    feature: "Multi-Role Batch Evaluation",
    chatgpt: "Single chat bottleneck; cannot run automated batch CLI",
    trao: "Batch evaluation CLI: npm run evaluate -- --input cases.json",
  },
];

export function ComparisonSection({ theme }: ComparisonSectionProps) {
  return (
    <motion.section
      id="comparison"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative z-10 py-16 sm:py-24 max-w-[1400px] w-full mx-auto px-4 sm:px-8 lg:px-12"
    >
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 mb-3">
          <Target className="w-3.5 h-3.5" /> Unfair Advantage
        </div>
        <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
          Why Generic Prompts Cost Candidates Offers
        </h2>
        <p
          className={cn(
            "text-xs sm:text-sm sm:leading-relaxed",
            theme === "dark" ? "text-zinc-400" : "text-slate-600"
          )}
        >
          Pasting a job description into standard chatbots produces shallow, hallucinated
          interviews. Here is how Trao compares:
        </p>
      </div>

      {/* Comparison Table with Horizontal Scroll Support on Mobile */}
      <div
        className={cn(
          "rounded-2xl border overflow-x-auto shadow-2xl",
          theme === "dark" ? "bg-[#0e111a] border-white/[0.08]" : "bg-white border-slate-200 shadow-lg"
        )}
      >
        <div className="min-w-[620px]">
          {/* Header Row */}
          <div className="grid grid-cols-12 p-4 sm:p-6 border-b border-white/[0.06] text-xs font-mono font-bold">
            <div className="col-span-4 text-zinc-400">PIPELINE CAPABILITY</div>
            <div className="col-span-4 text-red-400 flex items-center gap-1.5">
              <XCircle className="w-4 h-4 shrink-0" /> Generic ChatGPT / Claude
            </div>
            <div className="col-span-4 text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Trao AI Prep Kit
            </div>
          </div>

          {/* Body Rows */}
          <div className="divide-y divide-white/[0.04] text-xs sm:text-sm">
            {COMPARISON_ROWS.map((row, i) => (
              <div
                key={i}
                className={cn(
                  "grid grid-cols-12 p-4 sm:p-5 items-center gap-3 transition-colors",
                  theme === "dark" ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"
                )}
              >
                <div className="col-span-4 font-semibold text-xs sm:text-sm">{row.feature}</div>
                <div className="col-span-4 text-xs text-zinc-400 leading-relaxed pr-2">
                  {row.chatgpt}
                </div>
                <div className="col-span-4 text-xs text-emerald-400 font-medium leading-relaxed">
                  {row.trao}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
