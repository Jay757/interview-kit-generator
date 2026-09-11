"use client";

import React from "react";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import { cn } from "../../lib/utils";

interface WorkflowSectionProps {
  theme: "dark" | "light";
}

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Input & Target",
    desc: "Paste your job description, specify the company domain, and set your target interview days.",
  },
  {
    step: "02",
    title: "Autonomous Crawl",
    desc: "The spider explores company culture, engineering blogs, and public interview debriefs with backoff resilience.",
  },
  {
    step: "03",
    title: "Dual-Pass Synthesis",
    desc: "Requirements are extracted into Must vs Nice-to-Have, questions are generated, and gaps are closed automatically.",
  },
  {
    step: "04",
    title: "Master & Retain",
    desc: "Follow the arithmetic day-by-day plan, flip 3D active flashcards, and pin custom answers inline.",
  },
];

export function WorkflowSection({ theme }: WorkflowSectionProps) {
  return (
    <motion.section
      id="workflow"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative z-10 py-16 sm:py-24 max-w-[1400px] w-full mx-auto px-4 sm:px-8 lg:px-12"
    >
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 mb-3">
          <Compass className="w-3.5 h-3.5" /> Streamlined Workflow
        </div>
        <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
          From Pasted Job Description to Offer Ready
        </h2>
        <p
          className={cn(
            "text-xs sm:text-sm sm:leading-relaxed",
            theme === "dark" ? "text-zinc-400" : "text-slate-600"
          )}
        >
          Four structured steps to systematically prepare without burning out.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
        {WORKFLOW_STEPS.map((card, idx) => (
          <motion.div
            key={card.step}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
            whileHover={{ y: -4 }}
            className={cn(
              "p-6 rounded-2xl border relative group transition-all duration-200",
              theme === "dark"
                ? "bg-[#10131d] border-white/[0.08] hover:border-amber-500/40"
                : "bg-white border-slate-200 hover:border-indigo-400 shadow-sm"
            )}
          >
            <div className="text-3xl font-black font-mono text-amber-500/30 group-hover:text-amber-500 transition-colors mb-3">
              {card.step}
            </div>
            <h4 className="text-base font-bold mb-2">{card.title}</h4>
            <p
              className={cn(
                "text-xs leading-relaxed",
                theme === "dark" ? "text-zinc-400" : "text-slate-600"
              )}
            >
              {card.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
