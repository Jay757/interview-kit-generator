"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "../../../components/Navbar";
import { useAuth } from "../../../context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const SAMPLE_JDS = {
  backend: {
    name: "Staff Backend (Stripe)",
    url: "https://stripe.com",
    days: 5,
    jd: `Staff Infrastructure Engineer
Location: Remote (US / Canada)
Responsibilities:
- Architect distributed payment ledger systems processing >10,000 TPS
- Drive architectural RFCs for multi-region consensus and zero-downtime database migrations
- Mentor staff and senior engineers on fault tolerance and chaos engineering

Requirements:
- 7+ years building high-throughput distributed systems in Go, Java, or Rust
- Deep expertise with consensus protocols (Raft, Paxos), partition tolerance, and linearizability
- Strong experience debugging low-level memory leaks, thread pool starvation, and tail latencies
- Track record of leading cross-functional engineering initiatives and blameless postmortems
- Preferred: Experience with financial compliance, idempotency keys, and ledger double-entry systems`,
  },
  frontend: {
    name: "Senior Frontend (Vercel)",
    url: "https://vercel.com",
    days: 3,
    jd: `Senior Frontend Platform Engineer
Location: San Francisco / Remote
Responsibilities:
- Build high-performance edge rendering architectures and developer toolkits
- Optimize Core Web Vitals (INP, LCP, CLS) across millions of production deployments
- Collaborate with designers on design system primitives and accessibility standards

Requirements:
- 5+ years of production experience with TypeScript, Next.js, and React Server Components
- Deep mastery of modern browser rendering engines, micro-animations, and stream hydration
- Proven expertise in Web Performance Profiling and bundle size optimization
- Strong commitment to accessibility (WCAG 2.1 AA) and keyboard navigation patterns
- Preferred: Experience writing custom AST transforms or bundler plugins`,
  },
  thin: {
    name: "Thin Minimalist JD",
    url: "",
    days: 1,
    jd: `Fullstack Developer
Must be proficient with TypeScript, Node.js, and React. Experience with Docker and PostgreSQL required.`,
  },
};

