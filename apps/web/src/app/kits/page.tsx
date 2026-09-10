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
  HelpCircle,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  Target,
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

interface ExtractedQuestion {
  id: string;
  requirement_ids: string[];
  category: "technical" | "behavioural" | "system-design" | "company-fit";
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  state?: "generated" | "edited" | "pinned";
}

interface ExtractedFlashcard {
  id: string;
  requirement_ids: string[];
  front: string;
  back: string;
  state?: "generated" | "edited" | "pinned";
}

interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

interface KitSchedule {
  days_available: number;
  days: ScheduleDay[];
}

interface KitCoverage {
  uncovered_requirement_ids: string[];
  passes: number;
}

export default function KitsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [jdText, setJdText] = useState(SAMPLE_REALISTIC_JD);
  const [companyUrl, setCompanyUrl] = useState("");
  const [daysAvailable, setDaysAvailable] = useState(5);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"schedule" | "questions" | "flashcards" | "requirements" | "brief">("schedule");
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const [result, setResult] = useState<{
    requirements: ExtractedRequirement[];
    companyBrief: ExtractedBrief;
    questions: ExtractedQuestion[];
    flashcards: ExtractedFlashcard[];
    coverage: KitCoverage;
    schedule: KitSchedule;
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
          daysAvailable,
        }),
      });

      const data = await res.json();
      const endTime = performance.now();

      if (!res.ok) {
        throw new Error(data.error?.message || "Generation pipeline failed");
      }

      setResult({
        requirements: data.requirements || [],
        companyBrief: data.companyBrief || { summary: "", what_they_do: "" },
        questions: data.questions || [],
        flashcards: data.flashcards || [],
        coverage: data.coverage || { uncovered_requirement_ids: [], passes: 1 },
        schedule: data.schedule || { days_available: daysAvailable, days: [] },
        crawledPages: data.crawledPages || { used: [], skipped: [] },
        latencyMs: Math.round(endTime - startTime),
      });

      if (data.questions && data.questions.length > 0) {
        setExpandedQuestionId(data.questions[0].id);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during pipeline execution.");
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
              <span className="text-xs font-mono text-zinc-400">generation-studio</span>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
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
                <span>PHASES 4–7 COMPLETE AI KIT ENGINE</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                AI Interview Prep Kit Studio
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Grounded requirements, categorized questions, flashcards, deterministic coverage verification &amp; schedule allocation.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                Deterministic Logic Active
              </span>
            </div>
          </div>
        </div>

        {/* Input Form & Results */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Input Form */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 rounded-xl bg-[#0e111a] border border-white/[0.08] shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Job Description</span>
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setJdText(SAMPLE_REALISTIC_JD)}
                    className="text-[11px] font-mono text-zinc-400 hover:text-amber-400 transition underline underline-offset-2"
                  >
                    Realistic JD
                  </button>
                  <span className="text-zinc-700">|</span>
                  <button
                    type="button"
                    onClick={() => setJdText(SAMPLE_THIN_JD)}
                    className="text-[11px] font-mono text-zinc-400 hover:text-amber-400 transition underline underline-offset-2"
                  >
                    Thin JD
                  </button>
                </div>
              </div>

              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                rows={9}
                placeholder="Paste job description here..."
                className="w-full bg-[#07080c] border border-white/[0.08] rounded-lg p-3.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 resize-y leading-relaxed"
              />

              <div>
                <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center space-x-1.5 mb-2">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Company Website URL (Optional)</span>
                </label>
                <input
                  type="text"
                  value={companyUrl}
                  onChange={(e) => setCompanyUrl(e.target.value)}
                  placeholder="https://company.com"
                  className="w-full bg-[#07080c] border border-white/[0.08] rounded-lg px-3.5 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center space-x-1.5 mb-2">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Preparation Timeline (Days Available)</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 5, 14].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setDaysAvailable(days)}
                      className={`py-1.5 text-xs font-mono rounded-lg border transition ${
                        daysAvailable === days
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold"
                          : "bg-[#07080c] text-zinc-400 border-white/[0.06] hover:text-white"
                      }`}
                    >
                      {days} {days === 1 ? "Day" : "Days"}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Pipeline Error</p>
                    <p className="text-rose-400/90 font-mono text-[11px]">{error}</p>
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
                    <span>Executing Pipeline (LLM + Deterministic)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Complete Prep Kit</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Output Studio */}
          <div className="lg:col-span-7 space-y-4">
            {result ? (
              <div className="space-y-4">
                {/* Telemetry Bar */}
                <div className="p-3.5 rounded-xl bg-[#0e111a] border border-white/[0.08] flex flex-wrap items-center justify-between font-mono text-xs gap-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-zinc-200 font-semibold">Kit Assembled</span>
                  </div>
                  <div className="flex items-center space-x-3 text-zinc-400">
                    <span>Latency: <strong className="text-amber-400">{result.latencyMs}ms</strong></span>
                    <span>•</span>
                    <span>Days: <strong className="text-white">{result.schedule.days.length}</strong></span>
                    <span>•</span>
                    <span>Q: <strong className="text-white">{result.questions.length}</strong></span>
                    <span>•</span>
                    <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Coverage: Pass {result.coverage.passes}
                    </span>
                  </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex space-x-1 p-1 bg-[#0e111a] border border-white/[0.08] rounded-xl font-mono text-xs overflow-x-auto">
                  <button
                    onClick={() => setActiveTab("schedule")}
                    className={`flex-1 py-2 px-3 rounded-lg font-semibold transition flex items-center justify-center space-x-1.5 whitespace-nowrap ${
                      activeTab === "schedule"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Schedule ({result.schedule.days.length}d)</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("questions")}
                    className={`flex-1 py-2 px-3 rounded-lg font-semibold transition flex items-center justify-center space-x-1.5 whitespace-nowrap ${
                      activeTab === "questions"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Questions ({result.questions.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("flashcards")}
                    className={`flex-1 py-2 px-3 rounded-lg font-semibold transition flex items-center justify-center space-x-1.5 whitespace-nowrap ${
                      activeTab === "flashcards"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Flashcards ({result.flashcards.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("requirements")}
                    className={`flex-1 py-2 px-3 rounded-lg font-semibold transition flex items-center justify-center space-x-1.5 whitespace-nowrap ${
                      activeTab === "requirements"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Reqs ({result.requirements.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("brief")}
                    className={`flex-1 py-2 px-3 rounded-lg font-semibold transition flex items-center justify-center space-x-1.5 whitespace-nowrap ${
                      activeTab === "brief"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Brief</span>
                  </button>
                </div>

                {/* Tab: Schedule */}
                {activeTab === "schedule" && (
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    {result.schedule.days.map((day) => (
                      <div
                        key={day.day}
                        className="p-4 rounded-xl bg-[#0e111a] border border-white/[0.08] hover:border-white/[0.15] transition space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2.5">
                            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                              DAY {day.day}
                            </span>
                            <span className="text-xs font-semibold text-white">
                              {day.focus}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5 text-xs font-mono text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded border border-white/[0.06]">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>{day.minutes} min</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
                            Allocated Questions ({day.question_ids.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {day.question_ids.map((qid) => {
                              const qObj = result.questions.find((q) => q.id === qid);
                              return (
                                <span
                                  key={qid}
                                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#07080c] border border-white/[0.08] text-zinc-300 flex items-center space-x-1"
                                >
                                  <strong className="text-amber-400">{qid}</strong>
                                  {qObj && (
                                    <span className="text-[10px] text-zinc-500">
                                      ({qObj.category})
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab: Questions */}
                {activeTab === "questions" && (
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    {result.questions.map((q) => {
                      const isExpanded = expandedQuestionId === q.id;
                      return (
                        <div
                          key={q.id}
                          className="p-4 rounded-xl bg-[#0e111a] border border-white/[0.08] hover:border-white/[0.15] transition space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                {q.id}
                              </span>
                              <span
                                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                                  q.category === "technical"
                                    ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                                    : q.category === "system-design"
                                    ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                                    : q.category === "behavioural"
                                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                    : "bg-slate-500/10 text-slate-300 border border-slate-500/20"
                                }`}
                              >
                                {q.category}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-white/[0.06]">
                                Diff: Level {q.difficulty}
                              </span>
                            </div>

                            <button
                              onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                              className="text-zinc-400 hover:text-white transition p-1"
                              title={isExpanded ? "Collapse Answer Outline" : "Expand Answer Outline"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-amber-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>

                          <p className="text-xs font-medium text-white leading-relaxed">
                            {q.prompt}
                          </p>

                          {isExpanded && (
                            <div className="p-3 rounded-lg bg-[#07080c] border border-white/[0.06] text-xs space-y-1.5 animate-in fade-in duration-200">
                              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                                <span>Answer Guidance Outline</span>
                                <span>Mapped: {q.requirement_ids.join(", ")}</span>
                              </div>
                              <p className="text-zinc-300 leading-relaxed whitespace-pre-line">
                                {q.answer_outline}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Tab: Flashcards */}
                {activeTab === "flashcards" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
                    {result.flashcards.map((card) => (
                      <div
                        key={card.id}
                        className="p-4 rounded-xl bg-[#0e111a] border border-white/[0.08] flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              {card.id}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500">
                              {card.requirement_ids.join(", ")}
                            </span>
                          </div>
                          <div className="text-xs font-medium text-white leading-snug">
                            {card.front}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-[#07080c] border border-white/[0.05] text-[11px] text-zinc-300 leading-relaxed">
                          {card.back}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab: Requirements */}
                {activeTab === "requirements" && (
                  <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                    {result.requirements.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 rounded-xl bg-[#0e111a] border border-white/[0.08] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {req.id}
                          </span>

                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                                req.priority === "must"
                                  ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                  : "bg-zinc-800 text-zinc-400 border border-white/[0.08]"
                              }`}
                            >
                              {req.priority}
                            </span>

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
                          </div>
                        </div>

                        <p className="text-xs text-zinc-200 leading-relaxed">
                          {req.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab: Company Brief */}
                {activeTab === "brief" && (
                  <div className="p-5 rounded-xl bg-[#0e111a] border border-white/[0.08] space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase font-mono text-amber-400 flex items-center space-x-1.5">
                        <Globe className="w-3.5 h-3.5" />
                        <span>Company Intelligence</span>
                      </span>
                      {companyUrl ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          Crawled Pages: {result.crawledPages.used.length}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-white/[0.08]">
                          Zero-Hallucination Fallback (Rule 4)
                        </span>
                      )}
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-zinc-500 font-mono text-[10px] uppercase">Summary</span>
                        <p className="text-zinc-200 mt-1 leading-relaxed bg-[#07080c] p-3 rounded-lg border border-white/[0.05]">
                          {result.companyBrief.summary || "No public company information found."}
                        </p>
                      </div>
                      <div>
                        <span className="text-zinc-500 font-mono text-[10px] uppercase">What They Do</span>
                        <p className="text-zinc-200 mt-1 leading-relaxed bg-[#07080c] p-3 rounded-lg border border-white/[0.05]">
                          {result.companyBrief.what_they_do || "No public company information found."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Empty Placeholder */
              <div className="h-full min-h-[420px] p-8 rounded-xl bg-[#0e111a] border border-dashed border-white/[0.1] flex flex-col items-center justify-center text-center space-y-4">
                <div className="p-3 rounded-full bg-zinc-900 border border-white/[0.08] text-zinc-400">
                  <Terminal className="w-6 h-6 text-amber-400/80" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-sm font-semibold text-white">Full Kit Studio Ready</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Click <strong>&quot;Generate Complete Prep Kit&quot;</strong> to run extraction, question generation, flashcards, coverage verification, and day-by-day scheduling.
                  </p>
                </div>
                <div className="p-3 rounded bg-[#07080c] border border-white/[0.06] text-[11px] font-mono text-zinc-500 text-left space-y-1">
                  <div>✓ Phase 4: Company Crawler &amp; SSRF Shield</div>
                  <div>✓ Phase 5: Grounded Requirements &amp; Brief</div>
                  <div>✓ Phase 6: Categorized Questions &amp; Flashcards</div>
                  <div>✓ Phase 7: Deterministic Schedule &amp; Coverage Loop</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
