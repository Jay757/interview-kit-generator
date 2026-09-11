"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useTheme } from "@/context/ThemeContext";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  state?: "generated" | "edited" | "pinned";
}

interface Question {
  id: string;
  category: "technical" | "behavioural" | "system-design" | "company-fit" | string;
  difficulty: number;
  prompt: string;
  answer_outline: string;
  requirement_ids?: string[];
  state?: "generated" | "edited" | "pinned";
}

interface PracticeAttempt {
  card_id: string;
  confidence: number;
  timestamp: string;
}

interface CoverageSummary {
  totalCards: number;
  practicedCardsCount: number;
  unpracticedCardsCount: number;
  cardCoveragePercentage: number;
  practicedCardIds: string[];
  unpracticedCardIds: string[];
  totalRequirementsCount: number;
  coveredRequirementsCount: number;
  uncoveredRequirementsCount: number;
  coveredRequirementIds: string[];
  uncoveredRequirementIds: string[];
  averageConfidence: number;
  confidenceDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
  };
}

interface PracticeData {
  kit_id: string;
  role: string;
  company: string;
  questions?: Question[];
  flashcards: Flashcard[];
  coverage: CoverageSummary;
  attempts: PracticeAttempt[];
}

interface AIEvaluation {
  score: number;
  verdict: "Strong Hire" | "Hire" | "Leaning Hire" | "Needs Improvement" | "No Hire";
  summary: string;
  strengths: string[];
  improvements: string[];
  modelAnswer: string;
}