export default function NewKitPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Mode: "single" | "batch"
  const [mode, setMode] = useState<"single" | "batch">("single");

  // Single Role Form state
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<{ code: string; message: string } | null>(null);

  // Batch Mode state
  const [batchRawText, setBatchRawText] = useState("");
  const [batchParsedRoles, setBatchParsedRoles] = useState<
    Array<{ id: string; jd: string; company_url?: string; days?: number; error?: string }>
  >([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(
    null
  );

  // Quick-load sample JD
  const loadSample = (key: keyof typeof SAMPLE_JDS) => {
    const sample = SAMPLE_JDS[key];
    setJd(sample.jd);
    setCompanyUrl(sample.url);
    setDays(sample.days);
    setValidationError(null);
    setApiError(null);
  };

  // Client-side validation for Single Role
  const validateSingleForm = (): boolean => {
    setValidationError(null);
    setApiError(null);

    const trimmedJd = jd.trim();
    if (!trimmedJd) {
      setValidationError("Job description cannot be empty. Paste the role details above.");
      return false;
    }

    if (trimmedJd.length < 20) {
      setValidationError("Job description is too brief. Provide at least a couple of sentences or bullet points.");
      return false;
    }

    if (companyUrl.trim()) {
      const url = companyUrl.trim();
      const hasProtocol = url.startsWith("http://") || url.startsWith("https://");
      const urlToTest = hasProtocol ? url : `https://${url}`;
      try {
        new URL(urlToTest);
      } catch {
        setValidationError("Company website URL is invalid. Example: https://stripe.com");
        return false;
      }
    }

    if (!Number.isInteger(days) || days < 1 || days > 60) {
      setValidationError("Preparation timeline must be an integer between 1 and 60 days.");
      return false;
    }

    return true;
  };

  // Submit Single Role
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSingleForm()) return;

    setLoading(true);
    setApiError(null);

    try {
      const formattedUrl = companyUrl.trim()
        ? companyUrl.trim().startsWith("http")
          ? companyUrl.trim()
          : `https://${companyUrl.trim()}`
        : "";

      const res = await fetch(`${API_URL}/kits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          jd: jd.trim(),
          companyUrl: formattedUrl,
          days: Math.floor(days),
        }),
      });

      const data = await res.json();

      if (res.status === 202 || res.status === 200) {
        // Redirect to kit detail page for active progress tracking
        router.push(`/kits/${data.kitId || data.kit?._id}`);
      } else {
        setApiError({
          code: data.error?.code || "SUBMISSION_FAILED",
          message: data.error?.message || "Failed to start kit generation. Please try again.",
        });
        setLoading(false);
      }
    } catch (err: any) {
      setApiError({
        code: "NETWORK_ERROR",
        message: err.message || "Could not connect to the API server.",
      });
      setLoading(false);
    }
  };

  // Parse batch input (JSON array or CSV)
  const parseBatchInput = (text: string) => {
    setBatchRawText(text);
    const trimmed = text.trim();
    if (!trimmed) {
      setBatchParsedRoles([]);
      return;
    }

    // Try JSON parsing
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        const array = Array.isArray(parsed) ? parsed : [parsed];
        const evaluated = array.map((item, idx) => {
          const id = item.id || `role-${idx + 1}`;
          if (!item.jd || typeof item.jd !== "string" || !item.jd.trim()) {
            return { id, jd: "", error: "Missing required 'jd' string" };
          }
          return {
            id,
            jd: item.jd.trim(),
            company_url: item.company_url || item.companyUrl || "",
            days: typeof item.days === "number" && item.days >= 1 ? Math.floor(item.days) : 5,
          };
        });
        setBatchParsedRoles(evaluated);
        return;
      } catch (jsonErr: any) {
        // Fall through to CSV check
      }
    }

    // Simple CSV parser: format: id,company_url,days,jd
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const results: Array<{ id: string; jd: string; company_url?: string; days?: number; error?: string }> = [];

    lines.forEach((line, idx) => {
      // Basic comma separated (skip header if first line has 'company' and 'jd')
      if (idx === 0 && (line.toLowerCase().includes("jd") || line.toLowerCase().includes("description"))) {
        return;
      }
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 2) {
        results.push({ id: `row-${idx + 1}`, jd: "", error: "Row has fewer than 2 comma-separated values" });
        return;
      }
      // Expect: id, company_url, days, jd...
      const id = parts[0] || `row-${idx + 1}`;
      const comp = parts[1] || "";
      const d = parseInt(parts[2], 10) || 5;
      const jobDesc = parts.slice(3).join(",") || parts[1]; // fallback

      if (!jobDesc) {
        results.push({ id, jd: "", error: "Missing JD text" });
      } else {
        results.push({ id, jd: jobDesc, company_url: comp, days: d });
      }
    });

    setBatchParsedRoles(results);
  };

  // Execute batch submissions
  const handleBatchSubmit = async () => {
    const validRoles = batchParsedRoles.filter((r) => !r.error && r.jd);
    if (validRoles.length === 0) return;

    setBatchLoading(true);
    setBatchProgress({ current: 0, total: validRoles.length });

    const createdIds: string[] = [];

    for (let i = 0; i < validRoles.length; i++) {
      const role = validRoles[i];
      setBatchProgress({ current: i + 1, total: validRoles.length });

      try {
        const res = await fetch(`${API_URL}/kits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            jd: role.jd,
            companyUrl: role.company_url || "",
            days: role.days || 5,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          createdIds.push(data.kitId || data.kit?._id);
        }
      } catch (e) {
        console.error(`Batch item ${role.id} failed:`, e);
      }
    }

    setBatchLoading(false);
    // Redirect to kits list showing all newly created kits
    router.push("/kits");
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 bg-grid-architectural">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Breadcrumbs & Title */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2 font-mono">
            <a href="/kits" className="hover:text-zinc-200 transition-colors">
              Kits
            </a>
            <span>/</span>
            <span className="text-amber-400">New Generator</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Generate Interview Prep Kit
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                Ground questions in your exact job description and live company hiring intelligence.
              </p>
            </div>

            {/* Mode Toggle: Single vs Multi-Role Batch */}
            <div className="flex items-center p-1 bg-zinc-900/90 border border-zinc-800 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  mode === "single"
                    ? "bg-amber-500 text-zinc-950 font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Single Role
              </button>
              <button
                type="button"
                onClick={() => setMode("batch")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  mode === "batch"
                    ? "bg-amber-500 text-zinc-950 font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Multi-Role Batch
              </button>
            </div>
          </div>
        </div>

        {/* SINGLE ROLE FORM */}
        {mode === "single" && (
          <form onSubmit={handleSingleSubmit} className="space-y-6">
            {/* Quick Sample Selector Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="font-mono text-amber-400">✦</span>
                <span>Instant Pre-fill:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(SAMPLE_JDS) as Array<keyof typeof SAMPLE_JDS>).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => loadSample(k)}
                    className="px-2.5 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors"
                  >
                    {SAMPLE_JDS[k].name}
                  </button>
                ))}
              </div>
            </div>

            {/* Job Description Card */}
            <div className="rounded-xl border border-zinc-800/90 bg-[#0f1117] p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="jd-input" className="block text-sm font-semibold text-zinc-200">
                  Job Description <span className="text-amber-400">*</span>
                </label>
                <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
                  <span>{jd.length} chars</span>
                  <span>~{Math.max(1, Math.round(jd.trim().split(/\s+/).filter(Boolean).length))} words</span>
                </div>
              </div>

              <textarea
                id="jd-input"
                rows={9}
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste complete job description, responsibilities, and required competencies here..."
                className="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans leading-relaxed resize-y"
              />

              <div className="flex items-center justify-between text-xs text-zinc-400">
                <p>
                  Tip: Include required skills, responsibilities, and seniority for optimal question alignment.
                </p>
                {jd.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setJd("")}
                    className="text-zinc-400 hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Company Intelligence & Timeline Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Target Company URL */}
              <div className="rounded-xl border border-zinc-800/90 bg-[#0f1117] p-5 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="company-url" className="block text-sm font-semibold text-zinc-200">
                    Target Company Website
                  </label>
                  <span className="text-[11px] font-mono text-zinc-400">Optional</span>
                </div>

                <div className="relative">
                  <input
                    id="company-url"
                    type="text"
                    value={companyUrl}
                    onChange={(e) => setCompanyUrl(e.target.value)}
                    placeholder="https://company.com"
                    className="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/80 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>

                <p className="text-xs text-zinc-400 leading-normal">
                  Our crawler retrieves verified public hiring stages, culture signals, and company briefs without hallucinating.
                </p>
              </div>

              {/* Timeline Days */}
              <div className="rounded-xl border border-zinc-800/90 bg-[#0f1117] p-5 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="days-input" className="block text-sm font-semibold text-zinc-200">
                    Interview Timeline
                  </label>
                  <span className="text-xs font-mono font-medium text-amber-400">
                    {days} {days === 1 ? "Day" : "Days"} Available
                  </span>
                </div>

                {/* Fast Selector Pills */}
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 5, 14].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(d)}
                      className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                        days === d
                          ? "bg-amber-500/10 border-amber-500 text-amber-400 font-semibold"
                          : "bg-zinc-950/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                      }`}
                    >
                      {d === 1 ? "1d (Cram)" : `${d}d`}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-zinc-400">Custom Day Budget:</span>
                  <input
                    id="days-input"
                    type="number"
                    min={1}
                    max={60}
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value, 10) || 1)}
                    className="w-20 rounded border border-zinc-700/60 bg-zinc-950 px-2.5 py-1 text-xs text-right font-mono text-zinc-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Error alerts */}
            {validationError && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2">
                <span className="font-bold">⚠️</span>
                <span>{validationError}</span>
              </div>
            )}

            {apiError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300 space-y-1">
                <div className="font-bold uppercase tracking-wider text-[11px] text-red-400">
                  Error [{apiError.code}]
                </div>
                <div>{apiError.message}</div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <a
                href="/kits"
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </a>

              <button
                type="submit"
                disabled={loading}
                className={`flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition-all shadow-md ${
                  loading
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:bg-amber-400 active:scale-[0.99]"
                }`}
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-zinc-950"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    <span>Starting Generation...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Prep Kit</span>
                    <span className="font-mono text-xs opacity-70">↵</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* MULTI-ROLE BATCH UPLOAD */}
        {mode === "batch" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800/90 bg-[#0f1117] p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200">
                  Multi-Role Batch Upload
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Prepare for multiple interviews simultaneously. Paste a JSON array of roles or drop a formatted file.
                </p>
              </div>

              {/* Format Guide */}
              <div className="rounded-lg bg-zinc-950/80 border border-zinc-800 p-3 text-xs font-mono text-zinc-400">
                <span className="text-amber-400 block mb-1">Expected JSON Format:</span>
                <pre className="text-[11px] overflow-x-auto text-zinc-300">
{`[
  { "id": "stripe-staff", "company_url": "https://stripe.com", "days": 5, "jd": "Staff Backend Engineer..." },
  { "id": "vercel-senior", "company_url": "https://vercel.com", "days": 3, "jd": "Senior Frontend Engineer..." }
]`}
                </pre>
              </div>

              {/* Paste or Upload Area */}
              <div>
                <textarea
                  rows={8}
                  value={batchRawText}
                  onChange={(e) => parseBatchInput(e.target.value)}
                  placeholder="Paste JSON array or CSV here..."
                  className="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/80 px-4 py-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono leading-relaxed"
                />
              </div>
            </div>

            {/* Validation Table / Queue Preview */}
            {batchParsedRoles.length > 0 && (
              <div className="rounded-xl border border-zinc-800/90 bg-[#0f1117] p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Parsed Roles ({batchParsedRoles.length})
                  </h4>
                  <span className="text-xs font-mono text-emerald-400">
                    {batchParsedRoles.filter((r) => !r.error).length} valid
                  </span>
                </div>

                <div className="divide-y divide-zinc-800/80 overflow-x-auto">
                  {batchParsedRoles.map((role, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs gap-4">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-zinc-400">#{idx + 1}</span>
                        <span className="font-semibold text-zinc-200">{role.id}</span>
                        {role.company_url && (
                          <span className="text-[11px] font-mono text-zinc-400">
                            {role.company_url}
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-amber-400/80">
                          {role.days || 5}d
                        </span>
                      </div>

                      <div>
                        {role.error ? (
                          <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-[11px] border border-red-500/20">
                            {role.error}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[11px] border border-emerald-500/20">
                            Ready
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end pt-2">
                  <button
                    type="button"
                    disabled={batchLoading || batchParsedRoles.filter((r) => !r.error).length === 0}
                    onClick={handleBatchSubmit}
                    className="rounded-lg bg-amber-500 px-5 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-all disabled:opacity-50"
                  >
                    {batchLoading
                      ? `Generating Batch (${batchProgress?.current}/${batchProgress?.total})...`
                      : `Generate All Valid Kits (${batchParsedRoles.filter((r) => !r.error).length})`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
