"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import {
  LogOut,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  Loader2,
  Terminal,
  Cpu,
  Globe,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Database,
} from "lucide-react";

const SAMPLE_REALISTIC_JD = `Role: Senior Backend Engineer (Node.js & Distributed Systems)
Company: Apex Stream Systems

Job Overview:
Apex Stream Systems builds high-throughput real-time message routing infrastructure for global logistics networks.

Core Requirements (Must Have):
- 5+ years building distributed backend services using Node.js and TypeScript (Required)
- Production expertise with PostgreSQL, schema partitioning, and query optimization (Required)
- Experience designing fault-tolerant systems using message queues like Kafka or RabbitMQ (Must have)
- Strong cross-functional technical communication and system design documentation (Required)

Preferred Qualifications (Nice to Have):
- Hands-on experience with Kubernetes orchestration and Helm charts (Bonus)
- Prior exposure to Go or Rust for latency-sensitive network services (Nice to have)
- Familiarity with enterprise compliance standards such as SOC 2 or ISO 27001 (Preferred)`;

const SAMPLE_THIN_JD = `We are looking for a Senior React Engineer to join our team.
Must have 4+ years of professional React, TypeScript, and Next.js experience.`;

interface ExtractedRequirement {
  id: string;
  text: string;
  kind: "technical" | "behavioural" | "domain";
  priority: "must" | "nice";
  state: "generated" | "edited" | "pinned";
}

interface ExtractedBrief {
  summary: string;
  what_they_do: string;
}

