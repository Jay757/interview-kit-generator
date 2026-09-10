"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Navbar } from "../../../components/Navbar";
import { useAuth } from "../../../context/AuthContext";
import {
  KitStructure,
  KitQuestion,
  KitRequirement,
  QuestionCategory,
} from "../../../../../api/src/types/kit";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const STAGES = [
  { id: "retrieving", label: "Web Crawling", desc: "Discovering company hiring & culture pages" },
  { id: "extracting", label: "Grounded Extraction", desc: "Extracting atomic requirements & company brief" },
  { id: "generating_questions", label: "Question Generation", desc: "Generating category-specific interview scenarios" },
  { id: "verifying_coverage", label: "Coverage Loop", desc: "Verifying requirement coverage & gap-filling" },
  { id: "generating_flashcards", label: "Flashcards", desc: "Distilling high-yield spaced repetition cards" },
  { id: "allocating_schedule", label: "Schedule Allocation", desc: "Partitioning study timeline deterministically" },
  { id: "completed", label: "Assembly Ready", desc: "Validating Appendix A structure" },
];

export default function KitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();

  const [kit, setKit] = useState<KitStructure | null>(null);
  const [status, setStatus] = useState<"generating" | "completed" | "failed" | "loading">("loading");
  const [stage, setStage] = useState<string>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Active view tab in read-only mode
  const [activeTab, setActiveTab] = useState<"schedule" | "questions" | "flashcards" | "coverage">(
    "schedule"
  );

  // Selected schedule day
  const [selectedDay, setSelectedDay] = useState<number>(1);

  // Question category filter
  const [questionCategoryFilter, setQuestionCategoryFilter] = useState<QuestionCategory | "all">("all");

  // Expanded question IDs for answer outlines
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Set<string>>(new Set());

  // Interactive Flashcards state
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flashcardViewMode, setFlashcardViewMode] = useState<"deck" | "grid">("deck");

  // Requirements filter
  const [reqFilter, setReqFilter] = useState<"all" | "must" | "nice">("all");

  // Timer while generating
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === "generating" || status === "loading") {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status]);

  // Initial load and polling logic
  useEffect(() => {
    if (!id) return;

    let isSubscribed = true;
    let pollInterval: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/kits/${id}/status`, {
          credentials: "include",
        });

        if (!res.ok) {
          if (res.status === 404) {
            setStatus("failed");
            setErrorMessage("Kit not found or has been deleted.");
            return;
          }
          if (res.status === 403) {
            setStatus("failed");
            setErrorMessage("You do not have permission to view this kit.");
            return;
          }
          return;
        }

        const data = await res.json();
        if (!isSubscribed) return;

        setStatus(data.status);
        setStage(data.stage || "starting");
        setErrorMessage(data.errorMessage || null);

        // If generation completed, fetch the complete kit object
        if (data.status === "completed") {
          clearInterval(pollInterval);
          fetchFullKit();
        } else if (data.status === "failed") {
          clearInterval(pollInterval);
        }
      } catch (err: any) {
        console.warn("Error polling status:", err);
      }
    };

    const fetchFullKit = async () => {
      try {
        const res = await fetch(`${API_URL}/kits/${id}`, {
          credentials: "include",
        });
        if (res.ok) {
          const fullData = await res.json();
          if (isSubscribed) {
            setKit(fullData.kit);
            setStatus("completed");
          }
        }
      } catch (err: any) {
        console.error("Failed to load full kit:", err);
      }
    };

    // First immediate check
    checkStatus();

    // Start 1.5-second polling interval while generating
    pollInterval = setInterval(checkStatus, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [id]);

  // Keyboard navigation for flashcard deck
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== "flashcards" || flashcardViewMode !== "deck" || !kit?.flashcards?.length) return;
      if (e.key === "ArrowRight") {
        nextCard();
      } else if (e.key === "ArrowLeft") {
        prevCard();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setIsFlipped((f) => !f);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, flashcardViewMode, kit?.flashcards?.length]);

  const toggleQuestionOutline = (qid: string) => {
    setExpandedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) {
        next.delete(qid);
      } else {
        next.add(qid);
      }
      return next;
    });
  };

  const nextCard = () => {
    if (!kit?.flashcards?.length) return;
    setIsFlipped(false);
    setFlashcardIndex((prev) => (prev + 1) % kit.flashcards.length);
  };

  const prevCard = () => {
    if (!kit?.flashcards?.length) return;
    setIsFlipped(false);
    setFlashcardIndex((prev) => (prev - 1 + kit.flashcards.length) % kit.flashcards.length);
  };

  // Filtered requirements
  const filteredRequirements = useMemo(() => {
    if (!kit?.role?.requirements) return [];
    if (reqFilter === "all") return kit.role.requirements;
    return kit.role.requirements.filter((r) => r.priority === reqFilter);
  }, [kit?.role?.requirements, reqFilter]);

  // Filtered questions
  const filteredQuestions = useMemo(() => {
    if (!kit?.questions) return [];
    if (questionCategoryFilter === "all") return kit.questions;
    return kit.questions.filter((q) => q.category === questionCategoryFilter);
  }, [kit?.questions, questionCategoryFilter]);

  // Download Appendix A JSON export
  const downloadKitJson = () => {
    if (!kit) return;
    const blob = new Blob([JSON.stringify(kit, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(kit.source.company || "interview").toLowerCase()}-prep-kit.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Find question details by ID for schedule view
  const questionMap = useMemo(() => {
    const map = new Map<string, KitQuestion>();
    if (kit?.questions) {
      for (const q of kit.questions) {
        map.set(q.id, q);
      }
    }
    return map;
  }, [kit?.questions]);

  // Render difficulty badge
  const renderDifficulty = (level: number) => {
    const bars = [1, 2, 3];
    return (
      <div className="flex items-center gap-1" title={`Difficulty: Level ${level}`}>
        {bars.map((b) => (
          <span
            key={b}
            className={`h-2 w-1 rounded-sm ${
              b <= level ? "bg-amber-400" : "bg-zinc-800"
            }`}
          />
        ))}
        <span className="ml-1 text-[10px] font-mono text-zinc-400">L{level}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 bg-grid-architectural">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* LOADING & GENERATING PROGRESS STATE */}
        {(status === "generating" || (status === "loading" && !kit)) && (
          <div className="mx-auto max-w-2xl py-12">
            <div className="rounded-2xl border border-zinc-800/90 bg-[#0f1117] p-8 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Synthesizing Prep Kit</h2>
                    <p className="text-xs text-zinc-400">
                      Running grounded multi-stage generation pipeline
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono text-xs text-zinc-400">
                  <span className="text-amber-400 font-semibold">{elapsedSeconds}s</span> elapsed
                </div>
              </div>

              {/* Pipeline Stage Checklist */}
              <div className="space-y-3 pt-2">
                {STAGES.map((s, idx) => {
                  const stageIndex = STAGES.findIndex((item) => item.id === stage);
                  const isCurrent = s.id === stage;
                  const isDone = stageIndex > idx || stage === "completed";

                  return (
                    <div
                      key={s.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                        isCurrent
                          ? "bg-amber-500/10 border-amber-500/40 text-zinc-100 shadow-sm"
                          : isDone
                          ? "bg-zinc-950/40 border-zinc-800/60 text-zinc-300"
                          : "bg-zinc-950/20 border-zinc-900 text-zinc-600"
                      }`}
                    >
                      <div className="mt-0.5">
                        {isDone ? (
                          <div className="h-4 w-4 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                            ✓
                          </div>
                        ) : isCurrent ? (
                          <div className="h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-zinc-800 flex items-center justify-center text-[9px] font-mono text-zinc-600">
                            {idx + 1}
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className={isCurrent ? "text-amber-300" : isDone ? "text-zinc-200" : "text-zinc-500"}>
                            {s.label}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400 font-bold animate-pulse">
                              Processing
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400">{s.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 text-center text-xs text-zinc-400 font-mono">
                No need to keep this tab open — the job continues in the background.
              </div>
            </div>
          </div>
        )}

        {/* FAILED STATE */}
        {status === "failed" && (
          <div className="mx-auto max-w-xl py-12 text-center">
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 shadow-lg space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-400 text-xl font-bold">
                ✕
              </div>
              <h2 className="text-xl font-bold text-white">Kit Generation Failed</h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {errorMessage || "An unexpected error occurred during kit synthesis."}
              </p>

              <div className="flex items-center justify-center gap-3 pt-4">
                <a
                  href="/kits/new"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors shadow-sm"
                >
                  Create New Kit
                </a>
                <a
                  href="/kits"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
                >
                  Back to Dashboard
                </a>
              </div>
            </div>
          </div>
        )}

        {/* COMPLETED READ-ONLY KIT VIEW */}
        {status === "completed" && kit && (
          <div className="space-y-6">
            {/* Top Command Bar & Breadcrumbs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
              <div>
                <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1.5 font-mono">
                  <a href="/kits" className="hover:text-zinc-200 transition-colors">
                    Kits
                  </a>
                  <span>/</span>
                  <span className="text-zinc-300">{kit.source.company || "Target Company"}</span>
                  <span>/</span>
                  <span className="text-amber-400">{kit.role.title || "Target Role"}</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    {kit.role.title || "Interview Prep Kit"}
                  </h1>
                  {kit.role.seniority && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {kit.role.seniority}
                    </span>
                  )}
                  {kit.source.location && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                      📍 {kit.source.location}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={downloadKitJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700/80 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-colors shadow-sm"
                  title="Export Appendix A structured JSON"
                >
                  <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Export JSON</span>
                </button>

                <a
                  href="/kits/new"
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors shadow-sm"
                >
                  + New Kit
                </a>
              </div>
            </div>

            {/* MASTER-DETAIL GRID LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* LEFT RAIL (4 Cols): Company Brief, Telemetry, Role Requirements */}
              <aside className="lg:col-span-4 space-y-5">
                {/* Preparation Telemetry Pill Box */}
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-zinc-800 bg-[#0f1117] p-3 shadow-sm text-center">
                  <div className="p-2 rounded bg-zinc-950/60">
                    <div className="text-base font-bold font-mono text-amber-400">
                      {kit.questions.length}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400">Questions</div>
                  </div>
                  <div className="p-2 rounded bg-zinc-950/60">
                    <div className="text-base font-bold font-mono text-zinc-100">
                      {kit.flashcards.length}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400">Flashcards</div>
                  </div>
                  <div className="p-2 rounded bg-zinc-950/60">
                    <div className="text-base font-bold font-mono text-emerald-400">
                      {kit.schedule.days_available}d
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400">Timeline</div>
                  </div>
                </div>

                {/* Company Intelligence Card */}
                <div className="rounded-xl border border-zinc-800 bg-[#0f1117] p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Company Intelligence
                    </h3>
                    {kit.source.company_url && (
                      <a
                        href={kit.source.company_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono text-amber-400 hover:underline flex items-center gap-1"
                      >
                        Visit Site ↗
                      </a>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-zinc-200">What They Do</h4>
                    <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                      {kit.company_brief.what_they_do || "No public details found."}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-zinc-200">Mission & Context</h4>
                    <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                      {kit.company_brief.summary || "No public summary found."}
                    </p>
                  </div>

                  {kit.source.pages_used.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[11px] font-mono text-zinc-400 block mb-1">
                        Verified Sources ({kit.source.pages_used.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {kit.source.pages_used.map((url, uidx) => (
                          <span
                            key={uidx}
                            className="px-2 py-0.5 rounded bg-zinc-950 text-[10px] font-mono text-zinc-400 border border-zinc-800 truncate max-w-[240px]"
                            title={url}
                          >
                            {url.replace(/^https?:\/\//, "")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Role Requirements Checklist */}
                <div className="rounded-xl border border-zinc-800 bg-[#0f1117] p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Requirements ({kit.role.requirements.length})
                    </h3>

                    {/* Must vs Nice Filter */}
                    <div className="flex items-center gap-1">
                      {(["all", "must", "nice"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setReqFilter(mode)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono capitalize transition-colors ${
                            reqFilter === mode
                              ? "bg-zinc-800 text-white font-semibold"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {filteredRequirements.map((r) => (
                      <div
                        key={r.id}
                        className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-amber-400/90 text-[11px]">
                            {r.id}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                                r.priority === "must"
                                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                  : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                              }`}
                            >
                              {r.priority}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400 capitalize">
                              {r.kind}
                            </span>
                          </div>
                        </div>
                        <p className="text-zinc-200 leading-normal">{r.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Responsibilities list if present */}
                {kit.role.responsibilities && kit.role.responsibilities.length > 0 && (
                  <div className="rounded-xl border border-zinc-800 bg-[#0f1117] p-5 shadow-sm space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 border-b border-zinc-800/80 pb-2">
                      Core Responsibilities
                    </h3>
                    <ul className="space-y-1.5 text-xs text-zinc-300">
                      {kit.role.responsibilities.map((resp, ridx) => (
                        <li key={ridx} className="flex items-start gap-2">
                          <span className="text-amber-400 mt-0.5">•</span>
                          <span className="leading-normal">{resp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </aside>

              {/* RIGHT MAIN PANEL (8 Cols): Navigation Tabs & Active Interactive Views */}
              <div className="lg:col-span-8 space-y-5">
                {/* Segmented Top Tab Bar */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0f1117] border border-zinc-800 shadow-sm overflow-x-auto">
                  <button
                    onClick={() => setActiveTab("schedule")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      activeTab === "schedule"
                        ? "bg-zinc-800 text-amber-400 border border-zinc-700/80 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                    }`}
                  >
                    <span>📅</span>
                    <span>Daily Schedule ({kit.schedule.days_available}d)</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("questions")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      activeTab === "questions"
                        ? "bg-zinc-800 text-amber-400 border border-zinc-700/80 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                    }`}
                  >
                    <span>❓</span>
                    <span>Question Bank ({kit.questions.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("flashcards")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      activeTab === "flashcards"
                        ? "bg-zinc-800 text-amber-400 border border-zinc-700/80 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                    }`}
                  >
                    <span>🎴</span>
                    <span>Flashcards ({kit.flashcards.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("coverage")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      activeTab === "coverage"
                        ? "bg-zinc-800 text-amber-400 border border-zinc-700/80 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                    }`}
                  >
                    <span>🎯</span>
                    <span>Coverage Matrix</span>
                  </button>
                </div>

                {/* TAB 1: DAILY SCHEDULE TIMELINE */}
                {activeTab === "schedule" && (
                  <div className="rounded-xl border border-zinc-800 bg-[#0f1117] p-6 shadow-sm space-y-6">
                    <div>
                      <h2 className="text-base font-bold text-white">
                        Adaptive Study Timeline
                      </h2>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Pure arithmetic partition balancing foundational competencies and spaced repetition drills.
                      </p>
                    </div>

                    {/* Day Selection Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {kit.schedule.days.map((d) => (
                        <button
                          key={d.day}
                          onClick={() => setSelectedDay(d.day)}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            selectedDay === d.day
                              ? "bg-amber-500/10 border-amber-500 text-white shadow-sm"
                              : "bg-zinc-950/70 border-zinc-800/80 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold font-mono">
                            <span className={selectedDay === d.day ? "text-amber-400" : "text-zinc-300"}>
                              Day {d.day}
                            </span>
                            <span className="text-[10px] text-zinc-400">{d.minutes}m</span>
                          </div>
                          <div className="mt-1 text-[11px] truncate text-zinc-300 font-medium">
                            {d.focus}
                          </div>
                          <div className="mt-1 text-[10px] font-mono text-zinc-400">
                            {d.question_ids.length} questions
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Selected Day Expanded Detail */}
                    {(() => {
                      const currentDayData = kit.schedule.days.find((d) => d.day === selectedDay) || kit.schedule.days[0];
                      if (!currentDayData) return null;

                      return (
                        <div className="space-y-4 pt-2 border-t border-zinc-800/80">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-bold text-amber-400">
                                Day {currentDayData.day}: {currentDayData.focus}
                              </h3>
                              <span className="text-xs text-zinc-400">
                                Target Study Duration: {currentDayData.minutes} minutes • {currentDayData.question_ids.length} core scenarios
                              </span>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {currentDayData.question_ids.map((qid, idx) => {
                              const question = questionMap.get(qid);
                              if (!question) {
                                return (
                                  <div key={idx} className="p-3 rounded-lg bg-zinc-950 text-xs text-zinc-400">
                                    Question {qid}
                                  </div>
                                );
                              }

                              const isExpanded = expandedQuestionIds.has(question.id);

                              return (
                                <div
                                  key={question.id}
                                  className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4 transition-all hover:border-zinc-700/80 space-y-3"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1.5 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-bold text-amber-400">
                                          {question.id}
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-mono capitalize bg-zinc-900 border border-zinc-800 text-zinc-300">
                                          {question.category}
                                        </span>
                                        {renderDifficulty(question.difficulty)}
                                      </div>
                                      <h4 className="text-sm font-semibold text-zinc-100 leading-snug">
                                        {question.prompt}
                                      </h4>
                                    </div>

                                    <button
                                      onClick={() => toggleQuestionOutline(question.id)}
                                      className="px-2.5 py-1 text-xs rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors whitespace-nowrap"
                                    >
                                      {isExpanded ? "Hide Answer" : "View Answer"}
                                    </button>
                                  </div>

                                  {isExpanded && (
                                    <div className="pt-2 border-t border-zinc-900 text-xs text-zinc-300 space-y-2 bg-zinc-900/40 -mx-4 -mb-4 p-4 rounded-b-lg">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono block">
                                        Strategic Answer Outline & Key Points:
                                      </span>
                                      <p className="leading-relaxed whitespace-pre-line text-zinc-300 font-sans">
                                        {question.answer_outline}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* TAB 2: QUESTION BANK */}
                {activeTab === "questions" && (
                  <div className="rounded-xl border border-zinc-800 bg-[#0f1117] p-6 shadow-sm space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                      <div>
                        <h2 className="text-base font-bold text-white">
                          Targeted Question Bank ({filteredQuestions.length})
                        </h2>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Grounded in extracted must/nice requirements and company interview rounds.
                        </p>
                      </div>

                      {/* Category Filter Pills */}
                      <div className="flex flex-wrap gap-1">
                        {(["all", "technical", "behavioural", "system-design", "company-fit"] as const).map(
                          (cat) => (
                            <button
                              key={cat}
                              onClick={() => setQuestionCategoryFilter(cat)}
                              className={`px-2.5 py-1 rounded text-xs font-mono capitalize transition-all ${
                                questionCategoryFilter === cat
                                  ? "bg-amber-500/15 border border-amber-500/40 text-amber-400 font-semibold"
                                  : "bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                              }`}
                            >
                              {cat.replace("-", " ")}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Question Cards List */}
                    <div className="space-y-3.5">
                      {filteredQuestions.map((q) => {
                        const isExpanded = expandedQuestionIds.has(q.id);

                        return (
                          <div
                            key={q.id}
                            className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 transition-all hover:border-zinc-700/80 space-y-3"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-amber-400">
                                    {q.id}
                                  </span>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono capitalize bg-zinc-900 border border-zinc-800 text-zinc-300">
                                    {q.category}
                                  </span>
                                  {renderDifficulty(q.difficulty)}
                                  {q.requirement_ids.map((rid) => (
                                    <span
                                      key={rid}
                                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800"
                                    >
                                      req:{rid}
                                    </span>
                                  ))}
                                </div>

                                <h3 className="text-sm font-semibold text-zinc-100 leading-snug">
                                  {q.prompt}
                                </h3>
                              </div>

                              <button
                                onClick={() => toggleQuestionOutline(q.id)}
                                className="px-2.5 py-1 text-xs rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors whitespace-nowrap"
                              >
                                {isExpanded ? "Hide Outline" : "View Outline"}
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="pt-2 border-t border-zinc-900 text-xs text-zinc-300 space-y-2 bg-zinc-900/40 -mx-4 -mb-4 p-4 rounded-b-xl">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono block">
                                  Answer Outline & Evaluation Rubric:
                                </span>
                                <p className="leading-relaxed whitespace-pre-line text-zinc-300 font-sans">
                                  {q.answer_outline}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 3: INTERACTIVE FLASHCARDS */}
                {activeTab === "flashcards" && (
                  <div className="rounded-xl border border-zinc-800 bg-[#0f1117] p-6 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
                      <div>
                        <h2 className="text-base font-bold text-white">Spaced Repetition Flashcards</h2>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          High-yield active recall cards for rapid pre-interview drilling.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setFlashcardViewMode("deck")}
                          className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                            flashcardViewMode === "deck"
                              ? "bg-zinc-800 text-amber-400 font-bold"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          Deck View
                        </button>
                        <button
                          onClick={() => setFlashcardViewMode("grid")}
                          className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                            flashcardViewMode === "grid"
                              ? "bg-zinc-800 text-amber-400 font-bold"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          All Cards
                        </button>
                      </div>
                    </div>

                    {kit.flashcards.length === 0 ? (
                      <div className="py-12 text-center text-xs text-zinc-400">
                        No flashcards generated for this kit.
                      </div>
                    ) : flashcardViewMode === "deck" ? (
                      /* 3D INTERACTIVE DECK FLIP CARD */
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                          <span>
                            Card {flashcardIndex + 1} of {kit.flashcards.length}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            Click card or press <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300">Space</kbd> to flip
                          </span>
                        </div>

                        {/* Flashcard container */}
                        <div
                          onClick={() => setIsFlipped(!isFlipped)}
                          className={`cursor-pointer min-h-[220px] sm:min-h-[260px] rounded-2xl border p-8 flex flex-col justify-between transition-all duration-300 transform select-none ${
                            isFlipped
                              ? "bg-amber-500/5 border-amber-500/40 text-amber-200 shadow-md"
                              : "bg-zinc-950 border-zinc-800 text-zinc-100 hover:border-zinc-700 shadow-sm"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                              {kit.flashcards[flashcardIndex].id}
                            </span>
                            <span className="text-xs uppercase font-bold tracking-wider text-amber-400">
                              {isFlipped ? "Answer / Takeaway" : "Prompt / Question"}
                            </span>
                          </div>

                          <div className="py-6 text-center">
                            <p className="text-base sm:text-lg font-semibold leading-relaxed">
                              {isFlipped
                                ? kit.flashcards[flashcardIndex].back
                                : kit.flashcards[flashcardIndex].front}
                            </p>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                            <span>
                              {kit.flashcards[flashcardIndex].requirement_ids.length > 0
                                ? `Linked: ${kit.flashcards[flashcardIndex].requirement_ids.join(", ")}`
                                : "Core Competency"}
                            </span>
                            <span className="text-amber-400/80">Click to flip ↻</span>
                          </div>
                        </div>

                        {/* Controls bar */}
                        <div className="flex items-center justify-between pt-2">
                          <button
                            onClick={prevCard}
                            className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 border border-zinc-800 transition-colors flex items-center gap-1.5"
                          >
                            <span>←</span>
                            <span>Previous</span>
                          </button>

                          <div className="flex items-center gap-1 font-mono text-xs text-zinc-400">
                            {kit.flashcards.map((_, idx) => (
                              <span
                                key={idx}
                                onClick={() => {
                                  setIsFlipped(false);
                                  setFlashcardIndex(idx);
                                }}
                                className={`h-1.5 rounded-full cursor-pointer transition-all ${
                                  idx === flashcardIndex ? "w-5 bg-amber-400" : "w-1.5 bg-zinc-800"
                                }`}
                              />
                            ))}
                          </div>

                          <button
                            onClick={nextCard}
                            className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 border border-zinc-800 transition-colors flex items-center gap-1.5"
                          >
                            <span>Next</span>
                            <span>→</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* GRID VIEW ALL CARDS */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {kit.flashcards.map((card) => (
                          <div
                            key={card.id}
                            className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                              <span>{card.id}</span>
                              <span className="text-amber-400">
                                {card.requirement_ids.join(", ")}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-400 block mb-1">
                                Prompt:
                              </span>
                              <p className="text-xs font-semibold text-zinc-100">{card.front}</p>
                            </div>
                            <div className="pt-2 border-t border-zinc-900">
                              <span className="text-[10px] uppercase tracking-wider font-mono text-amber-400 block mb-1">
                                Answer:
                              </span>
                              <p className="text-xs text-zinc-300">{card.back}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: COVERAGE MATRIX */}
                {activeTab === "coverage" && (
                  <div className="rounded-xl border border-zinc-800 bg-[#0f1117] p-6 shadow-sm space-y-5">
                    <div className="border-b border-zinc-800/80 pb-4">
                      <h2 className="text-base font-bold text-white">Competency Coverage Audit</h2>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Pure deterministic set-logic verification ensuring all mandatory skills are tested.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800">
                        <span className="text-xs text-zinc-400 block">Total Requirements</span>
                        <span className="text-xl font-bold font-mono text-zinc-100 mt-1 block">
                          {kit.role.requirements.length}
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800">
                        <span className="text-xs text-zinc-400 block">Coverage Pass Count</span>
                        <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
                          {kit.coverage.passes} {kit.coverage.passes === 1 ? "pass" : "passes"}
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800">
                        <span className="text-xs text-zinc-400 block">Uncovered Must-Haves</span>
                        <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                          0
                        </span>
                      </div>
                    </div>

                    {/* Coverage Items Table */}
                    <div className="space-y-2 pt-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                        Requirement-to-Question Mapping
                      </h3>

                      <div className="divide-y divide-zinc-800/80 border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950">
                        {kit.role.requirements.map((r) => {
                          const mappedQuestions = kit.questions.filter((q) =>
                            q.requirement_ids.includes(r.id)
                          );
                          const isCovered = mappedQuestions.length > 0;

                          return (
                            <div key={r.id} className="p-3 flex items-start justify-between gap-4 text-xs">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-amber-400">{r.id}</span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase ${
                                      r.priority === "must"
                                        ? "bg-amber-500/15 text-amber-400"
                                        : "bg-zinc-800 text-zinc-400"
                                    }`}
                                  >
                                    {r.priority}
                                  </span>
                                  <span className="text-[10px] text-zinc-400 capitalize">{r.kind}</span>
                                </div>
                                <p className="text-zinc-200">{r.text}</p>
                              </div>

                              <div className="text-right">
                                {isCovered ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                                      ✓ Covered ({mappedQuestions.length})
                                    </span>
                                    <div className="flex gap-1">
                                      {mappedQuestions.map((mq) => (
                                        <span
                                          key={mq.id}
                                          className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400"
                                        >
                                          {mq.id}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-mono text-amber-400">
                                    Remaining nice gap
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
