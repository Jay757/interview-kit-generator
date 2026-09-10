"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Navbar } from "../../../components/Navbar";
import { useAuth } from "../../../context/AuthContext";
import {
  KitStructure,
  KitQuestion,
  KitRequirement,
  KitFlashcard,
  QuestionCategory,
  DifficultyLevel,
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

export default function KitBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();

  const [kit, setKit] = useState<KitStructure | null>(null);
  const [status, setStatus] = useState<"generating" | "completed" | "failed" | "loading">("loading");
  const [stage, setStage] = useState<string>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Active view tab
  const [activeTab, setActiveTab] = useState<"schedule" | "questions" | "flashcards" | "coverage">(
    "schedule"
  );

  // Selected schedule day
  const [selectedDay, setSelectedDay] = useState<number>(1);

  // Question category filter
  const [questionCategoryFilter, setQuestionCategoryFilter] = useState<QuestionCategory | "all">("all");

  // Expanded question IDs for answer outlines
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Set<string>>(new Set());

  // Editing state trackers
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingFlashcardId, setEditingFlashcardId] = useState<string | null>(null);
  const [isEditingBrief, setIsEditingBrief] = useState(false);
  const [briefSummaryInput, setBriefSummaryInput] = useState("");
  const [briefWhatTheyDoInput, setBriefWhatTheyDoInput] = useState("");

  // Adding state
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQuestionCategory, setNewQuestionCategory] = useState<QuestionCategory>("technical");
  const [newQuestionPrompt, setNewQuestionPrompt] = useState("");
  const [newQuestionAnswer, setNewQuestionAnswer] = useState("");
  const [newQuestionDifficulty, setNewQuestionDifficulty] = useState<DifficultyLevel>(2);

  const [isAddingFlashcard, setIsAddingFlashcard] = useState(false);
  const [newCardFront, setNewCardFront] = useState("");
  const [newCardBack, setNewCardBack] = useState("");

  // Section regeneration loading indicators
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);

  // Autosave status: "saved" | "saving" | "error"
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Interactive Flashcards deck state
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
            setBriefSummaryInput(fullData.kit.company_brief?.summary || "");
            setBriefWhatTheyDoInput(fullData.kit.company_brief?.what_they_do || "");
          }
        }
      } catch (err: any) {
        console.error("Failed to load full kit:", err);
      }
    };

    checkStatus();
    pollInterval = setInterval(checkStatus, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [id]);

  // Debounced Autosave to PATCH /kits/:id
  const triggerAutosave = useCallback(
    (updatedKit: KitStructure) => {
      setSaveStatus("saving");
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }

      autosaveTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`${API_URL}/kits/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              company_brief: updatedKit.company_brief,
              role: updatedKit.role,
              questions: updatedKit.questions,
              flashcards: updatedKit.flashcards,
              schedule: updatedKit.schedule,
              coverage: updatedKit.coverage,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            setKit(data.kit);
            setSaveStatus("saved");
          } else {
            setSaveStatus("error");
          }
        } catch {
          setSaveStatus("error");
        }
      }, 600);
    },
    [id]
  );

  // Update Question (inline edit, category change, difficulty change)
  const updateQuestion = (
    qid: string,
    updates: Partial<KitQuestion>,
    markAs: "edited" | "pinned" = "edited"
  ) => {
    if (!kit) return;
    const nextQuestions = kit.questions.map((q) => {
      if (q.id === qid) {
        return {
          ...q,
          ...updates,
          state: q.state === "pinned" ? "pinned" : markAs,
        };
      }
      return q;
    });

    const nextKit = { ...kit, questions: nextQuestions };
    setKit(nextKit);
    triggerAutosave(nextKit);
  };

  // Toggle question pin state
  const toggleQuestionPin = (qid: string) => {
    if (!kit) return;
    const nextQuestions = kit.questions.map((q) => {
      if (q.id === qid) {
        const nextState = q.state === "pinned" ? ("edited" as const) : ("pinned" as const);
        return { ...q, state: nextState };
      }
      return q;
    });
    const nextKit = { ...kit, questions: nextQuestions };
    setKit(nextKit);
    triggerAutosave(nextKit);
  };

  // Delete question with automatic cascade deletion from schedule
  const deleteQuestion = (qid: string) => {
    if (!kit) return;
    if (!confirm("Delete this question? It will be removed from your daily schedule.")) return;

    const nextQuestions = kit.questions.filter((q) => q.id !== qid);

    // Cascade remove from schedule days
    const nextDays = kit.schedule.days.map((day) => ({
      ...day,
      question_ids: day.question_ids.filter((id) => id !== qid),
    }));

    const nextSchedule = { ...kit.schedule, days: nextDays };
    const nextKit = { ...kit, questions: nextQuestions, schedule: nextSchedule };
    setKit(nextKit);
    triggerAutosave(nextKit);
  };

  // Move question position up/down within category
  const moveQuestion = (qid: string, direction: "up" | "down") => {
    if (!kit) return;
    const question = kit.questions.find((q) => q.id === qid);
    if (!question) return;

    const category = question.category;
    const categoryQuestions = kit.questions.filter((q) => q.category === category);
    const index = categoryQuestions.findIndex((q) => q.id === qid);

    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === categoryQuestions.length - 1) return;

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const temp = categoryQuestions[index];
    categoryQuestions[index] = categoryQuestions[swapIndex];
    categoryQuestions[swapIndex] = temp;

    // Mark moved items as edited to preserve order
    categoryQuestions[index].state = categoryQuestions[index].state === "pinned" ? "pinned" : "edited";
    categoryQuestions[swapIndex].state = categoryQuestions[swapIndex].state === "pinned" ? "pinned" : "edited";

    // Reconstruct full questions list
    const otherQuestions = kit.questions.filter((q) => q.category !== category);
    const nextQuestions = [...otherQuestions, ...categoryQuestions];

    const nextKit = { ...kit, questions: nextQuestions };
    setKit(nextKit);
    triggerAutosave(nextKit);
  };

  // Add new user-authored Question (marked "pinned" immediately)
  const handleAddQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kit || !newQuestionPrompt.trim()) return;

    const newId = `q_custom_${Date.now()}`;
    const customQ: KitQuestion = {
      id: newId,
      prompt: newQuestionPrompt.trim(),
      answer_outline: newQuestionAnswer.trim() || "User provided key answer points.",
      category: newQuestionCategory,
      difficulty: newQuestionDifficulty,
      requirement_ids: kit.role.requirements[0]?.id ? [kit.role.requirements[0].id] : [],
      state: "pinned",
    };

    // Add to questions
    const nextQuestions = [...kit.questions, customQ];

    // Add to active schedule day if available
    const nextDays = kit.schedule.days.map((d) => {
      if (d.day === selectedDay) {
        return { ...d, question_ids: [...d.question_ids, newId] };
      }
      return d;
    });

    const nextKit = {
      ...kit,
      questions: nextQuestions,
      schedule: { ...kit.schedule, days: nextDays },
    };

    setKit(nextKit);
    triggerAutosave(nextKit);

    // Reset add form
    setNewQuestionPrompt("");
    setNewQuestionAnswer("");
    setIsAddingQuestion(false);
  };

  // Update Flashcard
  const updateFlashcard = (fid: string, front: string, back: string) => {
    if (!kit) return;
    const nextCards = kit.flashcards.map((c) => {
      if (c.id === fid) {
        return {
          ...c,
          front,
          back,
          state: c.state === "pinned" ? ("pinned" as const) : ("edited" as const),
        };
      }
      return c;
    });
    const nextKit = { ...kit, flashcards: nextCards };
    setKit(nextKit);
    triggerAutosave(nextKit);
    setEditingFlashcardId(null);
  };

  // Delete Flashcard
  const deleteFlashcard = (fid: string) => {
    if (!kit) return;
    const nextCards = kit.flashcards.filter((c) => c.id !== fid);
    const nextKit = { ...kit, flashcards: nextCards };
    setKit(nextKit);
    triggerAutosave(nextKit);
    if (flashcardIndex >= nextCards.length) {
      setFlashcardIndex(Math.max(0, nextCards.length - 1));
    }
  };

  // Add Custom Flashcard (marked "pinned")
  const handleAddFlashcardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kit || !newCardFront.trim() || !newCardBack.trim()) return;

    const newId = `f_custom_${Date.now()}`;
    const customCard: KitFlashcard = {
      id: newId,
      front: newCardFront.trim(),
      back: newCardBack.trim(),
      requirement_ids: kit.role.requirements[0]?.id ? [kit.role.requirements[0].id] : [],
      state: "pinned",
    };

    const nextCards = [...kit.flashcards, customCard];
    const nextKit = { ...kit, flashcards: nextCards };
    setKit(nextKit);
    triggerAutosave(nextKit);

    setNewCardFront("");
    setNewCardBack("");
    setIsAddingFlashcard(false);
  };

  // Save Company Brief Edit
  const saveBriefEdits = () => {
    if (!kit) return;
    const nextBrief = {
      ...kit.company_brief,
      summary: briefSummaryInput.trim(),
      what_they_do: briefWhatTheyDoInput.trim(),
      state: "edited" as const,
    };
    const nextKit = { ...kit, company_brief: nextBrief };
    setKit(nextKit);
    triggerAutosave(nextKit);
    setIsEditingBrief(false);
  };

  // Trigger Sectional Regeneration (Rule 9 safe)
  const handleRegenerateSection = async (
    target: "company_brief" | "schedule" | "category",
    category?: QuestionCategory
  ) => {
    if (!kit) return;
    const label = category ? `category_${category}` : target;
    setRegeneratingSection(label);

    try {
      const res = await fetch(`${API_URL}/kits/${id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target, category }),
      });

      if (res.ok) {
        const data = await res.json();
        setKit(data.kit);
        if (target === "company_brief") {
          setBriefSummaryInput(data.kit.company_brief?.summary || "");
          setBriefWhatTheyDoInput(data.kit.company_brief?.what_they_do || "");
        }
      } else {
        const err = await res.json();
        alert(`Regeneration failed: ${err.error?.message || "Unknown error"}`);
      }
    } catch (e: any) {
      alert(`Network error during regeneration: ${e.message}`);
    } finally {
      setRegeneratingSection(null);
    }
  };

  // Keyboard navigation for flashcard deck
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== "flashcards" || flashcardViewMode !== "deck" || !kit?.flashcards?.length) return;
      if (editingFlashcardId || isAddingFlashcard) return;
      if (e.key === "ArrowRight") nextCard();
      else if (e.key === "ArrowLeft") prevCard();
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setIsFlipped((f) => !f);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, flashcardViewMode, kit?.flashcards?.length, editingFlashcardId, isAddingFlashcard]);

  const toggleQuestionOutline = (qid: string) => {
    setExpandedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
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

  // Map of questions by ID
  const questionMap = useMemo(() => {
    const map = new Map<string, KitQuestion>();
    if (kit?.questions) {
      for (const q of kit.questions) {
        map.set(q.id, q);
      }
    }
    return map;
  }, [kit?.questions]);

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

  const renderDifficulty = (level: number) => {
    const bars = [1, 2, 3];
    return (
      <div className="flex items-center gap-1" title={`Difficulty: Level ${level}`}>
        {bars.map((b) => (
          <span
            key={b}
            className={`h-2 w-1 rounded-sm ${b <= level ? "bg-amber-400" : "bg-zinc-800"}`}
          />
        ))}
        <span className="ml-1 text-[10px] font-mono text-zinc-400">L{level}</span>
      </div>
    );
  };

  const renderStateBadge = (itemState?: "generated" | "edited" | "pinned") => {
    if (itemState === "pinned") {
      return (
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40"
          title="Pinned: Protected from regeneration"
        >
          📌 Pinned
        </span>
      );
    }
    if (itemState === "edited") {
      return (
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40"
          title="Edited: User modified, protected from regeneration"
        >
          ✎ Edited
        </span>
      );
    }
    return (
      <span
        className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700"
        title="Generated: Subject to category regeneration"
      >
        AI
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 bg-grid-architectural">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* GENERATING STAGE RADAR */}
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

        {/* COMPLETED BUILDER VIEW */}
        {status === "completed" && kit && (
          <div className="space-y-6">
            {/* Top Command Bar & Save Status */}
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

                  {/* Autosave feedback badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono">
                    {saveStatus === "saving" && (
                      <span className="text-amber-400 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                        Saving...
                      </span>
                    )}
                    {saveStatus === "saved" && (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <span>✓</span>
                        Saved
                      </span>
                    )}
                    {saveStatus === "error" && (
                      <span className="text-red-400 flex items-center gap-1">
                        <span>⚠️</span>
                        Save error
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5">
                <a
                  href={`/kits/${id}/practice`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-xs font-semibold text-amber-300 transition-all shadow-sm"
                  title="Launch Adaptive Flashcard Practice Mode"
                >
                  <span className="text-amber-400">⚡</span>
                  <span>Practice Mode</span>
                </a>

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

            {/* MASTER-DETAIL GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* LEFT RAIL (4 Cols): Company Brief, Telemetry, Role Requirements */}
              <aside className="lg:col-span-4 space-y-5">
                {/* Telemetry Box */}
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

                {/* Company Intelligence Card (With In-Place Edit & Regeneration) */}
                <div className="rounded-xl border border-zinc-800 bg-[#0f1117] p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                        Company Brief
                      </h3>
                      {renderStateBadge(kit.company_brief.state)}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditingBrief(!isEditingBrief)}
                        className="text-[11px] font-mono text-zinc-400 hover:text-amber-400 transition-colors"
                      >
                        {isEditingBrief ? "Cancel" : "✎ Edit"}
                      </button>

                      <button
                        disabled={regeneratingSection === "company_brief"}
                        onClick={() => handleRegenerateSection("company_brief")}
                        className="text-[11px] font-mono text-zinc-400 hover:text-amber-400 transition-colors disabled:opacity-40"
                        title="Regenerate brief (preserves edited content)"
                      >
                        {regeneratingSection === "company_brief" ? "..." : "↻ Refresh"}
                      </button>
                    </div>
                  </div>

                  {isEditingBrief ? (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="text-[11px] font-mono text-zinc-400 block mb-1">What They Do</label>
                        <textarea
                          rows={3}
                          value={briefWhatTheyDoInput}
                          onChange={(e) => setBriefWhatTheyDoInput(e.target.value)}
                          className="w-full text-xs rounded border border-zinc-700 bg-zinc-950 p-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-mono text-zinc-400 block mb-1">Mission & Context</label>
                        <textarea
                          rows={3}
                          value={briefSummaryInput}
                          onChange={(e) => setBriefSummaryInput(e.target.value)}
                          className="w-full text-xs rounded border border-zinc-700 bg-zinc-950 p-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={saveBriefEdits}
                          className="px-3 py-1 rounded bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400"
                        >
                          Save Brief
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>

                {/* Role Requirements Checklist */}
                <div className="rounded-xl border border-zinc-800 bg-[#0f1117] p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Requirements ({kit.role.requirements.length})
                    </h3>

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
              </aside>

              {/* RIGHT MAIN PANEL (8 Cols): Navigation Tabs & Active Builder Views */}
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                      <div>
                        <h2 className="text-base font-bold text-white">Adaptive Study Timeline</h2>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Partitioned study workload balancing foundational topics and spaced drills.
                        </p>
                      </div>

                      <button
                        disabled={regeneratingSection === "schedule"}
                        onClick={() => handleRegenerateSection("schedule")}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-amber-400 border border-zinc-700 flex items-center gap-1.5 transition-colors self-start sm:self-auto disabled:opacity-40"
                      >
                        <span>↻</span>
                        <span>{regeneratingSection === "schedule" ? "Re-allocating..." : "Regenerate Schedule"}</span>
                      </button>
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

                    {/* Selected Day Details */}
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
                                Target Duration: {currentDayData.minutes} minutes • {currentDayData.question_ids.length} core scenarios
                              </span>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {currentDayData.question_ids.length === 0 ? (
                              <div className="p-4 rounded-lg bg-zinc-950/40 text-xs text-zinc-500 text-center">
                                No questions assigned to this day. Add questions or click "Regenerate Schedule".
                              </div>
                            ) : (
                              currentDayData.question_ids.map((qid, idx) => {
                                const question = questionMap.get(qid);
                                if (!question) return null;

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
                                          {renderStateBadge(question.state)}
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
                              })
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* TAB 2: QUESTION BANK BUILDER (EDIT, REORDER, ADD, REGENERATE) */}
                {activeTab === "questions" && (
                  <div className="rounded-xl border border-zinc-800 bg-[#0f1117] p-6 shadow-sm space-y-5">
                    {/* Header with Category Filter & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                      <div>
                        <h2 className="text-base font-bold text-white">
                          Question Bank Builder ({filteredQuestions.length})
                        </h2>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Edit prompts in-place, reorder items, move categories, and author custom questions.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Sectional regeneration action for current category */}
                        {questionCategoryFilter !== "all" && (
                          <button
                            disabled={regeneratingSection === `category_${questionCategoryFilter}`}
                            onClick={() => handleRegenerateSection("category", questionCategoryFilter)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-amber-400 border border-zinc-700 flex items-center gap-1.5 transition-colors disabled:opacity-40"
                            title="Regenerates AI questions in this category while strictly preserving edited & pinned items"
                          >
                            <span>↻</span>
                            <span>
                              {regeneratingSection === `category_${questionCategoryFilter}`
                                ? "Regenerating..."
                                : `Regenerate ${questionCategoryFilter.replace("-", " ")}`}
                            </span>
                          </button>
                        )}

                        <button
                          onClick={() => setIsAddingQuestion(!isAddingQuestion)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-semibold text-zinc-950 transition-colors shadow-sm"
                        >
                          {isAddingQuestion ? "Cancel" : "+ Add Question"}
                        </button>
                      </div>
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

                    {/* Add Question Card Form */}
                    {isAddingQuestion && (
                      <form
                        onSubmit={handleAddQuestionSubmit}
                        className="rounded-xl border border-amber-500/40 bg-zinc-950 p-5 space-y-4 shadow-md"
                      >
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                            Author Custom Question (Pinned by default)
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400">
                            State: pinned (protected)
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-mono text-zinc-400 block mb-1">Category</label>
                            <select
                              value={newQuestionCategory}
                              onChange={(e) => setNewQuestionCategory(e.target.value as QuestionCategory)}
                              className="w-full text-xs rounded border border-zinc-700 bg-zinc-900 p-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                            >
                              <option value="technical">Technical</option>
                              <option value="behavioural">Behavioural</option>
                              <option value="system-design">System Design</option>
                              <option value="company-fit">Company Fit</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-mono text-zinc-400 block mb-1">Difficulty</label>
                            <select
                              value={newQuestionDifficulty}
                              onChange={(e) => setNewQuestionDifficulty(Number(e.target.value) as DifficultyLevel)}
                              className="w-full text-xs rounded border border-zinc-700 bg-zinc-900 p-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                            >
                              <option value={1}>Level 1 (Foundational)</option>
                              <option value={2}>Level 2 (Intermediate)</option>
                              <option value={3}>Level 3 (Advanced / Principal)</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-mono text-zinc-400 block mb-1">Question Prompt</label>
                          <textarea
                            rows={2}
                            required
                            value={newQuestionPrompt}
                            onChange={(e) => setNewQuestionPrompt(e.target.value)}
                            placeholder="Enter the scenario or interview question..."
                            className="w-full text-xs rounded border border-zinc-700 bg-zinc-900 p-2 text-zinc-100 focus:outline-none focus:border-amber-500 font-sans"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-mono text-zinc-400 block mb-1">Strategic Answer Outline</label>
                          <textarea
                            rows={3}
                            value={newQuestionAnswer}
                            onChange={(e) => setNewQuestionAnswer(e.target.value)}
                            placeholder="Key concepts, STAR framework, trade-offs to mention..."
                            className="w-full text-xs rounded border border-zinc-700 bg-zinc-900 p-2 text-zinc-100 focus:outline-none focus:border-amber-500 font-sans"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsAddingQuestion(false)}
                            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 rounded bg-amber-500 text-zinc-950 font-semibold text-xs hover:bg-amber-400"
                          >
                            Save Pinned Question
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Question Cards List */}
                    <div className="space-y-4">
                      {filteredQuestions.map((q) => {
                        const isExpanded = expandedQuestionIds.has(q.id);
                        const isEditingThis = editingQuestionId === q.id;

                        return (
                          <div
                            key={q.id}
                            className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 transition-all hover:border-zinc-700/80 space-y-3"
                          >
                            {/* Card Header Toolbar */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-amber-400">{q.id}</span>
                                {renderStateBadge(q.state)}

                                {/* Category Changer Dropdown */}
                                <select
                                  value={q.category}
                                  onChange={(e) =>
                                    updateQuestion(q.id, { category: e.target.value as QuestionCategory })
                                  }
                                  className="text-[10px] font-mono capitalize rounded bg-zinc-900 border border-zinc-800 text-zinc-300 px-1.5 py-0.5 focus:outline-none"
                                >
                                  <option value="technical">Technical</option>
                                  <option value="behavioural">Behavioural</option>
                                  <option value="system-design">System Design</option>
                                  <option value="company-fit">Company Fit</option>
                                </select>

                                {/* Difficulty changer */}
                                <select
                                  value={q.difficulty}
                                  onChange={(e) =>
                                    updateQuestion(q.id, { difficulty: Number(e.target.value) as DifficultyLevel })
                                  }
                                  className="text-[10px] font-mono rounded bg-zinc-900 border border-zinc-800 text-zinc-300 px-1.5 py-0.5 focus:outline-none"
                                >
                                  <option value={1}>L1</option>
                                  <option value={2}>L2</option>
                                  <option value={3}>L3</option>
                                </select>
                              </div>

                              {/* Reorder and State Action Controls */}
                              <div className="flex items-center gap-1.5">
                                {/* Up / Down Reorder */}
                                <button
                                  onClick={() => moveQuestion(q.id, "up")}
                                  className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 text-[10px]"
                                  title="Move Up"
                                >
                                  ▲
                                </button>
                                <button
                                  onClick={() => moveQuestion(q.id, "down")}
                                  className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 text-[10px]"
                                  title="Move Down"
                                >
                                  ▼
                                </button>

                                {/* Pin toggle */}
                                <button
                                  onClick={() => toggleQuestionPin(q.id)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                                    q.state === "pinned"
                                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold"
                                      : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                                  }`}
                                  title="Pin to protect from regeneration"
                                >
                                  {q.state === "pinned" ? "📌 Pinned" : "Pin"}
                                </button>

                                {/* Inline Edit toggle */}
                                <button
                                  onClick={() =>
                                    setEditingQuestionId(isEditingThis ? null : q.id)
                                  }
                                  className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[10px] font-mono"
                                >
                                  {isEditingThis ? "Done" : "✎ Edit"}
                                </button>

                                {/* Delete */}
                                <button
                                  onClick={() => deleteQuestion(q.id)}
                                  className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                  title="Delete Question"
                                >
                                  🗑
                                </button>
                              </div>
                            </div>

                            {/* In-place Editable Body vs Static View */}
                            {isEditingThis ? (
                              <div className="space-y-3 pt-1">
                                <div>
                                  <label className="text-[10px] font-mono text-zinc-400 uppercase block mb-1">
                                    Question Prompt
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={q.prompt}
                                    onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })}
                                    className="w-full text-xs rounded border border-zinc-700 bg-zinc-900 p-2 text-zinc-100 focus:outline-none focus:border-amber-500 font-sans"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-mono text-zinc-400 uppercase block mb-1">
                                    Strategic Answer Outline
                                  </label>
                                  <textarea
                                    rows={3}
                                    value={q.answer_outline}
                                    onChange={(e) => updateQuestion(q.id, { answer_outline: e.target.value })}
                                    className="w-full text-xs rounded border border-zinc-700 bg-zinc-900 p-2 text-zinc-100 focus:outline-none focus:border-amber-500 font-sans"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div>
                                <h3 className="text-sm font-semibold text-zinc-100 leading-snug">
                                  {q.prompt}
                                </h3>

                                <div className="mt-3 flex items-center justify-between">
                                  <div className="flex gap-1">
                                    {q.requirement_ids.map((rid) => (
                                      <span
                                        key={rid}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800"
                                      >
                                        req:{rid}
                                      </span>
                                    ))}
                                  </div>

                                  <button
                                    onClick={() => toggleQuestionOutline(q.id)}
                                    className="text-xs text-zinc-400 hover:text-amber-400 transition-colors font-mono"
                                  >
                                    {isExpanded ? "Hide Answer ▲" : "View Answer ▼"}
                                  </button>
                                </div>

                                {isExpanded && (
                                  <div className="mt-3 pt-3 border-t border-zinc-900 text-xs text-zinc-300 space-y-1.5 bg-zinc-900/40 -mx-4 -mb-4 p-4 rounded-b-xl">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono block">
                                      Strategic Answer Outline:
                                    </span>
                                    <p className="leading-relaxed whitespace-pre-line text-zinc-300 font-sans">
                                      {q.answer_outline}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 3: FLASHCARDS BUILDER */}
                {activeTab === "flashcards" && (
                  <div className="rounded-xl border border-zinc-800 bg-[#0f1117] p-6 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
                      <div>
                        <h2 className="text-base font-bold text-white">
                          Flashcard Builder ({kit.flashcards.length})
                        </h2>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Edit cards in place, add custom drilling cards, or review via interactive deck.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={`/kits/${id}/practice`}
                          className="px-3 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold hover:bg-amber-500/30 transition-colors flex items-center gap-1.5 shadow-sm"
                          title="Start SM-2 Adaptive Practice Session"
                        >
                          <span>⚡</span>
                          <span>Start Practice Mode</span>
                        </a>
                        <button
                          onClick={() => setFlashcardViewMode("deck")}
                          className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                            flashcardViewMode === "deck"
                              ? "bg-zinc-800 text-amber-400 font-bold"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          Deck
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
                        <button
                          onClick={() => setIsAddingFlashcard(!isAddingFlashcard)}
                          className="px-3 py-1 rounded bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400 transition-colors"
                        >
                          {isAddingFlashcard ? "Cancel" : "+ Add Card"}
                        </button>
                      </div>
                    </div>

                    {/* Add Custom Flashcard Form */}
                    {isAddingFlashcard && (
                      <form
                        onSubmit={handleAddFlashcardSubmit}
                        className="rounded-xl border border-amber-500/40 bg-zinc-950 p-4 space-y-3"
                      >
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                          Add Custom Flashcard (Pinned)
                        </span>
                        <div>
                          <label className="text-[10px] font-mono text-zinc-400 uppercase block mb-1">
                            Front (Prompt / Scenario)
                          </label>
                          <textarea
                            rows={2}
                            required
                            value={newCardFront}
                            onChange={(e) => setNewCardFront(e.target.value)}
                            className="w-full text-xs rounded border border-zinc-700 bg-zinc-900 p-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-mono text-zinc-400 uppercase block mb-1">
                            Back (Takeaway / Answer)
                          </label>
                          <textarea
                            rows={2}
                            required
                            value={newCardBack}
                            onChange={(e) => setNewCardBack(e.target.value)}
                            className="w-full text-xs rounded border border-zinc-700 bg-zinc-900 p-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsAddingFlashcard(false)}
                            className="px-3 py-1 text-xs text-zinc-400"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 rounded bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400"
                          >
                            Save Card
                          </button>
                        </div>
                      </form>
                    )}

                    {kit.flashcards.length === 0 ? (
                      <div className="py-12 text-center text-xs text-zinc-400">
                        No flashcards available. Add custom cards above.
                      </div>
                    ) : flashcardViewMode === "deck" ? (
                      /* DECK VIEW */
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                          <span>
                            Card {flashcardIndex + 1} of {kit.flashcards.length}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            Click card or press <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300">Space</kbd> to flip
                          </span>
                        </div>

                        <div
                          onClick={() => setIsFlipped(!isFlipped)}
                          className={`cursor-pointer min-h-[220px] sm:min-h-[260px] rounded-2xl border p-8 flex flex-col justify-between transition-all duration-300 transform select-none ${
                            isFlipped
                              ? "bg-amber-500/5 border-amber-500/40 text-amber-200 shadow-md"
                              : "bg-zinc-950 border-zinc-800 text-zinc-100 hover:border-zinc-700 shadow-sm"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                                {kit.flashcards[flashcardIndex].id}
                              </span>
                              {renderStateBadge(kit.flashcards[flashcardIndex].state)}
                            </div>
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

                        {/* Controls */}
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
                      /* GRID VIEW WITH INLINE EDIT & DELETE */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {kit.flashcards.map((card) => {
                          const isEditingCard = editingFlashcardId === card.id;

                          return (
                            <div
                              key={card.id}
                              className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 border-b border-zinc-900 pb-2">
                                <div className="flex items-center gap-2">
                                  <span>{card.id}</span>
                                  {renderStateBadge(card.state)}
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() =>
                                      setEditingFlashcardId(isEditingCard ? null : card.id)
                                    }
                                    className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 hover:text-white"
                                  >
                                    {isEditingCard ? "Cancel" : "✎ Edit"}
                                  </button>
                                  <button
                                    onClick={() => deleteFlashcard(card.id)}
                                    className="p-1 text-zinc-500 hover:text-red-400"
                                  >
                                    🗑
                                  </button>
                                </div>
                              </div>

                              {isEditingCard ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    defaultValue={card.front}
                                    id={`front_${card.id}`}
                                    className="w-full text-xs rounded border border-zinc-700 bg-zinc-900 p-1.5 text-zinc-100"
                                  />
                                  <textarea
                                    rows={2}
                                    defaultValue={card.back}
                                    id={`back_${card.id}`}
                                    className="w-full text-xs rounded border border-zinc-700 bg-zinc-900 p-1.5 text-zinc-100"
                                  />
                                  <div className="flex justify-end">
                                    <button
                                      onClick={() => {
                                        const f = (document.getElementById(`front_${card.id}`) as HTMLInputElement)?.value;
                                        const b = (document.getElementById(`back_${card.id}`) as HTMLTextAreaElement)?.value;
                                        if (f && b) updateFlashcard(card.id, f, b);
                                      }}
                                      className="px-3 py-1 rounded bg-amber-500 text-zinc-950 text-xs font-semibold"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
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
                                </>
                              )}
                            </div>
                          );
                        })}
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
                        <span className="text-xs text-zinc-400 block">Uncovered Requirements</span>
                        <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                          {kit.coverage.uncovered_requirement_ids.length}
                        </span>
                      </div>
                    </div>

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
                                    Uncovered Gap
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
