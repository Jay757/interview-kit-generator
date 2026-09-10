"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
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
  flashcards: Flashcard[];
  coverage: CoverageSummary;
  attempts: PracticeAttempt[];
}

const RATING_SCALES = [
  {
    key: 1,
    label: "Again",
    sub: "< 1 min",
    desc: "Complete blackout or incorrect",
    color: "rose",
    bg: "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30",
    activeBorder: "border-rose-400",
  },
  {
    key: 2,
    label: "Hard",
    sub: "1 day",
    desc: "Recalled with significant hesitation",
    color: "amber",
    bg: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30",
    activeBorder: "border-amber-400",
  },
  {
    key: 3,
    label: "Good",
    sub: "3 days",
    desc: "Correct recall with reasonable effort",
    color: "emerald",
    bg: "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    activeBorder: "border-emerald-400",
  },
  {
    key: 4,
    label: "Easy",
    sub: "5+ days",
    desc: "Instant, effortless mastery",
    color: "cyan",
    bg: "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    activeBorder: "border-cyan-400",
  },
];

export default function PracticeModePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PracticeData | null>(null);

  // Deck state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [activeDeck, setActiveDeck] = useState<Flashcard[]>([]);
  const [viewMode, setViewMode] = useState<"practice" | "coverage">("practice");

  // Session stats
  const [sessionRatings, setSessionRatings] = useState<Map<string, number>>(new Map());
  const [isSessionFinished, setIsSessionFinished] = useState(false);
  const [justRatedFeedback, setJustRatedFeedback] = useState<number | null>(null);

  // Fetch practice data
  const fetchPracticeData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`http://localhost:4000/kits/${id}/practice`, {
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
      setActiveDeck(json.flashcards || []);
      setCurrentIndex(0);
      setIsFlipped(false);
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

  const currentCard = useMemo(() => {
    if (!activeDeck || activeDeck.length === 0) return null;
    return activeDeck[currentIndex] || null;
  }, [activeDeck, currentIndex]);

  // Flip action
  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  // Next and Previous navigation
  const handleNext = useCallback(() => {
    if (currentIndex < activeDeck.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
      setJustRatedFeedback(null);
    } else {
      setIsSessionFinished(true);
    }
  }, [currentIndex, activeDeck.length]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
      setJustRatedFeedback(null);
    }
  }, [currentIndex]);

  // Submit confidence rating
  const handleRate = useCallback(
    async (confidence: number) => {
      if (!currentCard || submittingRating) return;

      try {
        setSubmittingRating(true);
        setJustRatedFeedback(confidence);

        // Record locally for session summary
        setSessionRatings((prev) => {
          const next = new Map(prev);
          next.set(currentCard.id, confidence);
          return next;
        });

        // Persist to backend
        const res = await fetch(`http://localhost:4000/kits/${id}/practice/attempt`, {
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

        // Brief 250ms feedback before advancing to next card
        setTimeout(() => {
          handleNext();
          setSubmittingRating(false);
        }, 220);
      } catch (err) {
        console.error("Failed to record attempt:", err);
        setSubmittingRating(false);
      }
    },
    [currentCard, submittingRating, id, handleNext]
  );

  // Keyboard navigation listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if focus is in an input or textarea
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (isSessionFinished) {
        if (e.key === "Escape") {
          setIsSessionFinished(false);
        }
        return;
      }

      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        handleFlip();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevious();
      } else if (["1", "2", "3", "4"].includes(e.key)) {
        // Only rate if revealed
        if (isFlipped) {
          e.preventDefault();
          handleRate(parseInt(e.key, 10));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFlip, handleNext, handlePrevious, handleRate, isFlipped, isSessionFinished]);

  // Filter deck to weak cards only
  const handleDrillWeakCards = () => {
    if (!data) return;
    const weakCardIds = new Set<string>();

    // From session ratings
    sessionRatings.forEach((conf, cardId) => {
      if (conf <= 2) weakCardIds.add(cardId);
    });

    // From historical attempts
    for (const att of data.attempts || []) {
      if (att.confidence <= 2) weakCardIds.add(att.card_id);
    }

    const weakDeck = data.flashcards.filter((f) => weakCardIds.has(f.id));
    if (weakDeck.length > 0) {
      setActiveDeck(weakDeck);
    } else {
      setActiveDeck(data.flashcards);
    }
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsSessionFinished(false);
    setSessionRatings(new Map());
  };

  // Restart full deck
  const handleRestartFullDeck = () => {
    if (!data) return;
    setActiveDeck(data.flashcards || []);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsSessionFinished(false);
    setSessionRatings(new Map());
  };

  // Session summary calculations
  const sessionSummary = useMemo(() => {
    const reviewedCount = sessionRatings.size;
    let sumConf = 0;
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0 };
    sessionRatings.forEach((conf) => {
      sumConf += conf;
      if (conf in dist) dist[conf as 1 | 2 | 3 | 4]++;
    });
    const avg = reviewedCount > 0 ? (sumConf / reviewedCount).toFixed(1) : "0.0";
    const neverAttemptedRemaining = data
      ? Math.max(0, data.flashcards.length - (data.coverage?.practicedCardsCount || 0))
      : 0;

    return {
      reviewedCount,
      avgConfidence: avg,
      distribution: dist,
      neverAttemptedRemaining,
    };
  }, [sessionRatings, data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="h-10 w-10 mx-auto rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <p className="text-sm font-mono text-zinc-400">Loading Adaptive Practice Deck...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-[#0f1117] p-8 text-center space-y-4 shadow-2xl">
            <div className="h-12 w-12 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 text-xl font-bold">
              !
            </div>
            <h2 className="text-lg font-bold text-white">Practice Mode Unavailable</h2>
            <p className="text-sm text-zinc-400">{error || "Failed to load deck data."}</p>
            <div className="pt-2">
              <button
                onClick={() => router.push(`/kits/${id}`)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
              >
                ← Return to Kit Builder
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const progressPct =
    activeDeck.length > 0 ? Math.round(((currentIndex + 1) / activeDeck.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex flex-col bg-grid-architectural">
      <Navbar />

      {/* TOP COMMAND BAR */}
      <header className="sticky top-14 z-30 border-b border-zinc-800/80 bg-[#090a0f]/90 backdrop-blur-md px-4 py-3 sm:px-8">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4">
          {/* Left: Breadcrumbs & Meta */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/kits/${id}`)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-700/70 bg-zinc-900/80 hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition-colors shadow-sm"
              title="Return to Kit Builder"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Kit</span>
            </button>

            <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-amber-400 uppercase tracking-wider">
                  Practice Mode
                </span>
                <span className="text-zinc-600 text-xs">•</span>
                <span className="text-xs text-zinc-400 font-medium">
                  {data.company} — {data.role}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Live Progress */}
          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-zinc-400">
              Card <span className="text-amber-300 font-bold">{currentIndex + 1}</span> of{" "}
              <span className="text-zinc-300">{activeDeck.length}</span>
            </div>
            <div className="w-28 sm:w-40 h-2 bg-zinc-800/80 rounded-full overflow-hidden border border-zinc-700/40">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Right: View Mode & End Session */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950/60 p-0.5">
              <button
                onClick={() => setViewMode("practice")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewMode === "practice"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                ⚡ Drill Deck
              </button>
              <button
                onClick={() => setViewMode("coverage")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewMode === "coverage"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                📊 Coverage Radar
              </button>
            </div>

            <button
              onClick={() => setIsSessionFinished(true)}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition-colors"
            >
              Finish Session
            </button>
          </div>
        </div>
      </header>

      {/* MAIN VIEW */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-6 sm:px-8">
        {viewMode === "practice" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT RAIL: FLASHCARD STAGE (8 COLS) */}
            <div className="lg:col-span-8 flex flex-col items-center space-y-6">
              {currentCard ? (
                <div className="w-full max-w-2xl">
                  {/* Card Header & Badges */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-wide">
                        Card #{currentIndex + 1}
                      </span>
                      {currentCard.requirement_ids?.map((rid) => (
                        <span
                          key={rid}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700"
                          title={`Linked Requirement ID: ${rid}`}
                        >
                          req:{rid}
                        </span>
                      ))}
                    </div>

                    <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2">
                      <span>{isFlipped ? "Answer Outline" : "Question Prompt"}</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-amber-400/80">Space / Click to Flip</span>
                    </div>
                  </div>

                  {/* 3D PERSPECTIVE CARD CONTAINER */}
                  <div
                    onClick={handleFlip}
                    className="perspective-1000 w-full min-h-[360px] sm:min-h-[400px] cursor-pointer select-none group"
                  >
                    <div
                      className={`relative w-full h-full min-h-[360px] sm:min-h-[400px] rounded-2xl border transition-all duration-500 transform-style-preserve-3d shadow-2xl ${
                        isFlipped ? "rotate-y-180" : ""
                      } ${
                        isFlipped
                          ? "border-amber-500/40 bg-[#12151f] shadow-amber-500/5"
                          : "border-zinc-700/80 bg-[#0f1117] hover:border-zinc-500/80 shadow-black/40"
                      }`}
                    >
                      {/* FRONT FACE (QUESTION) */}
                      <div className="absolute inset-0 backface-hidden p-6 sm:p-8 flex flex-col justify-between rounded-2xl">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                              RECALL CHALLENGE
                            </span>
                            <span className="text-zinc-500">SM-2 Adaptive Deck</span>
                          </div>

                          <div className="pt-4">
                            <h3 className="text-lg sm:text-2xl font-semibold text-white leading-relaxed tracking-tight">
                              {currentCard.front}
                            </h3>
                          </div>
                        </div>

                        {/* Front Footer Prompt */}
                        <div className="pt-6 border-t border-zinc-800/80 flex items-center justify-between">
                          <span className="text-xs text-zinc-400 flex items-center gap-1.5 font-medium">
                            <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Click card or press <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-zinc-300">Space</kbd> to reveal answer
                          </span>

                          <span className="text-xs text-amber-400 font-semibold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                            Reveal Back →
                          </span>
                        </div>
                      </div>

                      {/* BACK FACE (ANSWER & CONFIDENCE RATING) */}
                      <div className="absolute inset-0 backface-hidden rotate-y-180 p-6 sm:p-8 flex flex-col justify-between rounded-2xl bg-[#12151f]">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-xs text-amber-400 font-mono">
                            <span className="flex items-center gap-1.5 font-semibold">
                              <span>✓</span>
                              MODEL ANSWER & KEY TAKEAWAYS
                            </span>
                            <span className="text-zinc-500">Rate your recall</span>
                          </div>

                          <div className="pt-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                            <p className="text-sm sm:text-base text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans">
                              {currentCard.back}
                            </p>
                          </div>
                        </div>

                        {/* Back Footer: Quick Confidence Rating Buttons */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="pt-4 border-t border-zinc-800/90 space-y-2.5"
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                            <span>How easily did you recall this?</span>
                            <span className="text-zinc-500">Press 1–4 on keyboard</span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {RATING_SCALES.map((scale) => {
                              const isRatedNow = justRatedFeedback === scale.key;
                              return (
                                <button
                                  key={scale.key}
                                  disabled={submittingRating}
                                  onClick={() => handleRate(scale.key)}
                                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center group/btn ${
                                    scale.bg
                                  } ${isRatedNow ? scale.activeBorder + " ring-2 ring-amber-400" : ""}`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="h-4 w-4 rounded bg-zinc-950/60 border border-zinc-700/50 flex items-center justify-center text-[10px] font-mono font-bold text-zinc-300">
                                      {scale.key}
                                    </span>
                                    <span className="text-xs font-bold">{scale.label}</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-zinc-400 mt-0.5">
                                    {scale.sub}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM STEPPER CONTROLS */}
                  <div className="flex items-center justify-between mt-4 px-2">
                    <button
                      onClick={handlePrevious}
                      disabled={currentIndex === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-xs font-medium text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <span>←</span>
                      <span>Previous</span>
                    </button>

                    <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
                      <span>
                        <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700 text-zinc-300">←</kbd> /{" "}
                        <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700 text-zinc-300">→</kbd> to step
                      </span>
                    </div>

                    <button
                      onClick={handleNext}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition-colors"
                    >
                      <span>{currentIndex === activeDeck.length - 1 ? "Finish Deck" : "Next"}</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-zinc-400">No cards in current deck filter.</div>
              )}
            </div>

            {/* RIGHT RAIL: LIVE SESSION STATS & REQUIREMENTS COVERAGE (4 COLS) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Coverage Snapshot Card */}
              <div className="rounded-2xl border border-zinc-800/90 bg-[#0f1117] p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <span>⚡</span>
                    <span>Adaptive Study Radar</span>
                  </h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    SM-2 Active
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40">
                    <div className="text-[10px] font-mono text-zinc-400 uppercase">Flashcard Recall</div>
                    <div className="text-lg font-bold text-white mt-1">
                      {data.coverage?.cardCoveragePercentage || 0}%
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {data.coverage?.practicedCardsCount || 0} / {data.coverage?.totalCards || 0} practiced
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40">
                    <div className="text-[10px] font-mono text-zinc-400 uppercase">Avg Confidence</div>
                    <div className="text-lg font-bold text-amber-400 mt-1">
                      {data.coverage?.averageConfidence ? `${data.coverage.averageConfidence} / 4.0` : "New"}
                    </div>
                    <div className="text-[11px] text-zinc-400">Cumulative score</div>
                  </div>
                </div>

                {/* Score breakdown distribution */}
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-mono text-zinc-400 flex justify-between">
                    <span>Confidence Distribution</span>
                    <span>Latest attempts</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-mono">
                    <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                      <div>Again (1)</div>
                      <div className="font-bold text-xs mt-0.5">
                        {data.coverage?.confidenceDistribution?.[1] || 0}
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                      <div>Hard (2)</div>
                      <div className="font-bold text-xs mt-0.5">
                        {data.coverage?.confidenceDistribution?.[2] || 0}
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                      <div>Good (3)</div>
                      <div className="font-bold text-xs mt-0.5">
                        {data.coverage?.confidenceDistribution?.[3] || 0}
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                      <div>Easy (4)</div>
                      <div className="font-bold text-xs mt-0.5">
                        {data.coverage?.confidenceDistribution?.[4] || 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Requirements Covered via Flashcard Practice */}
                <div className="pt-2 border-t border-zinc-800/80 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-300">
                    <span>JD Requirement Reinforcement</span>
                    <span className="text-amber-400 font-bold">
                      {data.coverage?.coveredRequirementsCount || 0} /{" "}
                      {data.coverage?.totalRequirementsCount || 0}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Flashcards reinforce JD requirements through active recall. Green indicates at least 1 practice touch.
                  </p>
                </div>
              </div>

              {/* Keyboard Shortcut Cheatsheet */}
              <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4 space-y-2.5 text-xs">
                <div className="font-mono text-[10px] uppercase text-zinc-500 font-bold">Keyboard Navigation</div>
                <div className="grid grid-cols-2 gap-2 text-zinc-400 font-mono text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-zinc-200">Space</kbd>
                    <span>Flip card</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-zinc-200">1–4</kbd>
                    <span>Rate recall</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-zinc-200">→</kbd>
                    <span>Next card</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-zinc-200">←</kbd>
                    <span>Previous</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* FULL COVERAGE RADAR MATRIX VIEW */
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Syllabus Practice Coverage Matrix</h3>
                <p className="text-xs text-zinc-400">
                  Comprehensive audit of practiced flashcards vs unpracticed cards and JD requirement mapping
                </p>
              </div>
              <button
                onClick={() => setViewMode("practice")}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors"
              >
                Back to Drill Deck →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Practiced Flashcards */}
              <div className="rounded-2xl border border-emerald-500/20 bg-[#0f1117] p-5 space-y-4">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    PRACTICED FLASHCARDS ({data.coverage?.practicedCardsCount || 0})
                  </span>
                  <span className="text-zinc-500">Active Recall History</span>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {data.flashcards
                    .filter((f) => data.coverage?.practicedCardIds?.includes(f.id))
                    .map((card) => (
                      <div
                        key={card.id}
                        className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/40 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400">
                          <span className="text-emerald-400 font-semibold">{card.id}</span>
                          <span>req: {card.requirement_ids?.join(", ")}</span>
                        </div>
                        <div className="text-zinc-200 font-medium line-clamp-2">{card.front}</div>
                      </div>
                    ))}
                  {(data.coverage?.practicedCardsCount || 0) === 0 && (
                    <div className="p-6 text-center text-zinc-500 text-xs font-mono">
                      No flashcards practiced yet. Flip and rate cards in Drill Deck!
                    </div>
                  )}
                </div>
              </div>

              {/* Untouched Flashcards */}
              <div className="rounded-2xl border border-zinc-800 bg-[#0f1117] p-5 space-y-4">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-amber-400 font-bold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    UNTOUCHED FLASHCARDS ({data.coverage?.unpracticedCardsCount || 0})
                  </span>
                  <span className="text-zinc-500">Prioritized by SM-2 for next run</span>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {data.flashcards
                    .filter((f) => data.coverage?.unpracticedCardIds?.includes(f.id))
                    .map((card) => (
                      <div
                        key={card.id}
                        className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400">
                          <span className="text-amber-400/80 font-semibold">{card.id}</span>
                          <span>req: {card.requirement_ids?.join(", ")}</span>
                        </div>
                        <div className="text-zinc-200 font-medium line-clamp-2">{card.front}</div>
                      </div>
                    ))}
                  {(data.coverage?.unpracticedCardsCount || 0) === 0 && (
                    <div className="p-6 text-center text-emerald-400 text-xs font-mono">
                      ✓ 100% syllabus coverage! Every flashcard has been practiced at least once.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* SESSION FINISHED MODAL / SUMMARY DIALOG */}
      {isSessionFinished && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#0f1117] p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl">
                🏆
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Practice Run Completed</h3>
              <p className="text-xs text-zinc-400">
                Spaced repetition attempts recorded and synchronized to your prep kit
              </p>
            </div>

            {/* Session Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 text-center">
                <div className="text-[10px] font-mono text-zinc-400 uppercase">Reviewed</div>
                <div className="text-xl font-bold text-white mt-1">{sessionSummary.reviewedCount}</div>
                <div className="text-[10px] text-zinc-500">cards this run</div>
              </div>

              <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 text-center">
                <div className="text-[10px] font-mono text-zinc-400 uppercase">Avg Rating</div>
                <div className="text-xl font-bold text-amber-400 mt-1">{sessionSummary.avgConfidence}</div>
                <div className="text-[10px] text-zinc-500">out of 4.0</div>
              </div>

              <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 text-center">
                <div className="text-[10px] font-mono text-zinc-400 uppercase">Untouched</div>
                <div className="text-xl font-bold text-zinc-200 mt-1">
                  {sessionSummary.neverAttemptedRemaining}
                </div>
                <div className="text-[10px] text-zinc-500">cards remaining</div>
              </div>
            </div>

            {/* Rating breakdown visual */}
            <div className="space-y-2 p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40">
              <div className="text-[11px] font-mono text-zinc-400 flex justify-between">
                <span>Session Rating Breakdown</span>
                <span>Attempts</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-mono">
                <div className="p-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <div>Again</div>
                  <div className="font-bold text-xs mt-0.5">{sessionSummary.distribution[1]}</div>
                </div>
                <div className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <div>Hard</div>
                  <div className="font-bold text-xs mt-0.5">{sessionSummary.distribution[2]}</div>
                </div>
                <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                  <div>Good</div>
                  <div className="font-bold text-xs mt-0.5">{sessionSummary.distribution[3]}</div>
                </div>
                <div className="p-1 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                  <div>Easy</div>
                  <div className="font-bold text-xs mt-0.5">{sessionSummary.distribution[4]}</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={handleDrillWeakCards}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <span>↺</span>
                <span>Review Weak & Hard Cards</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleRestartFullDeck}
                  className="py-2 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                >
                  ↻ Restart Full Deck
                </button>
                <button
                  onClick={() => router.push(`/kits/${id}`)}
                  className="py-2 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors"
                >
                  ← Back to Kit Builder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
