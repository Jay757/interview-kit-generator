"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FolderLock, LogOut, Menu, X, ArrowRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { ThemeToggle } from "../ui/ThemeToggle";

interface LandingNavbarProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  user: { email: string } | null;
  authLoading: boolean;
  onLogout: () => void;
}

export function LandingNavbar({
  theme,
  onToggleTheme,
  user,
  authLoading,
  onLogout,
}: LandingNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Top Announcement Bar */}
      <div
        className={cn(
          "relative z-50 border-b text-[11px] font-mono tracking-wide py-2 px-4 text-center flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 transition-colors",
          theme === "dark"
            ? "bg-[#0e111a]/80 border-white/[0.06] text-zinc-400"
            : "bg-indigo-50 border-indigo-100 text-indigo-900 font-medium"
        )}
      >
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/20">
          PROPRIETARY MULTI-PASS
        </span>
        <span className="hidden sm:inline">
          Never face a generic interview question again. Guaranteed 100% must-have coverage.
        </span>
        <span className="sm:hidden">Guaranteed 100% must-have coverage.</span>
        <Link
          href={user ? "/kits/new" : "/register"}
          className="inline-flex items-center gap-1 font-semibold underline underline-offset-4 hover:opacity-80 transition-opacity ml-1"
        >
          Create Kit <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Main Glass Header */}
      <header
        className={cn(
          "sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-200",
          theme === "dark"
            ? "bg-[#08090d]/85 border-white/[0.07]"
            : "bg-white/85 border-slate-200/80 shadow-sm"
        )}
      >
        <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black tracking-tight text-sm shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
              TR
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm sm:text-base tracking-tight flex items-center gap-1.5">
                TRAO
                <span
                  className={cn(
                    "text-[10px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded border",
                    theme === "dark"
                      ? "bg-white/[0.04] text-zinc-400 border-white/[0.08]"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  )}
                >
                  PREP AI
                </span>
              </span>
              <span className="text-[10px] font-mono text-zinc-500 -mt-0.5 hidden sm:block">
                Intelligence Engine v2.4
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium tracking-wide">
            <a
              href="#simulator"
              className={cn(
                "transition-colors",
                theme === "dark" ? "text-zinc-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Live Simulator
            </a>
            <a
              href="#features"
              className={cn(
                "transition-colors",
                theme === "dark" ? "text-zinc-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Core Architecture
            </a>
            <a
              href="#comparison"
              className={cn(
                "transition-colors",
                theme === "dark" ? "text-zinc-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Why Not ChatGPT?
            </a>
            <a
              href="#workflow"
              className={cn(
                "transition-colors",
                theme === "dark" ? "text-zinc-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
              )}
            >
              How It Works
            </a>
            <a
              href="#faq"
              className={cn(
                "transition-colors",
                theme === "dark" ? "text-zinc-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
              )}
            >
              FAQ
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle */}
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />

            {/* Desktop Auth State */}
            <div className="hidden sm:flex items-center gap-3">
              {authLoading ? (
                <div className="h-9 w-24 bg-zinc-800/40 rounded-lg animate-pulse" />
              ) : user ? (
                <div className="flex items-center gap-3">
                  <Link
                    href="/kits"
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      theme === "dark"
                        ? "bg-[#151928] border-white/[0.08] text-white hover:bg-[#1c2236]"
                        : "bg-slate-100 border-slate-200 text-slate-900 hover:bg-slate-200"
                    )}
                  >
                    <FolderLock className="w-3.5 h-3.5 text-amber-400" />
                    Dashboard
                  </Link>
                  <button
                    onClick={onLogout}
                    className="text-xs text-zinc-400 hover:text-red-400 p-1.5 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    href="/login"
                    className={cn(
                      "text-xs font-medium transition-colors px-3 py-1.5 rounded-lg",
                      theme === "dark" ? "text-zinc-300 hover:text-white" : "text-slate-700 hover:text-slate-900"
                    )}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-semibold text-xs transition-all shadow-md shadow-amber-500/20 hover:shadow-amber-500/30 active:scale-[0.98]"
                  >
                    Get Started Free
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className={cn(
                "p-2 rounded-lg border md:hidden transition-colors",
                theme === "dark"
                  ? "bg-[#141724] border-white/[0.08] text-zinc-300"
                  : "bg-slate-100 border-slate-200 text-slate-700"
              )}
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div
            className={cn(
              "md:hidden border-b px-4 py-5 space-y-4 animate-fadeIn transition-colors",
              theme === "dark"
                ? "bg-[#0c0e17] border-white/[0.08]"
                : "bg-white border-slate-200 shadow-lg"
            )}
          >
            <nav className="flex flex-col space-y-3 text-sm font-medium">
              <a
                href="#simulator"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-zinc-400 hover:text-amber-400 transition-colors"
              >
                Live Simulator
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-zinc-400 hover:text-amber-400 transition-colors"
              >
                Core Architecture
              </a>
              <a
                href="#comparison"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-zinc-400 hover:text-amber-400 transition-colors"
              >
                Why Not ChatGPT?
              </a>
              <a
                href="#workflow"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-zinc-400 hover:text-amber-400 transition-colors"
              >
                How It Works
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-zinc-400 hover:text-amber-400 transition-colors"
              >
                FAQ
              </a>
            </nav>

            <div className="pt-3 border-t border-white/[0.06] flex flex-col gap-2.5">
              {user ? (
                <>
                  <Link
                    href="/kits"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-center text-xs"
                  >
                    Go to Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      onLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-2 text-center text-xs text-red-400"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-2.5 px-4 rounded-xl border border-white/10 text-center text-xs font-semibold"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-center text-xs shadow-md shadow-amber-500/20"
                  >
                    Get Started Free
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
