import { describe, it, expect, vi } from "vitest";
import { Requirement } from "../src/types/kit.js";
import {
  buildCategorySystemPrompt,
  generateQuestionsForRequirement,
  generateAllQuestions,
} from "../src/pipeline/generation/generateQuestions.js";
import { generateFlashcards } from "../src/pipeline/generation/generateFlashcards.js";
import { QuestionSchema, FlashcardSchema } from "../src/validation/kitValidator.js";

describe("Phase 6: Question & Flashcard Generation", () => {
  const SAMPLE_TECH_REQ: Requirement = {
    id: "r1",
    text: "Deep proficiency in Node.js, asynchronous event loop, and TypeScript",
    kind: "technical",
    priority: "must",
    state: "generated",
  };

  const SAMPLE_BEHAV_REQ: Requirement = {
    id: "r2",
    text: "Mentors junior engineers and drives engineering cross-team consensus",
    kind: "behavioural",
    priority: "must",
    state: "generated",
  };

  const SAMPLE_SYS_REQ: Requirement = {
    id: "r3",
    text: "Experience designing distributed microservices with Kafka and high throughput",
    kind: "technical",
    priority: "must",
    state: "generated",
  };

  describe("buildCategorySystemPrompt (Sequencing & Style Divergence)", () => {
    it("produces visibly distinct instructions across technical, behavioural, and system-design categories", () => {
      const techPrompt = buildCategorySystemPrompt("technical");
      const behavPrompt = buildCategorySystemPrompt("behavioural");
      const sysPrompt = buildCategorySystemPrompt("system-design");
      const fitPrompt = buildCategorySystemPrompt("company-fit");

      // Verify category-specific instructions
      expect(techPrompt).toContain("TECHNICAL");
      expect(techPrompt).toContain("practical coding");

      expect(behavPrompt).toContain("BEHAVIOURAL");
      expect(behavPrompt).toContain("STAR method");

      expect(sysPrompt).toContain("SYSTEM-DESIGN");
      expect(sysPrompt).toContain("large-scale distributed system architecture");

      expect(fitPrompt).toContain("COMPANY-FIT");
      expect(fitPrompt).toContain("engineering culture");

      // Verify distinctness: technical instructions do not talk about STAR method
      expect(techPrompt).not.toContain("STAR method");
      expect(behavPrompt).not.toContain("distributed system architecture");
    });

    it("incorporates hiring-process context into the prompt when present vs fallback when absent", () => {
      const withHiring = buildCategorySystemPrompt(
        "system-design",
        "Round 2 is a 60-minute live whiteboard system design on event streaming. Round 3 is a take-home."
      );
      const withoutHiring = buildCategorySystemPrompt("system-design", null);

      expect(withHiring).toContain("<hiring-process>");
      expect(withHiring).toContain("60-minute live whiteboard system design");
      expect(withoutHiring).toContain("No company-specific interview round information was retrieved");
    });
  });

  describe("generateQuestionsForRequirement", () => {
    it("generates valid questions for a single requirement and passes category-specific prompts to LLM", async () => {
      let interceptedSystemPrompt = "";
      let interceptedUserPrompt = "";

      const mockLLM = vi.fn().mockImplementation(async (sys: string, user: string) => {
        interceptedSystemPrompt = sys;
        interceptedUserPrompt = user;
        return {
          model: "mock-model",
          text: JSON.stringify([
            {
              prompt: "Explain how the Node.js event loop handles microtasks vs macrotasks under heavy I/O.",
              answer_outline: "Discuss process.nextTick, Promise queue execution before timers, and starvation risks.",
              difficulty: 2,
            },
          ]),
        };
      });

      const questions = await generateQuestionsForRequirement(
        SAMPLE_TECH_REQ,
        "technical",
        "Live coding test",
        { llmCaller: mockLLM }
      );

      expect(mockLLM).toHaveBeenCalledTimes(1);
      expect(interceptedSystemPrompt).toContain("TECHNICAL");
      expect(interceptedUserPrompt).toContain(SAMPLE_TECH_REQ.text);
      expect(questions).toHaveLength(1);
      expect(questions[0].prompt).toContain("Node.js event loop");
      expect(questions[0].difficulty).toBe(2);
    });

    it("recovers gracefully on retry if first LLM response is malformed", async () => {
      const mockLLM = vi
        .fn()
        .mockResolvedValueOnce({
          model: "mock-model",
          text: "Here is your question: { prompt: unquoted }",
        })
        .mockResolvedValueOnce({
          model: "mock-model",
          text: JSON.stringify([
            {
              prompt: "Tell me about a time you mentored an engineer who was struggling.",
              answer_outline: "STAR format outlining initial assessment, actionable milestones, and positive outcome.",
              difficulty: 2,
            },
          ]),
        });

      const questions = await generateQuestionsForRequirement(
        SAMPLE_BEHAV_REQ,
        "behavioural",
        null,
        { llmCaller: mockLLM }
      );

      expect(mockLLM).toHaveBeenCalledTimes(2);
      expect(questions).toHaveLength(1);
      expect(questions[0].prompt).toContain("mentored an engineer");
    });
  });

  describe("generateAllQuestions", () => {
    it("orchestrates per-requirement calls, assigns stable q1, q2 IDs, and validates against Appendix A", async () => {
      const mockLLM = vi.fn().mockImplementation(async (sys: string) => {
        if (sys.includes("BEHAVIOURAL")) {
          return {
            model: "mock-model",
            text: JSON.stringify([
              {
                prompt: "Describe how you resolved a high-stakes technical disagreement between teams.",
                answer_outline: "Focus on data-driven trade-off analysis, empathy, and documented ADRs.",
                difficulty: 2,
              },
            ]),
          };
        } else if (sys.includes("SYSTEM-DESIGN")) {
          return {
            model: "mock-model",
            text: JSON.stringify([
              {
                prompt: "Design an exactly-once event ingestion pipeline handling 100k events/sec with Kafka.",
                answer_outline: "Cover idempotent producers, consumer offsets, partitioning strategy, and dead-letter queues.",
                difficulty: 3,
              },
            ]),
          };
        } else {
          return {
            model: "mock-model",
            text: JSON.stringify([
              {
                prompt: "How do you detect and profile memory leaks in a production Node.js service?",
                answer_outline: "Heap snapshots, V8 flags, sampling profilers, and inspecting retained closures.",
                difficulty: 2,
              },
            ]),
          };
        }
      });

      const allQuestions = await generateAllQuestions(
        [SAMPLE_TECH_REQ, SAMPLE_BEHAV_REQ, SAMPLE_SYS_REQ],
        "Includes system design round",
        { llmCaller: mockLLM }
      );

      // Must have generated technical, behavioural, and system-design questions
      expect(allQuestions.length).toBeGreaterThanOrEqual(3);

      // Verify stable unique IDs and state
      expect(allQuestions[0].id).toBe("q1");
      expect(allQuestions[1].id).toBe("q2");
      expect(allQuestions[2].id).toBe("q3");
      expect(allQuestions.every((q) => q.state === "generated")).toBe(true);

      // Verify requirement_ids linkage
      expect(allQuestions[0].requirement_ids).toContain("r1");
      expect(allQuestions.some((q) => q.category === "behavioural")).toBe(true);
      expect(allQuestions.some((q) => q.category === "system-design")).toBe(true);
      expect(allQuestions.some((q) => q.category === "technical")).toBe(true);

      // Verify every question adheres strictly to Appendix A schema
      for (const q of allQuestions) {
        expect(() => QuestionSchema.parse(q)).not.toThrow();
      }
    });

    it("survives a single requirement LLM error without crashing the entire batch", async () => {
      let callIndex = 0;
      const mockLLM = vi.fn().mockImplementation(async () => {
        callIndex++;
        if (callIndex === 1) {
          throw new Error("Simulated LLM network failure on first requirement");
        }
        return {
          model: "mock-model",
          text: JSON.stringify([
            {
              prompt: "How do you handle mentorship in remote teams?",
              answer_outline: "Regular 1-on-1s, asynchronous pairing, and code reviews.",
              difficulty: 1,
            },
          ]),
        };
      });

      const questions = await generateAllQuestions(
        [SAMPLE_TECH_REQ, SAMPLE_BEHAV_REQ],
        null,
        { llmCaller: mockLLM }
      );

      // The second requirement succeeded and produced questions despite the first requirement failing
      expect(questions.length).toBeGreaterThanOrEqual(1);
      expect(questions[0].id).toBe("q1");
      expect(questions[0].requirement_ids).toContain("r2");
    });
  });

  describe("generateFlashcards", () => {
    it("derives flashcards from questions with requirement_ids carried through and validates against Appendix A", async () => {
      const sampleQuestions = [
        {
          id: "q1",
          requirement_ids: ["r1"],
          category: "technical" as const,
          prompt: "What causes event loop lag in Node.js?",
          answer_outline: "Synchronous blocking CPU work, heavy JSON parsing, or long regex executions.",
          difficulty: 2 as const,
          state: "generated" as const,
        },
        {
          id: "q2",
          requirement_ids: ["r3"],
          category: "system-design" as const,
          prompt: "What is Kafka partition rebalancing?",
          answer_outline: "Occurs when consumers join or leave a group, transferring partition ownership.",
          difficulty: 2 as const,
          state: "generated" as const,
        },
      ];

      const mockLLM = vi.fn().mockResolvedValue({
        model: "mock-model",
        text: JSON.stringify([
          {
            front: "Primary causes of Node.js event loop lag",
            back: "Sync CPU work, large JSON.parse/stringify, catastrophic regex backtracking.",
          },
          {
            front: "What triggers a Kafka consumer group rebalance?",
            back: "Consumer heartbeat timeout, new consumer joining, partition addition.",
          },
        ]),
      });

      const cards = await generateFlashcards(sampleQuestions, { llmCaller: mockLLM });

      expect(cards).toHaveLength(2);
      expect(cards[0].id).toBe("f1");
      expect(cards[1].id).toBe("f2");
      expect(cards[0].requirement_ids).toEqual(["r1"]);
      expect(cards[1].requirement_ids).toEqual(["r3"]);
      expect(cards.every((c) => c.state === "generated")).toBe(true);

      for (const card of cards) {
        expect(() => FlashcardSchema.parse(card)).not.toThrow();
      }
    });

    it("falls back to direct distillation if LLM fails or is bypassed", async () => {
      const sampleQuestions = [
        {
          id: "q1",
          requirement_ids: ["r1"],
          category: "technical" as const,
          prompt: "Explain idempotency in distributed APIs.",
          answer_outline: "Ensuring an operation produces the same result regardless of how many times it is called.",
          difficulty: 2 as const,
          state: "generated" as const,
        },
      ];

      const mockLLM = vi.fn().mockRejectedValue(new Error("LLM Down"));

      const cards = await generateFlashcards(sampleQuestions, { llmCaller: mockLLM });

      expect(cards).toHaveLength(1);
      expect(cards[0].id).toBe("f1");
      expect(cards[0].front).toBe(sampleQuestions[0].prompt);
      expect(cards[0].back).toBe(sampleQuestions[0].answer_outline);
      expect(cards[0].requirement_ids).toEqual(["r1"]);
    });
  });
});
