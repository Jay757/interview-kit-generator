"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "../../../components/Navbar";
import { Toast, ToastProps } from "../../../components/ui/Toast";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../../context/ThemeContext";
import {
  KitStructure,
  KitQuestion,
  KitRequirement,
  KitFlashcard,
  QuestionCategory,
  DifficultyLevel,
} from "../../../types/kit";

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

const CATEGORY_META: Record<QuestionCategory, { label: string; badge: string; color: string }> = {
  technical: {
    label: "Technical Depth",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    color: "text-blue-500",
  },
  "system-design": {
    label: "System Design",
    badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    color: "text-indigo-500",
  },
  behavioural: {
    label: "Behavioral & STAR",
    badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    color: "text-purple-500",
  },
  "company-fit": {
    label: "Company Fit & Culture",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    color: "text-emerald-500",
  },
};

export default function KitBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();
  const { theme } = useTheme();

  const [kit, setKit] = useState<KitStructure | null>(null);
  const [status, setStatus] = useState<"generating" | "completed" | "failed" | "loading">("loading");
  const [stage, setStage] = useState<string>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [toastNotification, setToastNotification] = useState<ToastProps | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveIntelligence, setLiveIntelligence] = useState<{
    source?: KitStructure["source"];
    role?: KitStructure["role"];
    company_brief?: KitStructure["company_brief"];
  } | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<"schedule" | "questions" | "flashcards" | "coverage">("schedule");
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [questionCategoryFilter, setQuestionCategoryFilter] = useState<QuestionCategory | "all">("all");
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Set<string>>(new Set());
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingFlashcardId, setEditingFlashcardId] = useState<string | null>(null);
  const [isEditingBrief, setIsEditingBrief] = useState(false);
  const [briefSummaryInput, setBriefSummaryInput] = useState("");
  const [briefWhatTheyDoInput, setBriefWhatTheyDoInput] = useState("");

  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQuestionCategory, setNewQuestionCategory] = useState<QuestionCategory>("technical");
  const [newQuestionPrompt, setNewQuestionPrompt] = useState("");
  const [newQuestionAnswer, setNewQuestionAnswer] = useState("");
  const [newQuestionDifficulty, setNewQuestionDifficulty] = useState<DifficultyLevel>(2);

  const [isAddingFlashcard, setIsAddingFlashcard] = useState(false);
  const [newCardFront, setNewCardFront] = useState("");
  const [newCardBack, setNewCardBack] = useState("");

  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flashcardViewMode, setFlashcardViewMode] = useState<"deck" | "grid">("deck");
  const [reqFilter, setReqFilter] = useState<"all" | "must" | "nice">("all");

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === "generating" || status === "loading") {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (!id) return;
    let isSubscribed = true;
    let pollInterval: NodeJS.Timeout;
    let consecutiveErrors = 0;

    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/kits/${id}/status`, { credentials: "include" });
        if (!res.ok) {
          if (res.status === 404) {
            setStatus("failed");
            const msg = "Kit not found or has been deleted.";
            setErrorMessage(msg);
            setToastNotification({
              type: "error",
              badge: "Not Found",
              title: "Kit Missing",
              message: msg,
              action: { label: "Go to Dashboard", href: "/kits" },
              onClose: () => setToastNotification(null),
            });
            return;
          }
          if (res.status === 403) {
            setStatus("failed");
            const msg = "You do not have permission to view this kit.";
            setErrorMessage(msg);
            setToastNotification({
              type: "error",
              badge: "Access Denied",
              title: "Unauthorized",
              message: msg,
              action: { label: "Back to Dashboard", href: "/kits" },
              onClose: () => setToastNotification(null),
            });
            return;
          }
          consecutiveErrors++;
          if (consecutiveErrors >= 4) {
            setToastNotification({
              type: "warning",
              badge: "Network Notice",
              title: "Server Communication Issue",
              message: "Checking kit status is encountering network latency. Polling will continue automatically.",
              onClose: () => setToastNotification(null),
            });
          }
          return;
        }

        consecutiveErrors = 0;
        const data = await res.json();
        if (!isSubscribed) return;

        if (data.status === "completed") {
          const kitRes = await fetch(`${API_URL}/kits/${id}`, { credentials: "include" });
          if (kitRes.ok) {
            const kitData = await kitRes.json();
            const actualKit = kitData.kit || kitData;
            if (isSubscribed) {
              setKit(actualKit);
              setBriefSummaryInput(actualKit.company_brief?.summary || "");
              setBriefWhatTheyDoInput(actualKit.company_brief?.what_they_do || "");
              setStatus("completed");
              setStage("completed");
              setToastNotification(null);
            }
          }
        } else if (data.status === "failed") {
          const rawMsg = data.errorMessage || data.error?.message || "Synthesis failed.";
          const code = data.errorCode || data.error?.code || "GENERATION_FAILED";
          setStatus("failed");
          setErrorMessage(rawMsg);
          setErrorCode(code);

          const isQuota =
            code === "LLM_QUOTA_EXCEEDED" ||
            rawMsg.toLowerCase().includes("quota") ||
            rawMsg.toLowerCase().includes("credit") ||
            rawMsg.toLowerCase().includes("402") ||
            rawMsg.toLowerCase().includes("payment required");

          const isAuth =
            code === "LLM_AUTH_ERROR" ||
            code === "LLM_CONFIG_MISSING" ||
            rawMsg.toLowerCase().includes("api key") ||
            rawMsg.toLowerCase().includes("unauthorized");

          setToastNotification({
            type: "error",
            badge: isQuota ? "Quota Reached" : isAuth ? "Auth Error" : "Synthesis Failed",
            title: isQuota
              ? "AI API Quota Limit Reached"
              : isAuth
              ? "AI Key Configuration Error"
              : "Kit Synthesis Failed",
            message: isQuota
              ? "Your OpenRouter account credit balance is exhausted or daily quota was reached. Please top up your OpenRouter credits to continue."
              : rawMsg,
            action: {
              label: "New Kit",
              href: "/kits/new",
            },
            secondaryAction: {
              label: "Dashboard",
              href: "/kits",
            },
            onClose: () => setToastNotification(null),
          });
        } else {
          setStatus("generating");
          if (data.stage) setStage(data.stage);
          if (data.source || data.role || data.company_brief) {
            setLiveIntelligence((prev) => ({
              source: data.source || prev?.source,
              role: data.role || prev?.role,
              company_brief: data.company_brief || prev?.company_brief,
            }));
          }
        }
      } catch (err: any) {
        console.error("Status polling error:", err);
      }
    };

    checkStatus();

    pollInterval = setInterval(() => {
      if (status !== "completed" && status !== "failed") {
        checkStatus();
      }
    }, 2500);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [id, status]);

  // Stall alert if kit synthesis exceeds 2.5 minutes without completing
  useEffect(() => {
    if (elapsedSeconds === 150 && (status === "generating" || status === "loading")) {
      setToastNotification({
        type: "warning",
        badge: "Synthesis Alert",
        title: "Extended Generation Time",
        message: "Generation is taking longer than usual. The AI provider might be experiencing high load or rate throttling.",
        action: {
          label: "View Dashboard",
          href: "/kits",
        },
        onClose: () => setToastNotification(null),
      });
    }
  }, [elapsedSeconds, status]);

  const triggerAutosave = useCallback(
    (updatedKit: KitStructure) => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
      setSaveStatus("saving");

      autosaveTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`${API_URL}/kits/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(updatedKit),
          });

          if (res.ok) {
            setSaveStatus("saved");
          } else {
            setSaveStatus("error");
          }
        } catch (err) {
          console.error("Autosave error:", err);
          setSaveStatus("error");
        }
      }, 800);
    },
    [id]
  );

  const toggleQuestionPin = (qid: string) => {
    if (!kit) return;
    const nextQuestions = kit.questions.map((q) => {
      if (q.id === qid) {
        return {
          ...q,
          state: q.state === "pinned" ? ("generated" as const) : ("pinned" as const),
        };
      }
      return q;
    });
    const nextKit = { ...kit, questions: nextQuestions };
    setKit(nextKit);
    triggerAutosave(nextKit);
  };

  const updateQuestionPrompt = (qid: string, newPrompt: string, newOutline: string) => {
    if (!kit) return;
    const nextQuestions = kit.questions.map((q) => {
      if (q.id === qid) {
        return {
          ...q,
          prompt: newPrompt,
          answer_outline: newOutline,
          state: q.state === "pinned" ? ("pinned" as const) : ("edited" as const),
        };
      }
      return q;
    });
    const nextKit = { ...kit, questions: nextQuestions };
    setKit(nextKit);
    triggerAutosave(nextKit);
    setEditingQuestionId(null);
  };

  const deleteQuestion = (qid: string) => {
    if (!kit) return;
    if (!confirm("Delete this question? It will be removed from your daily schedule.")) return;
    const nextQuestions = kit.questions.filter((q) => q.id !== qid);
    const nextDays = kit.schedule.days.map((day) => ({
      ...day,
      question_ids: day.question_ids.filter((qidItem) => qidItem !== qid),
    }));
    const nextSchedule = { ...kit.schedule, days: nextDays };
    const nextKit = { ...kit, questions: nextQuestions, schedule: nextSchedule };
    setKit(nextKit);
    triggerAutosave(nextKit);
  };

  const handleAddQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kit || !newQuestionPrompt.trim()) return;

    const newId = `q_custom_${Date.now()}`;
    const customQ: KitQuestion = {
      id: newId,
      prompt: newQuestionPrompt.trim(),
      answer_outline: newQuestionAnswer.trim() || "Candidate answer outline.",
      category: newQuestionCategory,
      difficulty: newQuestionDifficulty,
      requirement_ids: kit.role.requirements[0]?.id ? [kit.role.requirements[0].id] : [],
      state: "pinned",
    };

    const nextQuestions = [...kit.questions, customQ];
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
    setNewQuestionPrompt("");
    setNewQuestionAnswer("");
    setIsAddingQuestion(false);
  };

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

  const deleteFlashcard = (fid: string) => {
    if (!kit) return;
    const nextCards = kit.flashcards.filter((c) => c.id !== fid);
    const nextKit = { ...kit, flashcards: nextCards };
    setKit(nextKit);
    triggerAutosave(nextKit);
  };

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

  const handleRegenerateSection = async (
    target: "company_brief" | "schedule" | "category" | "flashcards",
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
        const err = await res.json().catch(() => ({}));
        alert(`Regeneration failed: ${err.error?.message || "Unknown error"}`);
      }
    } catch (e: any) {
      alert(`Network error during regeneration: ${e.message}`);
    } finally {
      setRegeneratingSection(null);
    }
  };

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

  const filteredRequirements = useMemo(() => {
    if (!kit?.role?.requirements) return [];
    if (reqFilter === "all") return kit.role.requirements;
    return kit.role.requirements.filter((r) => r.priority === reqFilter);
  }, [kit?.role?.requirements, reqFilter]);

  const filteredQuestions = useMemo(() => {
    if (!kit?.questions) return [];
    if (questionCategoryFilter === "all") return kit.questions;
    return kit.questions.filter((q) => q.category === questionCategoryFilter);
  }, [kit?.questions, questionCategoryFilter]);

  const questionMap = useMemo(() => {
    const map = new Map<string, KitQuestion>();
    if (kit?.questions) {
      for (const q of kit.questions) {
        map.set(q.id, q);
      }
    }
    return map;
  }, [kit?.questions]);

  const downloadKitJson = () => {
    if (!kit) return;
    const blob = new Blob([JSON.stringify(kit, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(kit?.source?.company || "interview").toLowerCase()}-prep-kit.json`;
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
            className={`h-2.5 w-2 rounded-sm ${
              b <= level ? "bg-amber-500 dark:bg-amber-400" : "bg-slate-200 dark:bg-zinc-700"
            }`}
          />
        ))}
      </div>
    );
  };

  const renderStateBadge = (itemState?: "generated" | "edited" | "pinned") => {
    if (itemState === "pinned") {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          PINNED
        </span>
      );
    }
    if (itemState === "edited") {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          EDITED
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-white/[0.08]">
        AI
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#08090d] text-slate-900 dark:text-zinc-100 font-sans selection:bg-blue-500 selection:text-white pb-32 transition-colors duration-200">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* SYNTHESIZING STATE (Live 2-Column Synthesis & Intelligence Dossier) */}
        {(status === "generating" || (status === "loading" && !kit)) && (() => {
          const stageIndex = STAGES.findIndex((item) => item.id === stage);
          const activeIndex = stageIndex >= 0 ? stageIndex : 0;
          const progressPercent = Math.min(100, Math.round(((activeIndex + 1) / STAGES.length) * 100));
          const isStep1Done = activeIndex > 0 || stage === "completed";
          const isStep2Done = activeIndex > 1 || stage === "completed";

          const displayCompany =
            liveIntelligence?.source?.company ||
            "Target Company";
          const displayRole =
            liveIntelligence?.role?.title ||
            liveIntelligence?.source?.role ||
            "Target Role";
          const displaySeniority =
            liveIntelligence?.role?.seniority || "Senior";
          const displayLocation =
            liveIntelligence?.source?.location || "Remote / Global";
          const pagesUsed = liveIntelligence?.source?.pages_used || [];
          const whatTheyDo = liveIntelligence?.company_brief?.what_they_do || "";
          const summary = liveIntelligence?.company_brief?.summary || "";

          return (
            <div className="w-full py-6 lg:py-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* LEFT COLUMN: LIVE PIPELINE TRACKER */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="p-6 sm:p-8 rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-xl">
                    <div className="flex items-center justify-between pb-5 mb-6 border-b border-slate-200/80 dark:border-white/[0.08]">
                      <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-2 border border-blue-500/20">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                          Phase {activeIndex + 1} of {STAGES.length}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                          Synthesizing Kit
                        </h2>
                      </div>
                      <div className="text-xl font-mono text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10 px-3 py-1.5 rounded-xl border border-blue-500/20">
                        {String(elapsedSeconds).padStart(2, "0")}s
                      </div>
                    </div>

                    {/* OVERALL PROGRESS BAR */}
                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-zinc-400">
                        <span>Pipeline Progress</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500 rounded-full"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* 7 STAGES STEP LIST */}
                    <div className="space-y-2.5">
                      {STAGES.map((s, idx) => {
                        const isCurrent = s.id === stage;
                        const isDone = activeIndex > idx || stage === "completed";

                        return (
                          <div
                            key={s.id}
                            className={`flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all ${
                              isCurrent
                                ? "border-blue-500/40 bg-blue-500/10 text-slate-900 dark:text-white shadow-sm"
                                : isDone
                                ? "border-emerald-500/20 bg-emerald-500/[0.04] text-slate-700 dark:text-zinc-300"
                                : "border-slate-200/60 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.02] text-slate-400 dark:text-zinc-500"
                            }`}
                          >
                            <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold font-mono">
                              {isDone ? (
                                <span className="text-emerald-500 font-bold text-sm">✓</span>
                              ) : isCurrent ? (
                                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                              ) : (
                                idx + 1
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold tracking-tight truncate">
                                  {s.label}
                                </span>
                                {isCurrent && (
                                  <span className="text-[10px] font-mono font-medium text-blue-500 animate-pulse ml-2">
                                    Processing...
                                  </span>
                                )}
                                {isDone && (
                                  <span className="text-[10px] font-mono font-medium text-emerald-500 ml-2">
                                    Done
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                                {s.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: LIVE GROUNDED INTELLIGENCE DOSSIER */}
                <div className="lg:col-span-7 space-y-6">
                  {/* HERO TARGET HEADER CARD */}
                  <div className="p-6 sm:p-8 rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-5 mb-5 border-b border-slate-200/80 dark:border-white/[0.08]">
                      <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08]">
                          {displayLocation}
                        </span>
                        <span>•</span>
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08]">
                          {displaySeniority}
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        Live Intelligence Dossier
                      </div>
                    </div>

                    <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
                      {displayCompany}
                    </h1>
                    <h2 className="text-base sm:text-xl font-medium text-blue-600 dark:text-blue-400">
                      {displayRole}
                    </h2>

                    {/* STEP 1 INTELLIGENCE: GROUNDED CRAWL SOURCES */}
                    <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-white/[0.08]">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          Step 1: Web Intelligence &amp; Role Context
                        </h3>
                        {isStep1Done ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                            <span>✓</span> Crawl Complete
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20 animate-pulse">
                            <span>📡</span> Actively Crawling...
                          </span>
                        )}
                      </div>

                      {isStep1Done ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                            {liveIntelligence?.source?.company_url ? (
                              <a
                                href={liveIntelligence.source.company_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex flex-col gap-0.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06] hover:border-blue-500/30 transition-colors"
                              >
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Company Site</span>
                                <span className="text-xs font-mono text-blue-600 dark:text-blue-400 truncate">
                                  {liveIntelligence.source.company_url.replace(/^https?:\/\//, "").split("/")[0]}
                                </span>
                              </a>
                            ) : null}
                            <div className="flex flex-col gap-0.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Seniority</span>
                              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{displaySeniority}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Location</span>
                              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{displayLocation}</span>
                            </div>
                            {liveIntelligence?.source?.jd_chars ? (
                              <div className="flex flex-col gap-0.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">JD Size</span>
                                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                                  {liveIntelligence.source.jd_chars.toLocaleString()} chars
                                </span>
                              </div>
                            ) : null}
                            <div className="flex flex-col gap-0.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Pages Crawled</span>
                              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                                {pagesUsed.length > 0 ? `${pagesUsed.length} pages` : "JD-only mode"}
                              </span>
                            </div>
                          </div>

                          {pagesUsed.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Crawled Sources</span>
                              <div className="flex flex-wrap gap-1.5">
                                {pagesUsed.map((url, uidx) => (
                                  <a
                                    key={uidx}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-600 dark:text-zinc-300 text-[11px] font-mono border border-slate-200 dark:border-white/[0.06] transition-colors"
                                  >
                                    <span>🔗</span>
                                    <span className="truncate max-w-[180px]">{url.replace(/^https?:\/\//, "").split("/")[0]}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <div className="flex flex-col gap-0.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Company</span>
                              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{displayCompany}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Role</span>
                              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{displayRole}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Seniority</span>
                              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{displaySeniority}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Location</span>
                              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{displayLocation}</span>
                            </div>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-blue-500/[0.04] border border-blue-500/20 flex items-center gap-2.5">
                            <span className="inline-block w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin flex-shrink-0" />
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                              Discovering sitemaps, engineering blogs &amp; culture pages...
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* STEP 2 INTELLIGENCE: COMPANY DOSSIER & OPERATIONAL CONTEXT */}
                    <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-white/[0.08] space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          Step 2: Company Intelligence Brief
                        </h3>
                        {isStep2Done ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                            <span>✓</span> Extracted
                          </span>
                        ) : isStep1Done ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20 animate-pulse">
                            <span>⚡</span> Extracting Brief...
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                            Waiting for Step 1
                          </span>
                        )}
                      </div>

                      {whatTheyDo || summary ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {whatTheyDo && (
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06] space-y-1.5">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                What They Do
                              </div>
                              <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                                {whatTheyDo}
                              </p>
                            </div>
                          )}
                          {summary && (
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06] space-y-1.5">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                Mission & Context
                              </div>
                              <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                                {summary}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/[0.06] space-y-2">
                          <p className="text-xs text-slate-500 dark:text-zinc-400">
                            {isStep1Done
                              ? "Distilling company operations, engineering stack, and core value proposition..."
                              : "Company brief will generate dynamically as soon as web crawling concludes."}
                          </p>
                          <div className="space-y-1.5">
                            <div className="h-2 w-full bg-slate-200/60 dark:bg-white/[0.04] rounded animate-pulse" />
                            <div className="h-2 w-4/5 bg-slate-200/60 dark:bg-white/[0.04] rounded animate-pulse" />
                          </div>
                        </div>
                      )}
                    </div>


                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* FAILED STATE */}
        {status === "failed" && (() => {
          const isQuota =
            errorCode === "LLM_QUOTA_EXCEEDED" ||
            errorMessage?.toLowerCase().includes("quota") ||
            errorMessage?.toLowerCase().includes("credit") ||
            errorMessage?.toLowerCase().includes("402") ||
            errorMessage?.toLowerCase().includes("payment required");

          const isAuth =
            errorCode === "LLM_AUTH_ERROR" ||
            errorCode === "LLM_CONFIG_MISSING" ||
            errorMessage?.toLowerCase().includes("api key") ||
            errorMessage?.toLowerCase().includes("unauthorized");

          return (
            <div className="w-full py-20 flex justify-center px-4">
              <div className="max-w-2xl w-full p-8 sm:p-12 rounded-3xl bg-white/90 dark:bg-[#0e1324]/90 backdrop-blur-xl border border-rose-500/20 shadow-2xl text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 text-2xl mb-4">
                  {isQuota ? "💳" : "⚠️"}
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  {isQuota
                    ? "AI API Quota / Credit Limit Reached"
                    : isAuth
                    ? "AI Key Configuration Error"
                    : "Synthesis Failed"}
                </h2>

                {isQuota ? (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-left my-5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                      <span>⚡</span> Action Required: OpenRouter Balance Depleted
                    </div>
                    <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed mb-2">
                      The AI model provider reported that available credits are exhausted or your account hit its quota limit. Kit generation cannot finish without available tokens.
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 break-words bg-white/40 dark:bg-black/20 p-2 rounded-xl">
                      {errorMessage}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-zinc-300 mb-8 max-w-md mx-auto">
                    {errorMessage || "An unexpected error occurred during kit synthesis."}
                  </p>
                )}

                <div className="flex flex-wrap justify-center gap-4 mt-2">
                  <Link
                    href="/kits/new"
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md transition-all"
                  >
                    Try Another Role
                  </Link>
                  <Link
                    href="/kits"
                    className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 font-semibold text-sm border border-slate-200 dark:border-white/[0.08]"
                  >
                    Back to Dashboard
                  </Link>
                </div>
              </div>
            </div>
          );
        })()}

        {/* COMPLETED KIT VIEW */}
        {status === "completed" && kit && (
          <div className="space-y-8">
            {/* HERO CARD / EDITORIAL BRIEF */}
            <div className="p-6 sm:p-10 rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-200/80 dark:border-white/[0.08]">
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08]">
                    {kit?.source?.location || "REMOTE / GLOBAL"}
                  </span>
                  <span>•</span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08]">
                    {kit?.role?.seniority || "SENIOR"}
                  </span>
                </div>

                {/* AUTOSAVE BADGE & QUICK ACTIONS */}
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-mono font-medium px-3 py-1 rounded-full border ${
                      saveStatus === "saving"
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse"
                        : saveStatus === "error"
                        ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    }`}
                  >
                    {saveStatus === "saving" && "Saving changes..."}
                    {saveStatus === "saved" && "Synced & Saved"}
                    {saveStatus === "error" && "Sync Error"}
                  </span>

                  {/* PRACTICE BUTTON */}
                  <Link
                    href={`/kits/${id}/practice`}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition-all active:scale-[0.98]"
                  >
                    <span>🧠</span>
                    <span>Practice Mode</span>
                  </Link>

                  {/* EXPORT JSON */}
                  <button
                    onClick={downloadKitJson}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-700 dark:text-zinc-200 font-medium text-sm border border-slate-200 dark:border-white/[0.08] transition-all"
                  >
                    Export JSON
                  </button>
                </div>
              </div>

              {/* COMPANY & ROLE HEADER */}
              <div className="mb-8">
                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
                  {kit?.source?.company || "Target Company"}
                </h1>
                <h2 className="text-lg sm:text-2xl font-medium text-blue-600 dark:text-blue-400">
                  {kit?.role?.title || "Interview Prep Kit"}
                </h2>
              </div>

              {/* WHAT THEY DO & MISSION (Inline Editable) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6 border-t border-slate-200/80 dark:border-white/[0.08]">
                {/* WHAT THEY DO */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      What They Do
                    </h3>
                    <button
                      onClick={() => setIsEditingBrief(!isEditingBrief)}
                      className="text-xs text-blue-500 hover:underline font-medium"
                    >
                      {isEditingBrief ? "Cancel" : "Edit Brief"}
                    </button>
                  </div>

                  {isEditingBrief ? (
                    <textarea
                      rows={4}
                      value={briefWhatTheyDoInput}
                      onChange={(e) => setBriefWhatTheyDoInput(e.target.value)}
                      className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/[0.1] text-slate-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  ) : (
                    <p className="text-sm sm:text-base leading-relaxed text-slate-700 dark:text-zinc-300">
                      {kit?.company_brief?.what_they_do || "No public details found."}
                    </p>
                  )}
                </div>

                {/* MISSION & CONTEXT */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Mission & Operational Context
                  </h3>

                  {isEditingBrief ? (
                    <div className="space-y-3">
                      <textarea
                        rows={4}
                        value={briefSummaryInput}
                        onChange={(e) => setBriefSummaryInput(e.target.value)}
                        className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/[0.1] text-slate-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                      <button
                        onClick={saveBriefEdits}
                        className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm"
                      >
                        Save Intelligence
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm sm:text-base leading-relaxed text-slate-700 dark:text-zinc-300">
                      {kit?.company_brief?.summary || "No public summary found."}
                    </p>
                  )}
                </div>
              </div>

              {/* VERIFIED CRAWL SOURCES */}
              {(kit?.source?.pages_used?.length ?? 0) > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-white/[0.08]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-3">
                    Verified Intelligence Sources
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {kit?.source?.pages_used?.map((url, uidx) => (
                      <a
                        key={uidx}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-zinc-300 text-xs font-mono border border-slate-200 dark:border-white/[0.06] transition-colors"
                      >
                        <span>🔗</span>
                        <span className="truncate max-w-xs">{url.replace(/^https?:\/\//, "").split("/")[0]}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* TAB BAR (Glassmorphic Segmented Control) */}
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab("schedule")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === "schedule"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>📅</span>
                <span>Schedule ({kit.schedule.days_available}d)</span>
              </button>

              <button
                onClick={() => setActiveTab("questions")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === "questions"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>📝</span>
                <span>Questions ({kit.questions.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("flashcards")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === "flashcards"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>⚡</span>
                <span>Flashcards ({kit.flashcards.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("coverage")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === "coverage"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>🎯</span>
                <span>Coverage Matrix</span>
              </button>
            </div>

            {/* TAB CONTENT: 1. SCHEDULE */}
            {activeTab === "schedule" && (
              <div className="space-y-6">
                {/* DAY SELECTOR ROW */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {kit.schedule.days.map((d) => (
                    <button
                      key={d.day}
                      onClick={() => setSelectedDay(d.day)}
                      className={`flex-1 min-w-[140px] p-4 rounded-2xl border text-left transition-all ${
                        selectedDay === d.day
                          ? "bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-300 shadow-sm"
                          : "bg-white/80 dark:bg-[#0e1324]/80 border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="text-[10px] font-mono uppercase font-bold tracking-wider opacity-60">
                        Day {d.day}
                      </div>
                      <div className="text-sm font-bold truncate mt-1">{d.focus}</div>
                      <div className="text-[11px] opacity-60 mt-1">{d.question_ids.length} Scenarios</div>
                    </button>
                  ))}
                </div>

                {/* CURRENT DAY PLAN CARD */}
                {(() => {
                  const currentDayData = kit.schedule.days.find((d) => d.day === selectedDay);
                  if (!currentDayData) return null;

                  return (
                    <div className="p-6 sm:p-8 rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-lg space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
                        <div>
                          <div className="text-xs font-mono uppercase font-bold text-blue-500 mb-1">
                            Day {currentDayData.day} Focus
                          </div>
                          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                            {currentDayData.focus}
                          </h3>
                        </div>

                        <Link
                          href={`/kits/${id}/practice`}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm"
                        >
                          Practice Today&apos;s Scenarios →
                        </Link>
                      </div>

                      {/* QUESTIONS FOR THIS DAY */}
                      <div className="space-y-4">
                        {currentDayData.question_ids.map((qid) => {
                          const question = questionMap.get(qid);
                          if (!question) return null;
                          const isExpanded = expandedQuestionIds.has(question.id);

                          return (
                            <div
                              key={question.id}
                              className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] transition-all hover:border-blue-500/30"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                                      CATEGORY_META[question.category]?.badge || "bg-slate-100"
                                    }`}
                                  >
                                    {CATEGORY_META[question.category]?.label || question.category}
                                  </span>
                                  {renderDifficulty(question.difficulty)}
                                  {renderStateBadge(question.state)}
                                </div>

                                <button
                                  onClick={() => toggleQuestionOutline(question.id)}
                                  className="text-xs font-medium text-blue-500 hover:underline"
                                >
                                  {isExpanded ? "Hide Answer Outline" : "View Answer Outline"}
                                </button>
                              </div>

                              <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-zinc-100 leading-relaxed">
                                {question.prompt}
                              </p>

                              {isExpanded && (
                                <div className="mt-4 p-4 rounded-xl bg-blue-500/[0.05] border border-blue-500/10 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-blue-500 mb-2">
                                    Strategic Answer Outline
                                  </div>
                                  {question.answer_outline}
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

            {/* TAB CONTENT: 2. QUESTIONS */}
            {activeTab === "questions" && (
              <div className="space-y-6">
                {/* TOOLBAR */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08]">
                  {/* CATEGORY FILTER PILLS */}
                  <div className="flex flex-wrap gap-1.5">
                    {["all", "technical", "system-design", "behavioural", "company-fit"].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setQuestionCategoryFilter(cat as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                          questionCategoryFilter === cat
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-600 dark:text-zinc-400"
                        }`}
                      >
                        {cat === "all" ? "All Categories" : cat.replace("-", " ")}
                      </button>
                    ))}
                  </div>

                  {/* ADD QUESTION & REGENERATE ACTIONS */}
                  <div className="flex items-center gap-3">
                    {questionCategoryFilter !== "all" && (
                      <button
                        onClick={() =>
                          handleRegenerateSection("category", questionCategoryFilter as QuestionCategory)
                        }
                        disabled={Boolean(regeneratingSection)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 text-xs font-semibold border border-slate-200 dark:border-white/[0.08] disabled:opacity-50"
                      >
                        {regeneratingSection === `category_${questionCategoryFilter}`
                          ? "Regenerating..."
                          : `Regenerate ${questionCategoryFilter}`}
                      </button>
                    )}

                    <button
                      onClick={() => setIsAddingQuestion(!isAddingQuestion)}
                      className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
                    >
                      {isAddingQuestion ? "Cancel" : "+ Add Custom Question"}
                    </button>
                  </div>
                </div>

                {/* ADD QUESTION INLINE FORM */}
                {isAddingQuestion && (
                  <form
                    onSubmit={handleAddQuestionSubmit}
                    className="p-6 rounded-3xl bg-white/90 dark:bg-[#0e1324]/90 backdrop-blur-xl border border-blue-500/30 shadow-xl space-y-4"
                  >
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Custom Scenario</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-zinc-400 block mb-1">
                          Category
                        </label>
                        <select
                          value={newQuestionCategory}
                          onChange={(e) => setNewQuestionCategory(e.target.value as QuestionCategory)}
                          className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/[0.1] text-xs font-medium text-slate-900 dark:text-zinc-100"
                        >
                          <option value="technical">Technical</option>
                          <option value="system-design">System Design</option>
                          <option value="behavioural">Behavioral</option>
                          <option value="company-fit">Company Fit</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-zinc-400 block mb-1">
                          Difficulty
                        </label>
                        <select
                          value={newQuestionDifficulty}
                          onChange={(e) => setNewQuestionDifficulty(Number(e.target.value) as DifficultyLevel)}
                          className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/[0.1] text-xs font-medium text-slate-900 dark:text-zinc-100"
                        >
                          <option value={1}>Level 1 - Core</option>
                          <option value={2}>Level 2 - Applied</option>
                          <option value={3}>Level 3 - Edge / Senior</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-500 dark:text-zinc-400 block mb-1">
                        Question Prompt
                      </label>
                      <textarea
                        rows={3}
                        value={newQuestionPrompt}
                        onChange={(e) => setNewQuestionPrompt(e.target.value)}
                        placeholder="Write the interview scenario question..."
                        className="w-full p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/[0.1] text-sm text-slate-900 dark:text-zinc-100"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-500 dark:text-zinc-400 block mb-1">
                        Strategic Answer Outline (Optional)
                      </label>
                      <textarea
                        rows={3}
                        value={newQuestionAnswer}
                        onChange={(e) => setNewQuestionAnswer(e.target.value)}
                        placeholder="Key points, frameworks, benchmarks..."
                        className="w-full p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/[0.1] text-sm text-slate-900 dark:text-zinc-100"
                      />
                    </div>

                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
                    >
                      Save Question (Pinned)
                    </button>
                  </form>
                )}

                {/* QUESTIONS LIST */}
                <div className="space-y-4">
                  {filteredQuestions.map((q) => {
                    const isExpanded = expandedQuestionIds.has(q.id);
                    const isEditing = editingQuestionId === q.id;

                    return (
                      <div
                        key={q.id}
                        className="p-6 rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/[0.08]">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                                CATEGORY_META[q.category]?.badge || "bg-slate-100"
                              }`}
                            >
                              {CATEGORY_META[q.category]?.label || q.category}
                            </span>
                            {renderDifficulty(q.difficulty)}
                            {renderStateBadge(q.state)}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleQuestionPin(q.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                q.state === "pinned"
                                  ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                                  : "bg-slate-100 dark:bg-white/[0.05] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-zinc-400"
                              }`}
                            >
                              {q.state === "pinned" ? "📌 Pinned" : "Pin"}
                            </button>

                            <button
                              onClick={() => setEditingQuestionId(isEditing ? null : q.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.08]"
                            >
                              {isEditing ? "Cancel" : "Edit"}
                            </button>

                            <button
                              onClick={() => deleteQuestion(q.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="space-y-3">
                            <textarea
                              defaultValue={q.prompt}
                              id={`edit_p_${q.id}`}
                              rows={3}
                              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/[0.1] text-sm text-slate-900 dark:text-zinc-100"
                            />
                            <textarea
                              defaultValue={q.answer_outline}
                              id={`edit_a_${q.id}`}
                              rows={3}
                              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/[0.1] text-sm text-slate-900 dark:text-zinc-100"
                            />
                            <button
                              onClick={() => {
                                const p = (document.getElementById(`edit_p_${q.id}`) as HTMLTextAreaElement).value;
                                const a = (document.getElementById(`edit_a_${q.id}`) as HTMLTextAreaElement).value;
                                updateQuestionPrompt(q.id, p, a);
                              }}
                              className="px-4 py-1.5 rounded-xl bg-blue-600 text-white font-medium text-xs shadow-sm"
                            >
                              Save Edits
                            </button>
                          </div>
                        ) : (
                          <div>
                            <p className="text-base font-semibold text-slate-900 dark:text-white leading-relaxed mb-3">
                              {q.prompt}
                            </p>

                            <button
                              onClick={() => toggleQuestionOutline(q.id)}
                              className="text-xs font-medium text-blue-500 hover:underline"
                            >
                              {isExpanded ? "Hide Answer Outline" : "View Strategic Answer Outline"}
                            </button>

                            {isExpanded && (
                              <div className="mt-3 p-4 rounded-2xl bg-blue-500/[0.04] border border-blue-500/10 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                                {q.answer_outline}
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

            {/* TAB CONTENT: 3. FLASHCARDS */}
            {activeTab === "flashcards" && (
              <div className="space-y-6">
                {/* ACTIONS TOOLBAR */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFlashcardViewMode("deck")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        flashcardViewMode === "deck"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      Interactive Flip Deck
                    </button>
                    <button
                      onClick={() => setFlashcardViewMode("grid")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        flashcardViewMode === "grid"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      All Cards Grid ({kit.flashcards.length})
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleRegenerateSection("flashcards")}
                      disabled={Boolean(regeneratingSection)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 text-xs font-semibold border border-slate-200 dark:border-white/[0.08] disabled:opacity-50"
                    >
                      {regeneratingSection === "flashcards" ? "Regenerating..." : "🔄 Regenerate Flashcards"}
                    </button>

                    <button
                      onClick={() => setIsAddingFlashcard(!isAddingFlashcard)}
                      className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
                    >
                      {isAddingFlashcard ? "Cancel" : "+ Add Flashcard"}
                    </button>
                  </div>
                </div>

                {/* ADD FLASHCARD INLINE FORM */}
                {isAddingFlashcard && (
                  <form
                    onSubmit={handleAddFlashcardSubmit}
                    className="p-6 rounded-3xl bg-white/90 dark:bg-[#0e1324]/90 backdrop-blur-xl border border-blue-500/30 shadow-xl space-y-4"
                  >
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">New Flashcard</h3>
                    <div>
                      <label className="text-xs font-medium text-slate-500 dark:text-zinc-400 block mb-1">
                        Front (Prompt / Term)
                      </label>
                      <textarea
                        rows={2}
                        value={newCardFront}
                        onChange={(e) => setNewCardFront(e.target.value)}
                        placeholder="e.g. What is the difference between durable execution and distributed sagas?"
                        className="w-full p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/[0.1] text-sm text-slate-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 dark:text-zinc-400 block mb-1">
                        Back (Key Retention Points)
                      </label>
                      <textarea
                        rows={3}
                        value={newCardBack}
                        onChange={(e) => setNewCardBack(e.target.value)}
                        placeholder="Bullet points, concrete definition, SLA numbers..."
                        className="w-full p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/[0.1] text-sm text-slate-900 dark:text-zinc-100"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
                    >
                      Save Card (Pinned)
                    </button>
                  </form>
                )}

                {/* DECK VIEW */}
                {flashcardViewMode === "deck" && kit.flashcards.length > 0 && (
                  <div className="max-w-3xl mx-auto space-y-6">
                    <div className="flex items-center justify-between px-2">
                      <span className="text-xs font-mono text-slate-400">
                        Card {flashcardIndex + 1} of {kit.flashcards.length}
                      </span>
                      <span className="text-xs text-slate-400">Press Space/Enter to flip, Left/Right to navigate</span>
                    </div>

                    {/* 3D FLIP CARD */}
                    {(() => {
                      const card = kit.flashcards[flashcardIndex];
                      if (!card) return null;

                      return (
                        <div
                          onClick={() => setIsFlipped(!isFlipped)}
                          className="cursor-pointer group relative min-h-[340px] rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] p-8 sm:p-12 flex flex-col justify-between shadow-xl transition-all duration-300 hover:shadow-2xl hover:border-blue-500/30 text-center"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              {isFlipped ? "Answer" : "Question / Term"}
                            </span>
                            <span className="text-xs text-slate-400 group-hover:text-blue-500 transition-colors">
                              {isFlipped ? "Click to view prompt ↺" : "Click to view answer ↻"}
                            </span>
                          </div>

                          <div className="my-auto py-6">
                            <p className="text-xl sm:text-2xl font-medium tracking-tight text-slate-900 dark:text-white leading-relaxed">
                              {isFlipped ? card.back : card.front}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/[0.05]">
                            {renderStateBadge(card.state)}
                            <span className="text-xs text-slate-400">Trao Spaced Repetition</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* PREV / NEXT BUTTONS */}
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={prevCard}
                        className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 font-medium text-xs border border-slate-200 dark:border-white/[0.08]"
                      >
                        ← Previous Card
                      </button>
                      <button
                        onClick={() => setIsFlipped(!isFlipped)}
                        className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm"
                      >
                        Flip Card (Space)
                      </button>
                      <button
                        onClick={nextCard}
                        className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 font-medium text-xs border border-slate-200 dark:border-white/[0.08]"
                      >
                        Next Card →
                      </button>
                    </div>
                  </div>
                )}

                {/* GRID VIEW */}
                {flashcardViewMode === "grid" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {kit.flashcards.map((c) => (
                      <div
                        key={c.id}
                        className="p-6 rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm space-y-4 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-mono text-slate-400 uppercase">{c.id}</span>
                            <div className="flex items-center gap-2">
                              {renderStateBadge(c.state)}
                              <button
                                onClick={() => deleteFlashcard(c.id)}
                                className="text-xs text-rose-500 hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="text-xs font-bold uppercase tracking-wider text-blue-500">Front</div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.front}</p>
                          </div>

                          <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-white/[0.05]">
                            <div className="text-xs font-bold uppercase tracking-wider text-indigo-500">Back</div>
                            <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                              {c.back}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: 4. COVERAGE */}
            {activeTab === "coverage" && (
              <div className="space-y-6">
                <div className="p-6 sm:p-8 rounded-3xl bg-white/80 dark:bg-[#0e1324]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200/80 dark:border-white/[0.08]">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Role Requirement Coverage
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
                        Ensuring grounded parity between job specifications and candidate interview scenarios.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {(["all", "must", "nice"] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setReqFilter(p)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                            reqFilter === p
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-zinc-400"
                          }`}
                        >
                          {p === "all" ? "All Priorities" : `${p}-Have`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* GAP ALERT */}
                  {kit.coverage?.uncovered_requirement_ids?.length > 0 && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs sm:text-sm flex items-center justify-between gap-4 mb-6">
                      <span>
                        ⚠️ <strong>{kit.coverage.uncovered_requirement_ids.length} Requirement Gaps Detected</strong>.
                        Generate custom questions to achieve 100% role coverage.
                      </span>
                      <button
                        onClick={() => setActiveTab("questions")}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 text-white font-semibold text-xs whitespace-nowrap"
                      >
                        Review Scenarios
                      </button>
                    </div>
                  )}

                  {/* REQUIREMENTS LIST */}
                  <div className="space-y-3">
                    {filteredRequirements.map((req) => {
                      const isUncovered = kit.coverage?.uncovered_requirement_ids?.includes(req.id);
                      const coveringQs = kit.questions.filter((q) => q.requirement_ids?.includes(req.id));

                      return (
                        <div
                          key={req.id}
                          className={`p-4 rounded-2xl border transition-all ${
                            isUncovered
                              ? "bg-amber-500/[0.04] border-amber-500/20"
                              : "bg-slate-50/70 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.06]"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  req.priority === "must"
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                }`}
                              >
                                {req.priority}-have
                              </span>
                              <span className="text-xs font-mono text-slate-400">{req.id}</span>
                            </div>

                            <span
                              className={`text-xs font-semibold ${
                                isUncovered ? "text-amber-500" : "text-emerald-500"
                              }`}
                            >
                              {isUncovered ? "Uncovered Gap" : `Covered (${coveringQs.length} Scenarios)`}
                            </span>
                          </div>

                          <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">{req.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {toastNotification && <Toast {...toastNotification} />}
      </main>
    </div>
  );
}
