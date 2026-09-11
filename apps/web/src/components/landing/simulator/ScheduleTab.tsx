"use client";

import React from "react";
import { Clock } from "lucide-react";
import { cn } from "../../../lib/utils";
import { ScheduleItem } from "../types";

interface ScheduleTabProps {
  schedule: ScheduleItem[];
  theme: "dark" | "light";
}

export function ScheduleTab({ schedule, theme }: ScheduleTabProps) {
  const totalMins = schedule.reduce((acc, curr) => acc + curr.mins, 0);

  return (
    <div className="space-y-4 animate-fadeIn font-mono">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 pb-3 border-b border-slate-200 dark:border-white/[0.06]">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500">
            Deterministic {schedule.length}-Day Arithmetic Schedule
          </h4>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400">
            Calculated pure TypeScript arithmetic — no night-before cramming.
          </span>
        </div>
        <span className="text-xs text-slate-600 dark:text-zinc-400 font-medium">Total: {totalMins} mins allocated</span>
      </div>

      <div className="space-y-2">
        {schedule.map((item) => (
          <div
            key={item.day}
            className={cn(
              "p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs",
              theme === "dark"
                ? "bg-[#141724] border-white/[0.06] hover:border-white/10"
                : "bg-slate-50 border-slate-200 hover:border-slate-300"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold shrink-0">
                DAY {item.day}
              </span>
              <div>
                <div
                  className={
                    theme === "dark" ? "text-zinc-200 font-bold" : "text-slate-800 font-bold"
                  }
                >
                  {item.title}
                </div>
                <div className={theme === "dark" ? "text-[11px] text-zinc-400" : "text-[11px] text-slate-500"}>
                  {item.focus}
                </div>
              </div>
            </div>
            <div
              className={cn(
                "flex items-center gap-1 shrink-0 text-[11px] self-end sm:self-auto font-medium",
                theme === "dark" ? "text-zinc-400" : "text-slate-600"
              )}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>{item.mins} mins</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
