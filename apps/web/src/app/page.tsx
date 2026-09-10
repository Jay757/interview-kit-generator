"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, Layers, Server, Globe } from "lucide-react";

interface HealthStatus {
  status: string;
  timestamp?: string;
  latencyMs?: number;
}

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();
    try {
      const res = await fetch(`${apiUrl}/health`);
      const latencyMs = Math.round(performance.now() - start);
      if (!res.ok) {
        throw new Error(`API returned HTTP ${res.status}`);
      }
      const data = await res.json();
      setHealth({
        ...data,
        timestamp: new Date().toLocaleTimeString(),
        latencyMs,
      });
    } catch (err: any) {
      setError(err.message || "Could not reach API server");
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-2xl bg-slate-800/80 border border-slate-700/80 backdrop-blur rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Layers className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Trao AI Interview Prep Kit
            </h1>
            <p className="text-sm text-slate-400">
              Phase 1 Monorepo Verification & Health Check
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3">
              <Globe className="w-5 h-5 text-indigo-400 mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                  Web Frontend (Next.js)
                </p>
                <p className="text-sm font-semibold text-slate-200 mt-1">
                  Active (Port 3000)
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3">
              <Server className="w-5 h-5 text-indigo-400 mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                  API Target URL
                </p>
                <p className="text-sm font-semibold text-slate-200 mt-1 font-mono text-xs truncate max-w-[180px]">
                  {apiUrl}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-slate-300">
                  API Connectivity Check:
                </span>
                {loading ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Connecting...
                  </span>
                ) : health ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Healthy (200 OK)
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Disconnected
                  </span>
                )}
              </div>

              <button
                onClick={checkHealth}
                disabled={loading}
                className="inline-flex items-center space-x-1 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {health && (
              <div className="flex items-center space-x-3 text-emerald-400 bg-emerald-950/40 p-3.5 rounded-lg border border-emerald-900/60 text-sm">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-white">
                    API Response:{" "}
                    <code className="bg-slate-800 px-1.5 py-0.5 rounded text-emerald-300 font-mono">
                      {JSON.stringify({ status: health.status })}
                    </code>
                  </p>
                  <p className="text-xs text-slate-400">
                    Ping completed in {health.latencyMs}ms at {health.timestamp}
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center space-x-3 text-rose-400 bg-rose-950/40 p-3.5 rounded-lg border border-rose-900/60 text-sm">
                <XCircle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-white">Connection Error</p>
                  <p className="text-xs text-rose-300 mt-0.5">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-700/60 text-xs text-slate-500 flex justify-between items-center">
          <span>Trao Assessment — Monorepo Skeleton</span>
          <span>Phase 1 of 14 Completed</span>
        </div>
      </div>
    </main>
  );
}
