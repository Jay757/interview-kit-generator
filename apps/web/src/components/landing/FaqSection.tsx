"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { HelpCircle, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface FaqSectionProps {
  theme: "dark" | "light";
}

const FAQS = [
  {
    q: "What happens if a company site has no discoverable hiring or culture page?",
    a: "Trao handles missing sources honestly. Rather than fabricating fake details or breaking the run, the system reports the missing hiring page in the source metadata and synthesizes the role requirements strictly from the verified job description text.",
  },
  {
    q: "How does the second-pass loop guarantee 100% must-have coverage?",
    a: "During extraction, every requirement is tagged with a unique stable ID (e.g. r1, r2) and prioritized as 'must' or 'nice'. The coverage engine evaluates whether every 'must' ID is referenced by at least one question. Any uncovered requirement triggers an automatic second-pass generation loop until zero gaps remain.",
  },
  {
    q: "Will regenerating a section overwrite my manual notes or custom edits?",
    a: "No! Items modified by hand or marked as pinned are preserved permanently. When you regenerate a category or company brief, the system intelligently retains your pinned questions and integrates new content around them.",
  },
  {
    q: "Can I run Trao over multiple roles automatically via CLI?",
    a: "Yes! Trao provides an exact batch evaluation CLI as defined in Appendix B: `npm run evaluate -- --input <cases.json> --output <kits.json>`. It processes multiple jobs with rate-limit retries and writes standardized JSON kits.",
  },
  {
    q: "Is there support for both dark and light themes?",
    a: "Yes. Trao features a bespoke design system with both dark obsidian and light alabaster themes, featuring crisp typography, glassmorphic cards, and high-contrast accessibility.",
  },
];

export function FaqSection({ theme }: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <motion.section
      id="faq"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative z-10 py-16 sm:py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"
    >
      <div className="text-center mb-10 sm:mb-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 mb-3">
          <HelpCircle className="w-3.5 h-3.5" /> Honest Architecture
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3">
          Frequently Asked Questions
        </h2>
        <p
          className={cn(
            "text-xs sm:text-sm",
            theme === "dark" ? "text-zinc-400" : "text-slate-600"
          )}
        >
          Everything you need to know about how Trao generates and protects your interview prep.
        </p>
      </div>

      <div className="space-y-3">
        {FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className={cn(
                "rounded-xl border transition-all duration-200 overflow-hidden",
                theme === "dark"
                  ? "bg-[#10131d] border-white/[0.08]"
                  : "bg-white border-slate-200 shadow-sm"
              )}
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                aria-expanded={isOpen}
                className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm focus:outline-none"
              >
                <span>{faq.q}</span>
                <ChevronRight
                  className={cn(
                    "w-4 h-4 text-amber-500 transition-transform duration-200 shrink-0",
                    isOpen && "rotate-90"
                  )}
                />
              </button>
              {isOpen && (
                <div
                  className={cn(
                    "px-4 sm:px-5 pb-5 pt-1 text-xs leading-relaxed border-t",
                    theme === "dark"
                      ? "text-zinc-400 border-white/[0.04]"
                      : "text-slate-600 border-slate-100"
                  )}
                >
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
