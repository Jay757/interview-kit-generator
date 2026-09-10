import { describe, it, expect, vi } from "vitest";
import { Question, Requirement } from "../src/types/kit.js";
import {
  findUncoveredRequirements,
  runCoverageLoop,
} from "../src/pipeline/coverage/checkCoverage.js";
import { allocateSchedule } from "../src/pipeline/schedule/allocateSchedule.js";
import { ScheduleSchema } from "../src/validation/kitValidator.js";

describe("Phase 7: Deterministic Coverage Loop & Schedule Allocation", () => {
  const SAMPLE_REQS: Requirement[] = [
    {
      id: "r1",
      text: "5+ years Node.js & TypeScript",
      kind: "technical",
      priority: "must",
      state: "generated",
    },
    {
      id: "r2",
      text: "Distributed systems and Kafka",
      kind: "technical",
      priority: "must",
      state: "generated",
    },
    {
      id: "r3",
      text: "Mentorship and cross-functional leadership",
      kind: "behavioural",
      priority: "must",
      state: "generated",
    },
    {
      id: "r4",
      text: "Familiarity with SOC2 / ISO compliance",
      kind: "domain",
      priority: "nice",
      state: "generated",
    },
  ];

  const SAMPLE_QUESTIONS: Question[] = [
    {
      id: "q1",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Explain event loop starvation in Node.js.",
      answer_outline: "Discuss process.nextTick and CPU intensive sync operations.",
      difficulty: 2,
      state: "generated",
    },
    {
      id: "q2",
      requirement_ids: ["r2"],
      category: "system-design",
      prompt: "Design an at-least-once Kafka message pipeline with deduplication.",
      answer_outline: "Cover consumer group offsets, idempotency keys, and storage locks.",
      difficulty: 3,
      state: "generated",
    },
  ];

  describe("Coverage Loop (checkCoverage)", () => {
    it("finds uncovered requirements accurately using pure set logic", () => {
      // r3 (must) and r4 (nice) are not referenced in SAMPLE_QUESTIONS
      const uncovered = findUncoveredRequirements(SAMPLE_REQS, SAMPLE_QUESTIONS);
      expect(uncovered).toEqual(["r3", "r4"]);
    });

    it("runs gap-filling pass for must requirements and achieves full must coverage", async () => {
      const mockGapFill = vi.fn().mockImplementation(async (uncoveredReqs: Requirement[]) => {
        expect(uncoveredReqs).toHaveLength(1);
        expect(uncoveredReqs[0].id).toBe("r3"); // Only r3 is must; r4 is nice

        return [
          {
            id: "q3",
            requirement_ids: ["r3"],
            category: "behavioural" as const,
            prompt: "Tell me about a time you resolved a conflict between engineers.",
            answer_outline: "STAR format demonstrating active listening and technical ADR.",
            difficulty: 2 as const,
            state: "generated" as const,
          },
        ];
      });

      const result = await runCoverageLoop(SAMPLE_REQS, SAMPLE_QUESTIONS, mockGapFill, 3);

      expect(mockGapFill).toHaveBeenCalledTimes(1);
      expect(result.coverage.passes).toBe(2);
      expect(result.questions).toHaveLength(3);

      // Must requirements r1, r2, r3 are all covered; r4 (nice) remains honestly uncovered
      expect(result.coverage.uncovered_requirement_ids).toEqual(["r4"]);
    });

    it("records lingering nice requirements honestly without treating them as failure", async () => {
      const mockNoOp = vi.fn().mockResolvedValue([]);

      // Only r4 (nice) uncovered initially
      const reqsWithOnlyNiceUncovered = [SAMPLE_REQS[0], SAMPLE_REQS[1], SAMPLE_REQS[3]];
      const result = await runCoverageLoop(
        reqsWithOnlyNiceUncovered,
        SAMPLE_QUESTIONS,
        mockNoOp,
        2
      );

      // Should not even call gap-fill since all MUST requirements are covered
      expect(mockNoOp).not.toHaveBeenCalled();
      expect(result.coverage.passes).toBe(1);
      expect(result.coverage.uncovered_requirement_ids).toEqual(["r4"]);
    });
  });

  describe("Schedule Allocation (allocateSchedule)", () => {
    const COMPLETE_QUESTIONS: Question[] = [
      ...SAMPLE_QUESTIONS,
      {
        id: "q3",
        requirement_ids: ["r3"],
        category: "behavioural",
        prompt: "Describe your mentorship style.",
        answer_outline: "Discuss 1-on-1 cadence, pairing, and goal setting.",
        difficulty: 1,
        state: "generated",
      },
      {
        id: "q4",
        requirement_ids: ["r4"],
        category: "company-fit",
        prompt: "What is your approach to SOC2 audit compliance?",
        answer_outline: "Explain access controls, logging, and automated scanning.",
        difficulty: 1,
        state: "generated",
      },
    ];

    it("allocates correctly for 1-day case with all must questions included and integer minutes", () => {
      const schedule = allocateSchedule(SAMPLE_REQS, COMPLETE_QUESTIONS, 1);

      expect(schedule.days_available).toBe(1);
      expect(schedule.days).toHaveLength(1);
      expect(schedule.days[0].day).toBe(1);
      expect(Number.isInteger(schedule.days[0].minutes)).toBe(true);
      expect(schedule.days[0].minutes).toBeGreaterThanOrEqual(45);

      // All questions must be included on day 1
      expect(schedule.days[0].question_ids).toContain("q1");
      expect(schedule.days[0].question_ids).toContain("q2");
      expect(schedule.days[0].question_ids).toContain("q3");

      expect(() => ScheduleSchema.parse(schedule)).not.toThrow();
    });

    it("allocates correctly for 5-day case with exact day count and every must requirement covered", () => {
      const schedule = allocateSchedule(SAMPLE_REQS, COMPLETE_QUESTIONS, 5);

      expect(schedule.days_available).toBe(5);
      expect(schedule.days).toHaveLength(5);

      // Verify every day has sequential 1..5 index and integer minutes
      schedule.days.forEach((d, idx) => {
        expect(d.day).toBe(idx + 1);
        expect(Number.isInteger(d.minutes)).toBe(true);
        expect(d.minutes).toBeGreaterThanOrEqual(20);
        expect(d.focus.length).toBeGreaterThan(3);
      });

      // Verify all must questions (q1, q2, q3) appear somewhere in the schedule
      const scheduledQuestionIds = new Set(schedule.days.flatMap((d) => d.question_ids));
      expect(scheduledQuestionIds.has("q1")).toBe(true);
      expect(scheduledQuestionIds.has("q2")).toBe(true);
      expect(scheduledQuestionIds.has("q3")).toBe(true);

      expect(() => ScheduleSchema.parse(schedule)).not.toThrow();
    });

    it("handles 60-day case with zero empty days using spaced repetition drills", () => {
      const schedule = allocateSchedule(SAMPLE_REQS, COMPLETE_QUESTIONS, 60);

      expect(schedule.days_available).toBe(60);
      expect(schedule.days).toHaveLength(60);

      // Ensure absolutely zero days are left empty
      for (const d of schedule.days) {
        expect(d.question_ids.length).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(d.minutes)).toBe(true);
        expect(d.minutes).toBeGreaterThanOrEqual(15);
      }

      expect(() => ScheduleSchema.parse(schedule)).not.toThrow();
    });

    it("clusters harder and must-have material in earlier days than easier/nice material", () => {
      const schedule = allocateSchedule(SAMPLE_REQS, COMPLETE_QUESTIONS, 3);

      // q2 is difficulty 3 (System Design / Kafka), q1 is difficulty 2 (Technical)
      // q3 is difficulty 1 (Behavioural), q4 is difficulty 1 (Nice)
      // Day 1 must contain the hardest system design question (q2)
      expect(schedule.days[0].question_ids).toContain("q2");

      // The later day contains the easier / nice material
      const laterDayQuestions = schedule.days[schedule.days.length - 1].question_ids;
      expect(laterDayQuestions).toContain("q4");
    });
  });
});
