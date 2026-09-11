"use client";

import React from "react";
import { Terminal, Globe2 } from "lucide-react";
import { cn } from "../../../lib/utils";
import { CrawledPage } from "../types";

interface SpiderLogsTabProps {
  crawledPages: CrawledPage[];
  intelligenceFound: string;
  theme: "dark" | "light";
}

export function SpiderLogsTab({
  crawledPages,
  intelligenceFound,
  theme,
}: SpiderLogsTabProps) {
  return (
    <div className="space-y-5 animate-fadeIn font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 text-xs">
          <Terminal className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="font-bold">TRAO Autonomous Spider — Crawl Session Active</span>
        </div>
        <span className="text-[11px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 self-start sm:self-auto">
          SSRF Protected • Rate-Limited
        </span>
      </div>

      {/* HTTP Request table with horizontal scroll support on small screens */}
      <div
        className={cn(
          "rounded-xl border overflow-x-auto",
          theme === "dark"
            ? "bg-[#090b12] border-white/[0.06]"
            : "bg-slate-900 text-slate-100 border-slate-800"
        )}
      >
        <div className="min-w-[500px]">
          <div className="px-4 py-2 border-b border-white/[0.06] text-[11px] text-zinc-400 grid grid-cols-12 gap-2">
            <span className="col-span-6">TARGET URL</span>
            <span className="col-span-2">STATUS</span>
            <span className="col-span-2">PAYLOAD</span>
            <span className="col-span-2 text-right">LATENCY</span>
          </div>
          <div className="divide-y divide-white/[0.04] text-xs">
            {crawledPages.map((page, i) => (
              <div key={i} className="px-4 py-2.5 grid grid-cols-12 gap-2 items-center">
                <span className="col-span-6 text-zinc-300 truncate flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">GET</span>
                  <span className="truncate">{page.url}</span>
                </span>
                <span className="col-span-2 text-emerald-400">{page.status}</span>
                <span className="col-span-2 text-zinc-400">{page.bytes}</span>
                <span className="col-span-2 text-right text-amber-400">{page.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Intelligence extraction brief */}
      <div
        className={cn(
          "p-4 rounded-xl border text-xs space-y-2",
          theme === "dark"
            ? "bg-[#141724] border-white/[0.08]"
            : "bg-slate-100 border-slate-200"
        )}
      >
        <div className="flex items-center gap-2 text-amber-500 font-bold">
          <Globe2 className="w-4 h-4 shrink-0" />
          <span>SYNTHESIZED COMPANY CULTURE & HIRING BRIEF</span>
        </div>
        <p
          className={cn(
            "leading-relaxed",
            theme === "dark" ? "text-zinc-300" : "text-slate-700"
          )}
        >
          {intelligenceFound}
        </p>
      </div>
    </div>
  );
}
