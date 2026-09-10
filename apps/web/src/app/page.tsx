"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import {
  Activity,
  Check,
  Cpu,
  Database,
  ExternalLink,
  FolderLock,
  GitBranch,
  Globe,
  LogOut,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  User as UserIcon,
  Zap,
} from "lucide-react";

interface HealthData {
  status: string;
  timestamp?: string;
  latencyMs?: number;
}

export default function Home() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<string | null>(null);

  const { user, logout, loading: authLoading } = useAuth();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();
    try {
      const res = await fetch(`${apiUrl}/health`, { cache: "no-store" });
      const latencyMs = Math.round(performance.now() - start);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setHealth({
        ...data,
        latencyMs,
      });
      setLastCheck(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || "Failed to reach backend API");
      setHealth(null);
      setLastCheck(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const pipelineStages = [
    {
      id: "01",
      name: "Monorepo Skeleton",
      desc: "Workspaces, Express + Next.js, Mongoose & Health Handshake",
      status: "complete",
    },
    {
      id: "02",
      name: "Session Auth",
      desc: "User auth, MongoDB session store, protected routes",
      status: "complete",
    },
    {
      id: "03",
      name: "Kit Data Models",
      desc: "Appendix A schema, Zod runtime validator, owner CRUD",
      status: "current",
    },
    {
      id: "04",
      name: "Crawler & Retrieval",
      desc: "Cheerio link ranker, SSRF barrier, robots.txt compliance",
      status: "upcoming",
    },
    {
      id: "05",
      name: "LLM Extraction",
      desc: "Gemini client wrapper, requirements (must/nice), company brief",
      status: "upcoming",
    },
    {
      id: "06",
      name: "Question & Cards",
      desc: "Category-conditioned question synthesis and flashcards",
      status: "upcoming",
    },
    {
      id: "07",
      name: "Schedule & Coverage",
      desc: "Deterministic priority allocation & gap-filling loop",
      status: "upcoming",
    },
    {
      id: "08",
      name: "Orchestration & CLI",
      desc: "Async pipeline generation + Appendix B batch runner",
      status: "upcoming",
    },
  ];

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-200 bg-grid-architectural selection:bg-amber-500/20 selection:text-amber-300">
      {/* Top Engineering Nav Bar */}
      <header className="border-b border-white/[0.08] bg-[#0b0d14]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-7 w-7 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-mono text-xs font-bold tracking-tighter">
              TR
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm tracking-tight text-white">TRAO</span>
              <span className="text-zinc-600">/</span>
              <span className="text-xs font-mono text-zinc-400 tracking-wide">
                AI Interview Prep Kit
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Live System Heartbeat Pill */}
            <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-zinc-900 border border-white/[0.08] text-xs font-mono">
              <span className="relative flex h-2 w-2">
                {health ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                )}
              </span>
              <span className="text-zinc-400">
                API:{" "}
                <span className={health ? "text-emerald-400 font-medium" : "text-rose-400 font-medium"}>
                  {loading ? "Checking..." : health ? "Connected" : "Offline"}
                </span>
              </span>
              {health?.latencyMs !== undefined && (
                <span className="text-zinc-600 border-l border-zinc-800 pl-2">
                  {health.latencyMs}ms
                </span>
              )}
            </div>

            <button
              onClick={fetchHealth}
              disabled={loading}
              title="Refresh telemetry"
              className="p-1.5 rounded bg-zinc-900 border border-white/[0.08] hover:border-zinc-700 text-zinc-400 hover:text-white transition disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-400" : ""}`} />
            </button>

            {/* Auth Navigation */}
            <div className="flex items-center space-x-2 pl-2 border-l border-zinc-800">
              {authLoading ? (
                <div className="h-7 w-20 bg-zinc-900 rounded animate-pulse" />
              ) : user ? (
                <div className="flex items-center space-x-2">
                  <Link
                    href="/kits"
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-300 hover:bg-amber-500/20 transition"
                  >
                    <FolderLock className="w-3 h-3 text-amber-400" />
                    <span className="truncate max-w-[120px]">{user.email}</span>
                  </Link>
                  <button
                    onClick={() => logout()}
                    title="Sign out"
                    className="p-1.5 rounded bg-zinc-900 border border-white/[0.08] hover:border-zinc-700 text-zinc-400 hover:text-white transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link
                    href="/login"
                    className="px-2.5 py-1 rounded bg-zinc-900 border border-white/[0.08] hover:border-zinc-700 text-xs font-mono text-zinc-300 hover:text-white transition"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-medium transition shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Architectural Header */}
        <section className="space-y-3">
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium tracking-wide uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Radio className="w-3 h-3 text-amber-400 animate-pulse" />
            <span>Principal Engineering Workspace • Phase 1 Active</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Interview Intelligence Architecture
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-3xl leading-relaxed">
            Multi-stage autonomous pipeline transforming unformatted job descriptions and target
            company domains into verified, structured interview preparation kits.
          </p>
        </section>

        {/* Telemetry & System Status Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Node 1: API */}
          <div className="p-5 rounded-lg bg-[#0e111a] border border-white/[0.08] flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded bg-zinc-900 border border-white/[0.06] text-amber-400">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs uppercase font-mono tracking-wider text-zinc-400">
                    Backend Service
                  </h3>
                  <p className="text-sm font-medium text-white">Express 4 + TypeScript</p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                Port 4000
              </span>
            </div>

            <div className="pt-3 border-t border-zinc-800/80 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Target:</span>
                <span className="text-zinc-200">{apiUrl}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Handshake:</span>
                <span className={health ? "text-emerald-400" : "text-rose-400"}>
                  {health ? "200 OK (status: ok)" : error || "Unreachable"}
                </span>
              </div>
            </div>
          </div>

          {/* Node 2: Database */}
          <div className="p-5 rounded-lg bg-[#0e111a] border border-white/[0.08] flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded bg-zinc-900 border border-white/[0.06] text-amber-400">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs uppercase font-mono tracking-wider text-zinc-400">
                    Persistence Layer
                  </h3>
                  <p className="text-sm font-medium text-white">MongoDB + Mongoose</p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                Port 27017
              </span>
            </div>

            <div className="pt-3 border-t border-zinc-800/80 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Database:</span>
                <span className="text-zinc-200">trao_dev</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Session Store:</span>
                <span className="text-amber-400">connect-mongo (Phase 2)</span>
              </div>
            </div>
          </div>

          {/* Node 3: LLM & Scraper Engine */}
          <div className="p-5 rounded-lg bg-[#0e111a] border border-white/[0.08] flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded bg-zinc-900 border border-white/[0.06] text-amber-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs uppercase font-mono tracking-wider text-zinc-400">
                    Inference & Scraping
                  </h3>
                  <p className="text-sm font-medium text-white">Gemini 2.5 + Cheerio</p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                Free Tier
              </span>
            </div>

            <div className="pt-3 border-t border-zinc-800/80 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>SSRF Barrier:</span>
                <span className="text-emerald-400">Strict IP Filtering</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Deterministic Core:</span>
                <span className="text-zinc-200">Pure TS Schedule/Gap</span>
              </div>
            </div>
          </div>
        </section>

        {/* Live Payload Inspector */}
        <section className="p-5 rounded-lg bg-[#0c0e16] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center space-x-2 text-xs font-mono text-zinc-300">
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              <span>LIVE_TELEMETRY_LOG</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">
              Updated: {lastCheck || "Init"}
            </span>
          </div>

          <div className="bg-[#07080c] rounded p-4 border border-white/[0.04] font-mono text-xs text-zinc-300 overflow-x-auto">
            {loading ? (
              <div className="flex items-center space-x-2 text-zinc-500 py-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Executing HTTP ping to {apiUrl}/health...</span>
              </div>
            ) : health ? (
              <div className="space-y-1">
                <div className="text-emerald-400">
                  HTTP/1.1 200 OK • Connection established
                </div>
                <div className="text-zinc-500">
                  {`{`}
                  <div className="pl-4 text-amber-300">
                    &quot;status&quot;: &quot;{health.status}&quot;,
                  </div>
                  <div className="pl-4 text-zinc-400">
                    &quot;roundTripLatencyMs&quot;: {health.latencyMs},
                  </div>
                  <div className="pl-4 text-zinc-400">
                    &quot;checkedAt&quot;: &quot;{new Date().toISOString()}&quot;
                  </div>
                  {`}`}
                </div>
              </div>
            ) : (
              <div className="text-rose-400 space-y-1">
                <div>[CRITICAL] Connection failure to API server:</div>
                <div className="text-zinc-400 pl-4">&gt; {error}</div>
                <div className="text-zinc-500 pl-4">Ensure `apps/api` is running on port 4000.</div>
              </div>
            )}
          </div>
        </section>

        {/* Phase-by-Phase Architecture Board */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                System Lifecycle & Pipeline Phases
              </h2>
              <p className="text-xs text-zinc-400">
                Incremental roadmap adhering to 00-RULES.md specifications and PRD requirements.
              </p>
            </div>
            <div className="text-xs font-mono text-zinc-500">
              Target Commit Scope: Conventional Commits
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {pipelineStages.map((stage) => {
              const isDone = stage.status === "complete";
              const isCurrent = stage.status === "current";

              return (
                <div
                  key={stage.id}
                  className={`p-4 rounded-lg border transition ${
                    isDone
                      ? "bg-[#0b1017] border-emerald-500/30"
                      : isCurrent
                      ? "bg-[#14120c] border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.07)]"
                      : "bg-[#0c0e16] border-white/[0.05] opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-semibold text-zinc-500">
                      PHASE {stage.id}
                    </span>
                    {isDone ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Check className="w-2.5 h-2.5" />
                        <span>MERGED</span>
                      </span>
                    ) : isCurrent ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold animate-pulse">
                        <span>IN QUEUE</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-600">PENDING</span>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">{stage.name}</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">{stage.desc}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Engineering Footer */}
      <footer className="border-t border-white/[0.08] py-6 mt-12 bg-[#08090d] text-zinc-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-2 font-mono">
            <GitBranch className="w-3.5 h-3.5 text-zinc-400" />
            <span>branch: master</span>
            <span>•</span>
            <span>commit: befb3d9</span>
          </div>
          <div>Trao Assessment • Strict Appendix A & B Compliance</div>
        </div>
      </footer>
    </div>
  );
}
