"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "../../components/Navbar";
import { useAuth } from "../../context/AuthContext";
import {
  Sparkles,
  Plus,
  Search,
  Trash2,
  ExternalLink,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Shield,
  Layers,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface KitSummary {
  _id: string;
  ownerId: string;
  status: "generating" | "completed" | "failed";
  progressStage?: string;
  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];
  };
  role: {
    title: string;
    seniority: string;
    requirements: any[];
  };
  questions: any[];
  flashcards: any[];
  schedule: {
    days_available: number;
    days: any[];
  };
  createdAt: string;
  updatedAt: string;
}

export default function KitsDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [kits, setKits] = useState<KitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "generating" | "failed">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch kits from API
  const fetchKits = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/kits`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setKits(data.kits || []);
      } else if (res.status === 401) {
        // Not logged in -> redirect to login
        router.push("/login");
      }
    } catch (err) {
      console.error("Failed to load kits:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else {
        fetchKits();
      }
    }
  }, [user, authLoading]);

  // Polling for generating kits every 3s
  useEffect(() => {
    const hasGenerating = kits.some((k) => k.status === "generating");
    if (!hasGenerating) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/kits`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setKits(data.kits || []);
        }
      } catch {
        // ignore polling error
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [kits]);

  // Delete kit
  const handleDeleteKit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this prep kit?")) return;

    try {
      setDeletingId(id);
      const res = await fetch(`${API_URL}/kits/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        setKits((prev) => prev.filter((k) => k._id !== id));
      } else {
        alert("Failed to delete kit.");
      }
    } catch (err: any) {
      alert("Error deleting kit: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered kits
  const filteredKits = useMemo(() => {
    return kits.filter((k) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        k.source.company?.toLowerCase().includes(q) ||
        k.role.title?.toLowerCase().includes(q) ||
        k.source.role?.toLowerCase().includes(q);

      const matchStatus = statusFilter === "all" || k.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [kits, searchQuery, statusFilter]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#090a0f] dark:text-zinc-100 bg-grid-architectural transition-colors duration-200">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Header & Fast Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                Interview Prep Kits
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700">
                {kits.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              Personalized interview study kits grounded in live company intelligence.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/kits/new"
              className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-950 transition-all shadow-md active:scale-[0.99]"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Create Prep Kit</span>
            </a>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by company or role..."
              className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder-zinc-500 pl-9 pr-4 py-2 text-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center p-1 bg-slate-100 border border-slate-200 dark:bg-zinc-900/90 dark:border-zinc-800 rounded-lg text-xs font-medium self-start sm:self-auto">
            {(["all", "completed", "generating", "failed"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md capitalize transition-colors ${
                  statusFilter === st
                    ? "bg-white text-amber-600 shadow-sm font-bold dark:bg-zinc-800 dark:text-amber-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-48 rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-[#0f1117] p-5 animate-pulse space-y-4 shadow-sm"
              >
                <div className="h-4 w-1/3 bg-slate-200 dark:bg-zinc-800 rounded" />
                <div className="h-6 w-3/4 bg-slate-200 dark:bg-zinc-800 rounded" />
                <div className="h-4 w-1/2 bg-slate-200 dark:bg-zinc-800 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredKits.length === 0 && (
          <div className="mt-12 rounded-2xl border border-dashed border-slate-300 bg-white/70 dark:border-zinc-800 dark:bg-[#0f1117]/60 p-12 text-center max-w-lg mx-auto space-y-4 shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-950 dark:text-white">No Prep Kits Found</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              {searchQuery
                ? "No kits matched your search query. Try clearing the filter."
                : "You haven't generated any interview preparation kits yet. Paste a job description to synthesize your first kit in seconds."}
            </p>
            <div>
              <a
                href="/kits/new"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Create Your First Kit</span>
              </a>
            </div>
          </div>
        )}

        {/* Kits Grid */}
        {!loading && filteredKits.length > 0 && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredKits.map((kit) => {
              const isGenerating = kit.status === "generating";
              const isFailed = kit.status === "failed";
              const isReady = kit.status === "completed";

              const company = kit.source.company || "Target Company";
              const roleTitle = kit.role?.title || kit.source?.role || "Target Role";

              return (
                <div
                  key={kit._id}
                  onClick={() => router.push(`/kits/${kit._id}`)}
                  className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white dark:border-zinc-800/90 dark:bg-[#0f1117] p-5 shadow-sm transition-all hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-md hover:bg-slate-50 dark:hover:bg-[#12141c] flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header line: Company & Status badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs uppercase tracking-wider text-amber-500 dark:text-amber-400 font-bold truncate max-w-[160px]">
                        {company}
                      </span>

                      {/* Status indicator */}
                      <div>
                        {isReady && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                            Ready
                          </span>
                        )}
                        {isGenerating && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {kit.progressStage || "Generating..."}
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">
                            <AlertCircle className="h-3 w-3" />
                            Failed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Role Title */}
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 group-hover:text-slate-950 dark:group-hover:text-white transition-colors line-clamp-2 leading-snug">
                        {roleTitle}
                      </h2>
                      {kit.role?.seniority && (
                        <span className="mt-1 inline-block text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                          {kit.role.seniority} • {kit.source?.location || "Remote"}
                        </span>
                      )}
                    </div>

                    {/* Metric Badges */}
                    {isReady && (
                      <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-200 dark:border-zinc-800/80 text-center font-mono">
                        <div className="bg-slate-100 dark:bg-zinc-950/60 p-1.5 rounded border border-slate-200 dark:border-zinc-800/60">
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block">
                            {kit.questions?.length || 0}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                            Questions
                          </span>
                        </div>
                        <div className="bg-slate-100 dark:bg-zinc-950/60 p-1.5 rounded border border-slate-200 dark:border-zinc-800/60">
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                            {kit.flashcards?.length || 0}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                            Cards
                          </span>
                        </div>
                        <div className="bg-slate-100 dark:bg-zinc-950/60 p-1.5 rounded border border-slate-200 dark:border-zinc-800/60">
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block">
                            {kit.schedule?.days_available || 5}d
                          </span>
                          <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                            Timeline
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Timestamp & Delete action */}
                  <div className="mt-4 pt-3 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 border-t border-slate-200 dark:border-zinc-800/60 font-mono">
                    <span>
                      {new Date(kit.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteKit(kit._id, e)}
                        disabled={deletingId === kit._id}
                        className="p-1 rounded text-slate-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete Kit"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      <span className="text-amber-500 dark:text-amber-400 font-sans group-hover:translate-x-0.5 transition-transform">
                        →
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
