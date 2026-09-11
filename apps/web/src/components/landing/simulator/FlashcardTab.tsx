"use client";

import React, { useState } from "react";
import { cn } from "../../../lib/utils";
import { Flashcard } from "../types";

interface FlashcardTabProps {
  flashcard: Flashcard;
  company: string;
  theme: "dark" | "light";
}

export function FlashcardTab({ flashcard, company, theme }: FlashcardTabProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);

  return (
    <div className="flex flex-col items-center justify-center py-2 sm:py-4 space-y-6 animate-fadeIn">
      <div className="text-center space-y-1">
        <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
          Interactive Spaced-Repetition Simulator
        </span>
        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Click card to reveal answer outline</h4>
      </div>

      {/* 3D Flippable Card */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="perspective-1000 w-full max-w-lg h-56 sm:h-60 cursor-pointer group select-none"
      >
        <div
          className={cn(
            "relative w-full h-full transition-transform duration-500 transform-style-preserve-3d rounded-2xl shadow-xl border",
            isFlipped && "rotate-y-180",
            theme === "dark"
              ? "border-white/[0.1] bg-gradient-to-br from-[#161a2b] to-[#0f121e]"
              : "border-slate-200 bg-gradient-to-br from-white to-slate-50"
          )}
        >
          {/* Front Face */}
          <div className="absolute inset-0 backface-hidden p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs font-mono text-slate-500 dark:text-zinc-400">
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold">
                QUESTION PROMPT
              </span>
              <span>Click to flip ↻</span>
            </div>
            <p
              className={cn(
                "text-sm sm:text-base md:text-lg font-medium text-center leading-relaxed",
                theme === "dark" ? "text-zinc-100" : "text-slate-800"
              )}
            >
              {flashcard.front}
            </p>
            <div className="text-center text-xs font-mono text-slate-500 dark:text-zinc-400">
              Targeted for {company}
            </div>
          </div>

          {/* Back Face */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs font-mono text-slate-500 dark:text-zinc-400">
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                ANSWER CRITERIA
              </span>
              <span>Click to flip ↻</span>
            </div>
            <p
              className={cn(
                "text-xs sm:text-sm leading-relaxed overflow-y-auto max-h-[110px]",
                theme === "dark" ? "text-zinc-200" : "text-slate-700"
              )}
            >
              {flashcard.back}
            </p>
            <div className="flex justify-center items-center gap-2 pt-2 border-t border-slate-200 dark:border-white/[0.06]">
              <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">Rate confidence:</span>
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfidence(score);
                  }}
                  className={cn(
                    "w-6 h-6 rounded text-[10px] font-mono font-bold transition-all",
                    confidence === score
                      ? "bg-amber-500 text-slate-950 scale-110 shadow-sm shadow-amber-500/40"
                      : theme === "dark"
                      ? "bg-white/[0.08] text-zinc-300 hover:bg-white/20"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  )}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {confidence !== null && (
        <div className="text-xs font-mono text-emerald-400 animate-fadeIn text-center">
          ✓ Confidence recorded: Level {confidence}/5. Schedule updated adaptively!
        </div>
      )}
    </div>
  );
}
