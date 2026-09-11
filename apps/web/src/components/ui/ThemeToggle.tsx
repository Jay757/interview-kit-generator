"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "../../lib/utils";

interface ThemeToggleProps {
  theme: "dark" | "light";
  onToggle: () => void;
  className?: string;
}

export function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle Dark and Light Theme"
      className={cn(
        "p-2 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 active:scale-95",
        theme === "dark"
          ? "bg-[#141724] border-white/[0.08] text-amber-400 hover:bg-[#1a1f30] hover:border-white/15 shadow-sm"
          : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 shadow-sm",
        className
      )}
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