export default function KitsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [jdText, setJdText] = useState(SAMPLE_REALISTIC_JD);
  const [companyUrl, setCompanyUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    requirements: ExtractedRequirement[];
    companyBrief: ExtractedBrief;
    crawledPages: { used: string[]; skipped: any[] };
    latencyMs: number;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  const handleRunExtraction = async () => {
    if (!jdText.trim()) {
      setError("Please provide a Job Description text.");
      return;
    }

    setExtracting(true);
    setError(null);
    const startTime = performance.now();

    try {
      const res = await fetch("http://localhost:4000/kits/preview-extraction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          jdText: jdText.trim(),
          companyUrl: companyUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      const endTime = performance.now();

      if (!res.ok) {
        throw new Error(data.error?.message || "Extraction failed");
      }

      setResult({
        requirements: data.requirements,
        companyBrief: data.companyBrief,
        crawledPages: data.crawledPages || { used: [], skipped: [] },
        latencyMs: Math.round(endTime - startTime),
      });
    } catch (err: any) {
      setError(err.message || "An error occurred during extraction.");
    } finally {
      setExtracting(false);
    }
  };

  if (authLoading) {
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
    return null;
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-200 bg-grid-architectural selection:bg-amber-500/20 selection:text-amber-200">
      {/* Authenticated Header */}
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
              <span className="text-xs font-mono text-zinc-400">test-extraction</span>
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

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div>
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs font-mono text-zinc-400 hover:text-white transition mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to System Console</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-mono text-amber-400 mb-1">
                <Cpu className="w-3.5 h-3.5" />
                <span>PHASE 5 LIVE TEST BENCH</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                OpenRouter Extraction Playground
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Live test of requirement parsing (must vs. nice) &amp; company brief generation using OpenRouter.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                OpenRouter Gateway
              </span>
            </div>
          </div>
        </div>

        {/* Input Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <div className="p-6 rounded-xl bg-[#0e111a] border border-white/[0.08] shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Job Description Text</span>
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setJdText(SAMPLE_REALISTIC_JD)}
                    className="text-[11px] font-mono text-zinc-400 hover:text-amber-400 transition underline underline-offset-2"
                  >
                    Sample Real JD
                  </button>
                  <span className="text-zinc-700">|</span>
                  <button
                    type="button"
                    onClick={() => setJdText(SAMPLE_THIN_JD)}
                    className="text-[11px] font-mono text-zinc-400 hover:text-amber-400 transition underline underline-offset-2"
                  >
                    Sample Thin JD
                  </button>
                </div>
              </div>

              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                rows={12}
                placeholder="Paste job description here..."
                className="w-full bg-[#07080c] border border-white/[0.08] rounded-lg p-3.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 resize-y leading-relaxed"
              />

              <div>
                <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center space-x-1.5 mb-2">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Company Website URL (Optional Crawler Test)</span>
                </label>
                <input
                  type="text"
                  value={companyUrl}
                  onChange={(e) => setCompanyUrl(e.target.value)}
                  placeholder="https://example.com (leave empty for honest no-info fallback)"
                  className="w-full bg-[#07080c] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  If left blank, Rule 4 triggers: returns honest no-info without hallucinating.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Extraction Failed</p>
                    <p className="text-rose-400/90 font-mono text-[11px]">{error}</p>
                    {error.includes("OPENROUTER_API_KEY is missing") && (
                      <p className="text-zinc-300 text-[11px] mt-1">
                        👉 Please paste your OpenRouter key into <code className="text-amber-300 bg-zinc-900 px-1 py-0.5 rounded">apps/api/.env</code> as <code className="text-amber-300 bg-zinc-900 px-1 py-0.5 rounded">OPENROUTER_API_KEY=sk-or-v1-...</code> and retry!
                      </p>
                    )}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleRunExtraction}
                disabled={extracting}
                className="w-full py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs font-mono tracking-wide transition flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extracting via OpenRouter...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Run OpenRouter Extraction</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-6 space-y-4">
            {result ? (
              <div className="space-y-4">
                {/* Latency & Crawl Telemetry */}
                <div className="p-4 rounded-xl bg-[#0e111a] border border-white/[0.08] flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-zinc-200 font-semibold">Extraction Complete</span>
                  </div>
                  <div className="flex items-center space-x-3 text-zinc-400">
                    <span>Latency: <strong className="text-amber-400">{result.latencyMs}ms</strong></span>
                    <span>•</span>
                    <span>Reqs: <strong className="text-white">{result.requirements.length}</strong></span>
                  </div>
                </div>

                {/* Company Brief Card */}
                <div className="p-5 rounded-xl bg-[#0e111a] border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase font-mono text-amber-400 flex items-center space-x-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Company Brief (Rule 4 Verified)</span>
                    </span>
                    {companyUrl ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        Crawled Pages: {result.crawledPages.used.length}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-white/[0.08]">
                        Zero-Hallucination Fallback
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-zinc-500 font-mono text-[10px] uppercase">Summary</span>
                      <p className="text-zinc-200 mt-0.5 leading-relaxed bg-[#07080c] p-2.5 rounded border border-white/[0.05]">
                        {result.companyBrief.summary}
                      </p>
                    </div>
                    <div>
                      <span className="text-zinc-500 font-mono text-[10px] uppercase">What They Do</span>
                      <p className="text-zinc-200 mt-0.5 leading-relaxed bg-[#07080c] p-2.5 rounded border border-white/[0.05]">
                        {result.companyBrief.what_they_do}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Grounded Requirements List */}
                <div className="p-5 rounded-xl bg-[#0e111a] border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase font-mono text-amber-400 flex items-center space-x-1.5">
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Extracted Requirements ({result.requirements.length})</span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Stable IDs r1, r2... in Code
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                    {result.requirements.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 rounded-lg bg-[#07080c] border border-white/[0.06] hover:border-white/[0.12] transition space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {req.id}
                          </span>

                          <div className="flex items-center space-x-1.5">
                            {/* Priority Badge */}
                            <span
                              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                                req.priority === "must"
                                  ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                  : "bg-zinc-800 text-zinc-400 border border-white/[0.08]"
                              }`}
                            >
                              {req.priority}
                            </span>

                            {/* Kind Badge */}
                            <span
                              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                                req.kind === "technical"
                                  ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                                  : req.kind === "behavioural"
                                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                              }`}
                            >
                              {req.kind}
                            </span>

                            <span className="text-[10px] font-mono text-zinc-600">
                              [{req.state}]
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-zinc-200 leading-relaxed">
                          {req.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Empty Placeholder State */
              <div className="h-full min-h-[380px] p-8 rounded-xl bg-[#0e111a] border border-dashed border-white/[0.1] flex flex-col items-center justify-center text-center space-y-4">
                <div className="p-3 rounded-full bg-zinc-900 border border-white/[0.08] text-zinc-400">
                  <Terminal className="w-6 h-6 text-amber-400/80" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-sm font-semibold text-white">Extraction Output Ready</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Click <strong>&quot;Run OpenRouter Extraction&quot;</strong> to call your model. Extracted must/nice requirements and company intelligence will render here in real-time.
                  </p>
                </div>
                <div className="p-3 rounded bg-[#07080c] border border-white/[0.06] text-[11px] font-mono text-zinc-500 text-left space-y-1">
                  <div>✓ Strict Grounding (no hallucinations)</div>
                  <div>✓ Must vs. Nice separation</div>
                  <div>✓ Stable code-assigned IDs (r1, r2...)</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
