import {
  KitSchedule,
  KitScheduleDay,
  Question,
  QuestionCategory,
  Requirement,
} from "../../types/kit.js";
import { ScheduleSchema } from "../../validation/kitValidator.js";

/**
 * Derives a human-readable focus string for a day based on the categories of its questions.
 */
function deriveDayFocus(dayQuestions: Question[], dayIndex: number, totalDays: number): string {
  if (dayQuestions.length === 0) {
    return "Consolidation & Core Concept Review";
  }

  const categoryCounts: Record<QuestionCategory, number> = {
    "system-design": 0,
    technical: 0,
    behavioural: 0,
    "company-fit": 0,
  };

  for (const q of dayQuestions) {
    categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;
  }

  if (categoryCounts["system-design"] > 0 && categoryCounts["system-design"] >= categoryCounts.technical) {
    return "Distributed Systems & Architectural Trade-offs";
  }
  if (categoryCounts.technical > 0) {
    return "Core Technical Implementation & Algorithms";
  }
  if (categoryCounts.behavioural > 0) {
    return "Behavioral Leadership, Ownership & STAR Scenarios";
  }
  if (categoryCounts["company-fit"] > 0) {
    return "Company Values & Engineering Culture Alignment";
  }

  return `Day ${dayIndex} Targeted Preparation`;
}

/**
 * Deterministically allocates questions across the requested number of days.
 * Pure arithmetic, 0% LLM.
 *
 * Rules:
 * 1. Harder/higher-priority (must-have) material goes earlier.
 * 2. Every must requirement's question appears in the schedule.
 * 3. Exact days entry count equals daysAvailable (handles days=1 and days=60 without empty days).
 * 4. All minutes are integers >= 15.
 */
export function allocateSchedule(
  requirements: Requirement[],
  questions: Question[],
  daysAvailable: number
): KitSchedule {
  const sanitizedDays = Math.max(1, Math.floor(daysAvailable));

  if (!questions || questions.length === 0) {
    // Edge case: no questions generated yet
    const emptyDays: KitScheduleDay[] = [];
    for (let d = 1; d <= sanitizedDays; d++) {
      emptyDays.push({
        day: d,
        focus: "General Role & Concept Review",
        question_ids: [],
        minutes: 30,
      });
    }
    return { days_available: sanitizedDays, days: emptyDays };
  }

  // 1. Build requirement priority map
  const reqPriorityMap = new Map<string, "must" | "nice">();
  for (const r of requirements) {
    reqPriorityMap.set(r.id, r.priority);
  }

  // 2. Score and sort questions deterministically:
  // - Priority: MUST questions before NICE questions
  // - Difficulty: Level 3 (hard) before Level 2 before Level 1
  // - Category: System-Design & Technical before Behavioural & Culture
  const scoredQuestions = [...questions].sort((a, b) => {
    // Determine priority weight
    const aMust = (a.requirement_ids || []).some((id) => reqPriorityMap.get(id) === "must");
    const bMust = (b.requirement_ids || []).some((id) => reqPriorityMap.get(id) === "must");
    if (aMust !== bMust) return aMust ? -1 : 1;

    // Determine difficulty weight (descending)
    if (a.difficulty !== b.difficulty) {
      return b.difficulty - a.difficulty;
    }

    // Category weighting
    const categoryRank: Record<QuestionCategory, number> = {
      "system-design": 4,
      technical: 3,
      behavioural: 2,
      "company-fit": 1,
    };
    const catDiff = (categoryRank[b.category] || 0) - (categoryRank[a.category] || 0);
    if (catDiff !== 0) return catDiff;

    // Stable tie-breaker by ID
    return a.id.localeCompare(b.id);
  });

  const days: KitScheduleDay[] = [];

  if (sanitizedDays === 1) {
    // Cram everything into Day 1
    const minutes = Math.max(45, Math.min(240, scoredQuestions.length * 15));
    days.push({
      day: 1,
      focus: "Intensive Comprehensive Preparation & Core Requirements",
      question_ids: scoredQuestions.map((q) => q.id),
      minutes,
    });
  } else if (sanitizedDays <= scoredQuestions.length) {
    // Standard case: partition sorted questions into sanitizedDays buckets
    const baseChunk = Math.floor(scoredQuestions.length / sanitizedDays);
    const remainder = scoredQuestions.length % sanitizedDays;

    let cursor = 0;
    for (let d = 1; d <= sanitizedDays; d++) {
      // Early days take the remainder questions so heavy work is completed early
      const chunkSize = baseChunk + (d <= remainder ? 1 : 0);
      const daySlice = scoredQuestions.slice(cursor, cursor + chunkSize);
      cursor += chunkSize;

      const minutes = Math.max(30, Math.min(180, daySlice.length * 20));
      const focus = deriveDayFocus(daySlice, d, sanitizedDays);

      days.push({
        day: d,
        focus,
        question_ids: daySlice.map((q) => q.id),
        minutes,
      });
    }
  } else {
    // Extended case (e.g. days_available = 60, days > questions):
    // Allocate original questions across initial days, then use spaced repetition
    // for remaining days so that NO DAY IS LEFT EMPTY.
    const initialDaysCount = Math.min(scoredQuestions.length, Math.ceil(sanitizedDays / 3));
    const baseChunk = Math.floor(scoredQuestions.length / initialDaysCount);
    const remainder = scoredQuestions.length % initialDaysCount;

    let cursor = 0;
    for (let d = 1; d <= initialDaysCount; d++) {
      const chunkSize = baseChunk + (d <= remainder ? 1 : 0);
      const daySlice = scoredQuestions.slice(cursor, cursor + chunkSize);
      cursor += chunkSize;

      const minutes = Math.max(30, daySlice.length * 20);
      const focus = deriveDayFocus(daySlice, d, sanitizedDays);

      days.push({
        day: d,
        focus,
        question_ids: daySlice.map((q) => q.id),
        minutes,
      });
    }

    // Days (initialDaysCount + 1) to sanitizedDays: Spaced Repetition Reinforcement
    for (let d = initialDaysCount + 1; d <= sanitizedDays; d++) {
      const cycleIndex = (d - initialDaysCount - 1) % scoredQuestions.length;
      const reviewQuestion = scoredQuestions[cycleIndex];

      days.push({
        day: d,
        focus: `Spaced Repetition: ${reviewQuestion.category.toUpperCase()} Recall Drill`,
        question_ids: [reviewQuestion.id],
        minutes: 20,
      });
    }
  }

  const schedule: KitSchedule = {
    days_available: sanitizedDays,
    days,
  };

  // Validate output against Appendix A Zod schema
  ScheduleSchema.parse(schedule);

  return schedule;
}
