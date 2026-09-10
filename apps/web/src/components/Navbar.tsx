"use client";

import React from "react";
import Link from "next/navigation";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/kits" && (pathname === "/kits" || pathname.startsWith("/kits/"))) {
      if (pathname === "/kits/new") return false;
      return true;
    }
    return pathname === path;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-[#090a0f]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <a
            href="/kits"
            className="flex items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded px-1"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 border border-zinc-700/70 group-hover:border-amber-500/50 transition-colors shadow-sm">
              <span className="text-xs font-mono font-bold text-amber-400">TR</span>
            </div>
            <span className="font-semibold tracking-tight text-zinc-100 group-hover:text-white transition-colors">
              TRAO
            </span>
            <span className="hidden sm:inline-block text-[10px] uppercase font-mono font-medium tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              AI Prep Kit
            </span>
          </a>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <a
              href="/kits"
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive("/kits")
                  ? "bg-zinc-800/80 text-white border border-zinc-700/60"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              My Kits
            </a>
            <a
              href="/kits/new"
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                pathname === "/kits/new"
                  ? "bg-zinc-800/80 text-white border border-zinc-700/60"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              + Create Prep Kit
            </a>
          </nav>
        </div>

        {/* User Session / Auth actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="max-w-[180px] truncate font-mono text-[11px] text-zinc-300">
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
              <a
                href="/login"
                className="px-3 py-1.5 rounded text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors"
              >
                Sign In
              </a>
              <a
                href="/register"
                className="px-3 py-1.5 rounded text-xs font-medium bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold transition-colors shadow-sm"
              >
                Register
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
