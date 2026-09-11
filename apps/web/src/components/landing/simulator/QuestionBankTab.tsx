"use client";

import React from "react";
import { Brain } from "lucide-react";
import { cn } from "../../../lib/utils";
import { SampleQuestion } from "../types";

interface QuestionBankTabProps {
  question: SampleQuestion;
  theme: "dark" | "light";
}

export function QuestionBankTab({ question, theme }: QuestionBankTabProps) {
  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <div>
          <span className="text-xs font-mono font-bold text-amber-500">
            CATEGORY: {question.category.toUpperCase()}
          </span>
          <h4
            className={cn(
              "text-sm sm:text-base font-bold mt-0.5",
              theme === "dark" ? "text-zinc-100" : "text-slate-900"
            )}
          >
            {question.prompt}
          </h4>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/10">
            Matches [{question.reqBadge}]
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30">
            Difficulty: Level {question.difficulty}/3
          </span>
        </div>
      </div>

      {/* STAR Structured Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div
          className={cn(
            "p-3.5 rounded-xl border space-y-1",
            theme === "dark" ? "bg-[#141724] border-white/[0.06]" : "bg-slate-50 border-slate-200"
          )}
        >
          <div className="font-mono text-[10px] font-bold text-indigo-400 uppercase">
            [S] Situation
          </div>
          <p className={theme === "dark" ? "text-zinc-300" : "text-slate-700"}>
            {question.starMethod.situation}
          </p>
        </div>
        <div
          className={cn(
            "p-3.5 rounded-xl border space-y-1",
            theme === "dark" ? "bg-[#141724] border-white/[0.06]" : "bg-slate-50 border-slate-200"
          )}
        >
          <div className="font-mono text-[10px] font-bold text-amber-400 uppercase">
            [T] Task
          </div>
          <p className={theme === "dark" ? "text-zinc-300" : "text-slate-700"}>
            {question.starMethod.task}
          </p>
        </div>
        <div
          className={cn(
            "p-3.5 rounded-xl border space-y-1 md:col-span-2",
            theme === "dark" ? "bg-[#141724] border-white/[0.06]" : "bg-slate-50 border-slate-200"
          )}
        >
          <div className="font-mono text-[10px] font-bold text-emerald-400 uppercase">
            [A] Action Taken
          </div>
          <p className={theme === "dark" ? "text-zinc-300" : "text-slate-700"}>
            {question.starMethod.action}
          </p>
        </div>
        <div
          className={cn(
            "p-3.5 rounded-xl border space-y-1 md:col-span-2",
            theme === "dark" ? "bg-[#141724] border-white/[0.06]" : "bg-slate-50 border-slate-200"
          )}
        >
          <div className="font-mono text-[10px] font-bold text-purple-400 uppercase">
            [R] Measurable Result
          </div>
          <p className={theme === "dark" ? "text-zinc-300" : "text-slate-700"}>
            {question.starMethod.result}
          </p>
        </div>
      </div>
    </div>
  );
}
