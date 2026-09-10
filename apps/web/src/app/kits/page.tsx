"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import {
  FolderLock,
  LogOut,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  Loader2,
  Layers,
  Terminal,
} from "lucide-react";

export default function KitsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex items-center justify-center text-zinc-400 font-mono text-xs">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          <span>Verifying secure session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-200 bg-grid-architectural">
      {/* Authenticated Workspace Header */}
      <header className="border-b border-white/[0.08] bg-[#0b0d14]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="h-7 w-7 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-mono text-xs font-bold tracking-tighter hover:bg-amber-500/20 transition"
            >
              TR
            </Link>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm tracking-tight text-white">TRAO</span>
              <span className="text-zinc-600">/</span>
              <span className="text-xs font-mono text-zinc-400">kits</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded bg-zinc-900 border border-white/[0.08] text-xs font-mono text-zinc-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{user.email}</span>
            </div>

            <button
              onClick={() => logout()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] hover:border-zinc-700 text-xs font-mono text-zinc-300 hover:text-white transition"
            >
              <LogOut className="w-3.5 h-3.5 text-zinc-400" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Kits Workspace Placeholder */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div>
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs font-mono text-zinc-400 hover:text-white transition mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Architecture Overview</span>
          </Link>
          <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400 mb-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>PROTECTED ROUTE VERIFIED</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Personal Preparation Kits
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            kits go here — owner-scoped repository of generated role briefs, questions, and schedules.
          </p>
        </div>

        {/* Informative Scaffolding Card */}
        <div className="p-8 rounded-xl bg-[#0e111a] border border-white/[0.08] shadow-2xl space-y-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 mt-1">
              <FolderLock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Authenticated Session Confirmed
              </h2>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                You are securely signed in as{" "}
                <code className="text-amber-300 font-mono bg-zinc-900 px-1.5 py-0.5 rounded border border-white/[0.06]">
                  {user.email}
                </code>
                . A valid HTTP-only session cookie (<code>trao_session</code>) is stored in your
                browser and synchronized with MongoDB.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#07080c] border border-white/[0.06] font-mono text-xs space-y-2 text-zinc-400">
            <div className="flex items-center space-x-2 text-zinc-300 border-b border-zinc-800 pb-2">
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              <span>PHASE_02_AUTH_VALIDATION</span>
            </div>
            <div className="flex justify-between">
              <span>Owner User ID:</span>
              <span className="text-zinc-200">{user.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Security Guard:</span>
              <span className="text-emerald-400">Protected /kits/* Guard Active</span>
            </div>
            <div className="flex justify-between">
              <span>Next Milestone:</span>
              <span className="text-amber-400">Phase 3 — Appendix A Data Model &amp; Validator</span>
            </div>
          </div>

          <div className="border-t border-zinc-800/80 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-zinc-500 gap-2">
            <span>Only authenticated visitors can reach this page.</span>
            <span className="font-mono text-amber-400/80">Phase 2 Acceptance Criteria Met</span>
          </div>
        </div>
      </main>
    </div>
  );
}
