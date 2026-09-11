"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCheck2,
  Terminal,
  Brain,
  Sparkles,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { SIMULATOR_PRESETS } from "../simulator-presets";
import { SimulatorTabType } from "../types";
import { CoverageMatrixTab } from "./CoverageMatrixTab";
import { SpiderLogsTab } from "./SpiderLogsTab";
import { QuestionBankTab } from "./QuestionBankTab";
import { FlashcardTab } from "./FlashcardTab";
import { ScheduleTab } from "./ScheduleTab";

const TABS: { id: SimulatorTabType; label: string; icon: React.ElementType }[] = [
  { id: "matrix", label: "01. Coverage Matrix", icon: FileCheck2 },
  { id: "crawl", label: "02. Spider Logs", icon: Terminal },
  { id: "questions", label: "03. Question Bank", icon: Brain },
  { id: "flashcard", label: "04. 3D Flashcard", icon: Sparkles },
  { id: "schedule", label: "05. Day Schedule", icon: Calendar },
];

/** Auto-cycle interval in milliseconds */
const TAB_CYCLE_MS = 4000;

interface ProductSimulatorProps {
  theme: "dark" | "light";
  isUserLoggedIn: boolean;
}

export function ProductSimulator({ theme, isUserLoggedIn }: ProductSimulatorProps) {
  const [activePresetIndex, setActivePresetIndex] = useState(0);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const startTimeRef = useRef<number>(Date.now());
  const rafRef = useRef<number | null>(null);

  const activeTab = TABS[activeTabIndex].id;
  const currentPreset = SIMULATOR_PRESETS[activePresetIndex];

  // ─── Progress bar animation using requestAnimationFrame ───────────────
  const tick = useCallback(() => {
    if (isPaused) return;
    const elapsed = Date.now() - startTimeRef.current;
    const pct = Math.min((elapsed / TAB_CYCLE_MS) * 100, 100);
    setProgress(pct);

    if (elapsed >= TAB_CYCLE_MS) {
      // Advance to next tab
      setActiveTabIndex((prev) => (prev + 1) % TABS.length);
      startTimeRef.current = Date.now();
      setProgress(0);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [isPaused]);

  useEffect(() => {
    startTimeRef.current = Date.now();
    setProgress(0);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  // When user manually selects a tab, reset timer
  const handleTabClick = (idx: number) => {
    setActiveTabIndex(idx);
    startTimeRef.current = Date.now();
    setProgress(0);
  };

  // When user manually selects a preset, reset to first tab
  const handlePresetClick = (idx: number) => {
    setActivePresetIndex(idx);
    setActiveTabIndex(0);
    startTimeRef.current = Date.now();
    setProgress(0);
  };

  return (
    <motion.section
      id="simulator"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative z-10 py-16 sm:py-24 max-w-[1400px] w-full mx-auto px-4 sm:px-8 lg:px-12"
    >
      {/* Header */}
      <div className="text-center max-w-4xl mx-auto mb-10 sm:mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider font-semibold text-amber-500 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 mb-4">
          <Terminal className="w-3.5 h-3.5" /> Interactive Intelligence Sandbox
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
          Experience the Trao Pipeline in Real Time
        </h2>
        <p
          className={cn(
            "text-sm sm:text-base leading-relaxed max-w-2xl mx-auto",
            theme === "dark" ? "text-zinc-400" : "text-slate-600"
          )}
        >
          Select a verified engineering target below to inspect atomic requirement extraction,
          culture debriefs, question synthesis with STAR framework, and flippable flashcards.
        </p>
      </div>

      {/* Preset Selector Pills */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-10">
        {SIMULATOR_PRESETS.map((preset, idx) => {
          const isSelected = activePresetIndex === idx;
          return (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(idx)}
              className={cn(
                "group flex items-center gap-2.5 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 border cursor-pointer",
                isSelected
                  ? "bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-lg shadow-amber-500/25 scale-[1.02]"
                  : theme === "dark"
                  ? "bg-[#0c0f18] border-white/[0.08] text-zinc-400 hover:text-white hover:bg-[#121624] hover:border-white/20"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm"
              )}
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  isSelected ? "bg-slate-950 animate-pulse" : "bg-zinc-500 group-hover:bg-amber-400"
                )}
              />
              <span className="font-semibold">{preset.company}</span>
              <span
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded font-mono",
                  isSelected
                    ? "bg-slate-950/20 text-slate-950 font-bold"
                    : theme === "dark"
                    ? "bg-white/[0.06] text-zinc-400"
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {preset.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Simulator Window */}
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className={cn(
          "w-full rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300",
          theme === "dark"
            ? "bg-[#090c15] border-white/[0.1] shadow-black/90"
            : "bg-white border-slate-200 shadow-2xl shadow-slate-200/80"
        )}
      >
        {/* Window bar */}
        <div
          className={cn(
            "px-4 sm:px-6 pt-3.5 border-b",
            theme === "dark" ? "bg-[#0e121e] border-white/[0.07]" : "bg-slate-50 border-slate-200"
          )}
        >
          {/* Top row: traffic lights + breadcrumb + status */}
          <div className="flex items-center justify-between gap-4 pb-3">
            <div className="flex items-center gap-3.5 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>

              <div className="h-4 w-px bg-zinc-700/40 hidden sm:block" />

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="font-semibold text-amber-500">trao-runtime://</span>
                <span className={theme === "dark" ? "text-zinc-200 font-medium" : "text-slate-800 font-medium"}>
                  {currentPreset.domain}
                </span>
                <span className="text-zinc-500">→</span>
                <span className="text-emerald-500 font-medium truncate max-w-[160px] sm:max-w-xs">
                  {currentPreset.role}
                </span>
              </div>
            </div>

            <div className="hidden xl:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Grounded</span>
            </div>
          </div>

          {/* Tab row — no horizontal scroll, wraps naturally */}
          <div className="flex items-end gap-0.5 sm:gap-1 flex-wrap">
            {TABS.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = idx === activeTabIndex;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(idx)}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-t-lg text-[11px] sm:text-xs font-mono transition-all whitespace-nowrap cursor-pointer overflow-hidden",
                    isActive
                      ? theme === "dark"
                        ? "bg-[#090c15] text-amber-400 border-t border-l border-r border-amber-500/30 font-semibold"
                        : "bg-white text-amber-700 border-t border-l border-r border-amber-300 font-semibold"
                      : theme === "dark"
                      ? "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/60"
                  )}
                >
                  <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span>{tab.label}</span>

                  {/* Progress bar — only on active tab */}
                  {isActive && (
                    <span
                      className={cn(
                        "absolute bottom-0 left-0 h-[2px] transition-none",
                        isPaused ? "bg-amber-400/50" : "bg-amber-500"
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-5 sm:p-8 md:p-10 min-h-[460px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activePresetIndex}-${activeTab}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {activeTab === "matrix" && (
                <CoverageMatrixTab requirements={currentPreset.requirements} theme={theme} />
              )}
              {activeTab === "crawl" && (
                <SpiderLogsTab
                  crawledPages={currentPreset.crawledPages}
                  intelligenceFound={currentPreset.intelligenceFound}
                  theme={theme}
                />
              )}
              {activeTab === "questions" && (
                <QuestionBankTab question={currentPreset.sampleQuestion} theme={theme} />
              )}
              {activeTab === "flashcard" && (
                <FlashcardTab
                  flashcard={currentPreset.flashcard}
                  company={currentPreset.company}
                  theme={theme}
                />
              )}
              {activeTab === "schedule" && (
                <ScheduleTab schedule={currentPreset.schedule} theme={theme} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Footer */}
          <div
            className={cn(
              "mt-8 pt-5 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono",
              theme === "dark" ? "border-white/[0.06] text-zinc-400" : "border-slate-200 text-slate-500"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Target: {currentPreset.company} Engineering Verification Matrix</span>
            </div>

            <Link
              href={isUserLoggedIn ? "/kits/new" : "/register"}
              className="group inline-flex items-center gap-1.5 font-semibold text-amber-500 hover:text-amber-400 transition-colors"
            >
              <span>Generate Kit for Your Target Role</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
