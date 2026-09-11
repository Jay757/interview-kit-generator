"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ThemeToggle } from "./ui/ThemeToggle";
import { cn } from "../lib/utils";

export function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/kits" && (pathname === "/kits" || pathname.startsWith("/kits/"))) {
      if (pathname === "/kits/new") return false;
      return true;
    }
    return pathname === path;
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b backdrop-blur-md transition-colors duration-200",
        theme === "dark"
          ? "border-zinc-800/80 bg-[#090a0f]/90"
          : "border-slate-200 bg-white/90 shadow-sm"
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link
            href="/kits"
            className="flex items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded px-1"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 border border-zinc-700/70 group-hover:border-amber-500/50 transition-colors shadow-sm">
              <span className="text-xs font-mono font-bold text-amber-400">TR</span>
            </div>
            <span
              className={cn(
                "font-semibold tracking-tight transition-colors",
                theme === "dark" ? "text-zinc-100 group-hover:text-white" : "text-slate-800 group-hover:text-slate-950"
              )}
            >
              TRAO
            </span>
            <span className="hidden sm:inline-block text-[10px] uppercase font-mono font-medium tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
              AI Prep Kit
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/kits"
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                isActive("/kits")
                  ? theme === "dark"
                    ? "bg-zinc-800/80 text-white border border-zinc-700/60"
                    : "bg-slate-100 text-slate-900 border border-slate-300 font-semibold"
                  : theme === "dark"
                  ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              My Kits
            </Link>
            <Link
              href="/kits/new"
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                pathname === "/kits/new"
                  ? theme === "dark"
                    ? "bg-zinc-800/80 text-white border border-zinc-700/60"
                    : "bg-slate-100 text-slate-900 border border-slate-300 font-semibold"
                  : theme === "dark"
                  ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              + Create Prep Kit
            </Link>
          </nav>
        </div>

        {/* User Session / Theme Switch / Auth actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />

          {user ? (
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs",
                  theme === "dark"
                    ? "bg-zinc-900 border-zinc-800 text-zinc-400"
                    : "bg-slate-100 border-slate-200 text-slate-600"
                )}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="max-w-[180px] truncate font-mono text-[11px]">
                  {user.email}
                </span>
              </div>
              <button
                onClick={() => logout()}
                className="px-2.5 py-1 rounded text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  theme === "dark"
                    ? "text-zinc-300 hover:text-white hover:bg-zinc-800/60"
                    : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                )}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-3 py-1.5 rounded text-xs font-medium bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold transition-colors shadow-sm"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