const RATING_SCALES = [
  {
    key: 1,
    label: "Again",
    sub: "< 1 min",
    desc: "Blackout / Incorrect",
    color: "rose",
    bg: "bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 border-rose-500/20",
  },
  {
    key: 2,
    label: "Hard",
    sub: "1 day",
    desc: "Hesitant recall",
    color: "amber",
    bg: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  {
    key: 3,
    label: "Good",
    sub: "3 days",
    desc: "Correct with effort",
    color: "blue",
    bg: "bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  {
    key: 4,
    label: "Easy",
    sub: "5+ days",
    desc: "Effortless mastery",
    color: "emerald",
    bg: "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
];

const CATEGORY_LABELS: Record<string, { label: string; badge: string }> = {
  technical: {
    label: "Technical Depth",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  "system-design": {
    label: "System Architecture",
    badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  },
  system_design: {
    label: "System Architecture",
    badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  },
  behavioural: {
    label: "Leadership & STAR",
    badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
  behavioral: {
    label: "Leadership & STAR",
    badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
  "company-fit": {
    label: "Company Fit & Culture",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  situational: {
    label: "Culture & Execution",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function PracticeModePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PracticeData | null>(null);

  // Active mode: questions practice vs flashcard deck vs coverage
  const [activeMode, setActiveMode] = useState<"questions" | "flashcards" | "coverage">("questions");

  // --- QUESTION PRACTICE STATE ---
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [evaluations, setEvaluations] = useState<Record<string, AIEvaluation>>({});
  const [evaluating, setEvaluating] = useState(false);
  const [showModelAnswer, setShowModelAnswer] = useState<Record<string, boolean>>({});
  const [questionFilter, setQuestionFilter] = useState<string>("all");

  // --- FLASHCARD STATE ---
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [justRatedFeedback, setJustRatedFeedback] = useState<number | null>(null);
  const [isSessionFinished, setIsSessionFinished] = useState(false);

  // Fetch practice data
  const fetchPracticeData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/kits/${id}/practice`, {
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 404) {
          setError("Kit not found or does not exist.");
          return;
        }
        if (res.status === 403) {
          setError("You do not have permission to access this kit.");
          return;
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || "Failed to load practice mode.");
      }

      const json: PracticeData = await res.json();
      setData(json);

      // If no questions in practice response yet, fetch full kit
      if (!json.questions || json.questions.length === 0) {
        const fullKitRes = await fetch(`${API_URL}/kits/${id}`, { credentials: "include" });
        if (fullKitRes.ok) {
          const fullKitData = await fullKitRes.json();
          const actualFullKit = fullKitData.kit || fullKitData;
          if (actualFullKit.questions) {
            json.questions = actualFullKit.questions;
            setData({ ...json, questions: actualFullKit.questions });
          }
        }
      }
    } catch (err: any) {
      console.error("Practice load error:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchPracticeData();
  }, [fetchPracticeData]);

  // Questions filtered list
  const filteredQuestions = useMemo(() => {
    const list = data?.questions || [];
    if (questionFilter === "all") return list;
    return list.filter((q) => q.category === questionFilter);
  }, [data?.questions, questionFilter]);

  const currentQuestion = useMemo(() => {
    if (filteredQuestions.length === 0) return null;
    return filteredQuestions[currentQIndex] || filteredQuestions[0];
  }, [filteredQuestions, currentQIndex]);

  // Flashcards list
  const flashcards = useMemo(() => data?.flashcards || [], [data?.flashcards]);
  const currentCard = useMemo(() => {
    if (flashcards.length === 0) return null;
    return flashcards[cardIndex] || flashcards[0];
  }, [flashcards, cardIndex]);

  // Evaluate candidate answer with AI
  const handleEvaluateAnswer = async () => {
    if (!currentQuestion) return;
    const answer = (userAnswers[currentQuestion.id] || "").trim();
    if (!answer) {
      alert("Please write your answer response before requesting AI scoring.");
      return;
    }

    try {
      setEvaluating(true);
      const res = await fetch(`${API_URL}/kits/${id}/practice/evaluate-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          question_id: currentQuestion.id,
          user_answer: answer,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || "Evaluation failed.");
      }

      const result = await res.json();
      if (result.evaluation) {
        setEvaluations((prev) => ({
          ...prev,
          [currentQuestion.id]: result.evaluation,
        }));
      }
    } catch (err: any) {
      console.error("Evaluation error:", err);
      alert(err.message || "Failed to score answer.");
    } finally {
      setEvaluating(false);
    }
  };

  // Toggle model answer visibility
  const toggleModelAnswer = (qid: string) => {
    setShowModelAnswer((prev) => ({
      ...prev,
      [qid]: !prev[qid],
    }));
  };

  // Submit flashcard confidence rating
  const handleRateFlashcard = async (confidence: number) => {
    if (!currentCard || submittingRating) return;

    try {
      setSubmittingRating(true);
      setJustRatedFeedback(confidence);

      const res = await fetch(`${API_URL}/kits/${id}/practice/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          card_id: currentCard.id,
          confidence,
        }),
      });

      if (res.ok) {
        const resJson = await res.json();
        if (resJson?.coverage) {
          setData((prev) => (prev ? { ...prev, coverage: resJson.coverage } : prev));
        }
      }

      setTimeout(() => {
        if (cardIndex < flashcards.length - 1) {
          setCardIndex((prev) => prev + 1);
          setIsFlipped(false);
          setJustRatedFeedback(null);
        } else {
          setIsSessionFinished(true);
        }
        setSubmittingRating(false);
      }, 250);
    } catch (err) {
      console.error("Failed to record rating:", err);
      setSubmittingRating(false);
    }
  };

  // Render difficulty rating badge
  const renderDifficulty = (level: number) => {
    const bars = [1, 2, 3];
    return (
      <div className="flex items-center gap-1" title={`Difficulty: Level ${level}`}>
        {bars.map((b) => (
          <span
            key={b}
            className={`h-2.5 w-2 rounded-sm ${
              b <= level ? "bg-amber-500 dark:bg-amber-400" : "bg-slate-200 dark:bg-zinc-700"
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#08090d] text-slate-900 dark:text-zinc-100">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-32 text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mb-4" />
          <h2 className="text-xl font-semibold">Initializing Practice Environment...</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
            Loading tailored scenarios, model benchmarks, and active memory cards.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#08090d] text-slate-900 dark:text-zinc-100">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <div className="p-8 rounded-3xl bg-white/80 dark:bg-[#0e1322]/80 backdrop-blur-xl border border-rose-500/20 shadow-xl">
            <h2 className="text-2xl font-bold text-rose-500 mb-4">Practice Session Unavailable</h2>
            <p className="text-slate-600 dark:text-zinc-300 mb-8">{error || "Could not load kit data."}</p>
            <div className="flex justify-center gap-4">
              <Link
                href={`/kits/${id}`}
                className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black font-semibold hover:opacity-90 transition-opacity"
              >
                Return to Kit Overview
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentEval = currentQuestion ? evaluations[currentQuestion.id] : null;
  const isModelAnswerVisible = currentQuestion ? showModelAnswer[currentQuestion.id] : false;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#08090d] text-slate-900 dark:text-zinc-100 font-sans transition-colors duration-200 pb-32">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* TOP BREADCRUMB & HEADER */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-zinc-400 mb-3">
            <Link href="/kits" className="hover:text-blue-500 transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <Link href={`/kits/${id}`} className="hover:text-blue-500 transition-colors">
              {data.company} ({data.role})
            </Link>
            <span>/</span>
            <span className="text-slate-900 dark:text-zinc-200">Interactive Practice</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-lg">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {data.company} Interview Practice
                </h1>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {data.role}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                Answer live scenario questions for AI scoring and drill memory flashcards with spaced repetition.
              </p>
            </div>

            {/* MODE SWITCHER PILL */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] self-start md:self-auto">
              <button
                onClick={() => setActiveMode("questions")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  activeMode === "questions"
                    ? "bg-white dark:bg-[#1a2138] text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>🧠</span>
                <span>Question Practice & AI Scoring</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono">
                  {data.questions?.length || 0}
                </span>
              </button>

              <button
                onClick={() => setActiveMode("flashcards")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  activeMode === "flashcards"
                    ? "bg-white dark:bg-[#1a2138] text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>⚡</span>
                <span>Flashcards</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono">
                  {flashcards.length}
                </span>
              </button>

              <button
                onClick={() => setActiveMode("coverage")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  activeMode === "coverage"
                    ? "bg-white dark:bg-[#1a2138] text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>📊</span>
                <span>Coverage</span>
              </button>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* MODE 1: QUESTION PRACTICE WITH AI EVALUATION */}
        {/* ------------------------------------------------------------- */}
        {activeMode === "questions" && (
          <div>
            {filteredQuestions.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08]">
                <p className="text-slate-500 dark:text-zinc-400 text-lg">
                  No questions match the current filter.
                </p>
                <button
                  onClick={() => setQuestionFilter("all")}
                  className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white font-medium text-sm"
                >
                  Clear Filter
                </button>
              </div>
            ) : currentQuestion ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* LEFT: QUESTION WORKSPACE (8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                  {/* QUESTION CARD */}
                  <div className="p-6 sm:p-8 rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-lg">
                    {/* Meta bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-5 border-b border-slate-200/80 dark:border-white/[0.08]">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                            CATEGORY_LABELS[currentQuestion.category]?.badge ||
                            "bg-slate-500/10 text-slate-600"
                          }`}
                        >
                          {CATEGORY_LABELS[currentQuestion.category]?.label || currentQuestion.category}
                        </span>
                        <div className="flex items-center gap-1.5 pl-2">
                          <span className="text-xs text-slate-500 dark:text-zinc-400">Difficulty:</span>
                          {renderDifficulty(currentQuestion.difficulty)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-slate-500 dark:text-zinc-400">
                          Scenario {currentQIndex + 1} of {filteredQuestions.length}
                        </span>
                      </div>
                    </div>

                    {/* Question Prompt */}
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white leading-snug mb-6">
                      {currentQuestion.prompt}
                    </h2>

                    {/* CANDIDATE ANSWER TEXTAREA */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                          <span>✍️ Your Interview Answer</span>
                        </label>
                        <span className="text-xs font-mono text-slate-400">
                          {((userAnswers[currentQuestion.id] || "").trim().split(/\s+/).filter(Boolean).length)} words
                        </span>
                      </div>

                      <textarea
                        rows={7}
                        value={userAnswers[currentQuestion.id] || ""}
                        onChange={(e) =>
                          setUserAnswers((prev) => ({
                            ...prev,
                            [currentQuestion.id]: e.target.value,
                          }))
                        }
                        placeholder="Type your structured answer here (e.g. STAR format, architecture trade-offs, metrics, failure considerations)..."
                        className="w-full p-4 rounded-2xl bg-slate-50/80 dark:bg-black/30 border border-slate-300/80 dark:border-white/[0.1] text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-normal text-base resize-y transition-all"
                      />

                      {/* ACTIONS: SCORE WITH AI & SHOW MODEL ANSWER */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleEvaluateAnswer}
                            disabled={evaluating || !(userAnswers[currentQuestion.id] || "").trim()}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                          >
                            {evaluating ? (
                              <>
                                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                <span>Evaluating Answer...</span>
                              </>
                            ) : (
                              <>
                                <span>🤖 Score My Answer with AI</span>
                              </>
                            )}
                          </button>

                          {/* SHOW MODEL ANSWER (Strictly hidden until user clicks, prevents spoiler & saves token) */}
                          <button
                            onClick={() => toggleModelAnswer(currentQuestion.id)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-700 dark:text-zinc-200 font-medium text-sm border border-slate-200 dark:border-white/[0.08] transition-all"
                          >
                            <span>{isModelAnswerVisible ? "👁️ Hide Model Answer" : "💡 Show Model Answer"}</span>
                          </button>
                        </div>

                        {/* NAV PREV / NEXT */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (currentQIndex > 0) setCurrentQIndex((prev) => prev - 1);
                            }}
                            disabled={currentQIndex === 0}
                            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-700 dark:text-zinc-300 font-medium text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ← Previous
                          </button>
                          <button
                            onClick={() => {
                              if (currentQIndex < filteredQuestions.length - 1) {
                                setCurrentQIndex((prev) => prev + 1);
                              }
                            }}
                            disabled={currentQIndex === filteredQuestions.length - 1}
                            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-700 dark:text-zinc-300 font-medium text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            Next Question →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MODEL ANSWER ACCORDION (Reveals exact benchmark when clicked) */}
                  {isModelAnswerVisible && (
                    <div className="p-6 rounded-3xl bg-amber-500/[0.06] border border-amber-500/20 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-300 shadow-md">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-500 font-bold text-sm">🎯 Benchmark Model Answer</span>
                          <span className="text-[11px] text-amber-600/80 dark:text-amber-400/80 font-medium">
                            (Staff / Principal Baseline)
                          </span>
                        </div>
                        <button
                          onClick={() => toggleModelAnswer(currentQuestion.id)}
                          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                        >
                          ✕ Close
                        </button>
                      </div>

                      <div className="text-sm sm:text-base leading-relaxed text-slate-800 dark:text-zinc-200 whitespace-pre-line font-normal bg-white/60 dark:bg-black/40 p-4 rounded-2xl border border-amber-500/10">
                        {currentEval?.modelAnswer || currentQuestion.answer_outline || (
                          "Demonstrate architectural constraints, failure isolation boundaries, idempotency keys, and explicit performance SLAs."
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI EVALUATION FEEDBACK CARD */}
                  {currentEval && (
                    <div className="p-6 sm:p-8 rounded-3xl bg-white/90 dark:bg-[#0e1428]/90 backdrop-blur-xl border border-blue-500/30 shadow-xl shadow-blue-500/5 animate-in fade-in slide-in-from-top-3 duration-300">
                      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-white/[0.08]">
                        <div className="flex items-center gap-4">
                          {/* Radial Score Badge */}
                          <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/20 border border-blue-500/30">
                            <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                              {currentEval.score}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                                Bar Raiser Verdict
                              </span>
                            </div>
                            <h3
                              className={`text-xl font-bold ${
                                currentEval.verdict === "Strong Hire" || currentEval.verdict === "Hire"
                                  ? "text-emerald-500"
                                  : currentEval.verdict === "Leaning Hire"
                                  ? "text-amber-500"
                                  : "text-rose-500"
                              }`}
                            >
                              {currentEval.verdict}
                            </h3>
                          </div>
                        </div>

                        <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-white/[0.05] px-3 py-1.5 rounded-xl">
                          Score: {currentEval.score}/100
                        </span>
                      </div>

                      {/* Summary text */}
                      <p className="mt-4 text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed">
                        {currentEval.summary}
                      </p>

                      {/* Strengths & Improvements Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        {/* STRENGTHS */}
                        <div className="p-4 rounded-2xl bg-emerald-500/[0.05] border border-emerald-500/20">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                            <span>✓ Key Strengths</span>
                          </h4>
                          <ul className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
                            {currentEval.strengths?.map((str, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-emerald-500 font-bold">•</span>
                                <span>{str}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* IMPROVEMENTS */}
                        <div className="p-4 rounded-2xl bg-amber-500/[0.05] border border-amber-500/20">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                            <span>⚡ How to Elevate</span>
                          </h4>
                          <ul className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
                            {currentEval.improvements?.map((imp, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-amber-500 font-bold">•</span>
                                <span>{imp}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT: QUESTION JUMPER & CATEGORY LIST (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                  {/* CATEGORY FILTER */}
                  <div className="p-5 rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-3">
                      Filter Scenarios
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {["all", "technical", "system-design", "behavioural", "company-fit"].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => {
                            setQuestionFilter(cat);
                            setCurrentQIndex(0);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                            questionFilter === cat
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-600 dark:text-zinc-400"
                          }`}
                        >
                          {cat === "all" ? "All" : cat.replace("-", " ")}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* QUESTION PROGRESS LIST */}
                  <div className="p-5 rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        Interview Scenarios ({filteredQuestions.length})
                      </h3>
                      <span className="text-xs font-mono text-slate-400">
                        {Object.keys(evaluations).length}/{filteredQuestions.length} Scored
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                      {filteredQuestions.map((q, idx) => {
                        const isCurrent = idx === currentQIndex;
                        const hasAnswer = Boolean((userAnswers[q.id] || "").trim());
                        const evaluation = evaluations[q.id];

                        return (
                          <button
                            key={q.id}
                            onClick={() => setCurrentQIndex(idx)}
                            className={`w-full text-left p-3 rounded-2xl transition-all border ${
                              isCurrent
                                ? "bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-300 font-semibold"
                                : "bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.02] dark:hover:bg-white/[0.06] border-slate-200/80 dark:border-white/[0.05] text-slate-700 dark:text-zinc-300"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                                Question {idx + 1}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {evaluation && (
                                  <span
                                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                      evaluation.score >= 80
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    }`}
                                  >
                                    {evaluation.score}pts
                                  </span>
                                )}
                                {hasAnswer && !evaluation && (
                                  <span className="text-[10px] text-blue-500 font-medium">Drafted</span>
                                )}
                              </div>
                            </div>
                            <p className="text-xs line-clamp-2 leading-relaxed">{q.prompt}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 2: FLASHCARD DRILL & SPACED REPETITION */}
        {/* ------------------------------------------------------------- */}
        {activeMode === "flashcards" && (
          <div className="max-w-4xl mx-auto">
            {flashcards.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08]">
                <h3 className="text-xl font-bold mb-2">No Flashcards Available</h3>
                <p className="text-slate-500 dark:text-zinc-400 mb-6 text-sm">
                  You can regenerate flashcards or add custom cards in the kit overview.
                </p>
                <Link
                  href={`/kits/${id}`}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm"
                >
                  Go to Kit Overview
                </Link>
              </div>
            ) : isSessionFinished ? (
              /* SESSION FINISHED SUMMARY */
              <div className="p-10 rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] text-center shadow-xl">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 text-3xl mb-4">
                  🎉
                </div>
                <h2 className="text-2xl font-bold mb-2">Drill Session Complete!</h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto mb-8">
                  You reviewed all {flashcards.length} flashcards in this deck. Spaced repetition intervals have been logged.
                </p>

                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => {
                      setCardIndex(0);
                      setIsFlipped(false);
                      setIsSessionFinished(false);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md transition-all"
                  >
                    Drill Deck Again
                  </button>
                  <Link
                    href={`/kits/${id}`}
                    className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 font-semibold text-sm border border-slate-200 dark:border-white/[0.08]"
                  >
                    Back to Kit
                  </Link>
                </div>
              </div>
            ) : currentCard ? (
              <div className="space-y-6">
                {/* DECK PROGRESS HEADER */}
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
                      Card {cardIndex + 1} of {flashcards.length}
                    </span>
                    <span className="text-slate-300 dark:text-zinc-700">•</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">
                      {Math.round(((cardIndex) / flashcards.length) * 100)}% Complete
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-32 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-300"
                      style={{ width: `${((cardIndex + 1) / flashcards.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* 3D FLIP CARD */}
                <div
                  onClick={() => setIsFlipped((prev) => !prev)}
                  className="cursor-pointer group relative min-h-[380px] sm:min-h-[420px] rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-8 sm:p-12 flex flex-col justify-between shadow-xl transition-all duration-300 hover:shadow-2xl hover:border-indigo-500/30"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      {isFlipped ? "Answer" : "Question Prompt"}
                    </span>
                    <span className="text-xs text-slate-400 group-hover:text-indigo-500 transition-colors">
                      {isFlipped ? "Click to see prompt ↺" : "Click to reveal answer ↻"}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="my-auto py-6">
                    <p className="text-xl sm:text-2xl md:text-3xl font-medium tracking-tight text-slate-900 dark:text-white leading-relaxed text-center">
                      {isFlipped ? currentCard.back : currentCard.front}
                    </p>
                  </div>

                  {/* Footer hint */}
                  <div className="text-center pt-4 border-t border-slate-100 dark:border-white/[0.05]">
                    <span className="text-xs text-slate-400">
                      Shortcut: Press Space or Enter to flip
                    </span>
                  </div>
                </div>

                {/* SM-2 CONFIDENCE RATING BUTTONS */}
                {isFlipped ? (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="text-center">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        How well did you recall this?
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {RATING_SCALES.map((scale) => (
                        <button
                          key={scale.key}
                          onClick={() => handleRateFlashcard(scale.key)}
                          disabled={submittingRating}
                          className={`p-3.5 rounded-2xl border text-center transition-all disabled:opacity-50 ${scale.bg}`}
                        >
                          <div className="font-bold text-sm">{scale.label}</div>
                          <div className="text-[11px] opacity-75">{scale.sub}</div>
                          <div className="text-[10px] mt-1 opacity-60 line-clamp-1">{scale.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <button
                      onClick={() => setIsFlipped(true)}
                      className="px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-500/20 transition-all active:scale-[0.98]"
                    >
                      Reveal Answer (Space)
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 3: COVERAGE MATRIX */}
        {/* ------------------------------------------------------------- */}
        {activeMode === "coverage" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-lg">
              <h2 className="text-xl font-bold mb-4">Kit Practice Coverage</h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
                Tracks mastery of interview topics based on SM-2 recall retention and answered scenario depth.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.05]">
                  <div className="text-xs text-slate-400 mb-1">Total Cards</div>
                  <div className="text-2xl font-black font-mono">{data.coverage?.totalCards || flashcards.length}</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.05]">
                  <div className="text-xs text-slate-400 mb-1">Practiced</div>
                  <div className="text-2xl font-black font-mono text-emerald-500">
                    {data.coverage?.practicedCardsCount || 0}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.05]">
                  <div className="text-xs text-slate-400 mb-1">Coverage Rate</div>
                  <div className="text-2xl font-black font-mono text-blue-500">
                    {data.coverage?.cardCoveragePercentage || 0}%
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.05]">
                  <div className="text-xs text-slate-400 mb-1">Scored Questions</div>
                  <div className="text-2xl font-black font-mono text-purple-500">
                    {Object.keys(evaluations).length} / {data.questions?.length || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
