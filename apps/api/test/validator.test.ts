import { describe, it, expect } from "vitest";
import { validateKit, assertValidKit } from "../src/validation/kitValidator.js";
import { KitStructure } from "../src/types/kit.js";

// Canonical valid kit object based on docs/appendix-a-kit-structure.json
const createValidKit = (): KitStructure => ({
  source: {
    company: "Acme Corp",
    company_url: "https://acme.example.com",
    role: "Senior Backend Engineer",
    location: "Remote",
    jd_chars: 1420,
    researched_at: "2026-09-10T12:00:00Z",
    pages_used: ["https://acme.example.com/about", "https://acme.example.com/jobs"],
  },
  company_brief: {
    summary: "Leading distributed data platform.",
    what_they_do: "Enterprise streaming analytics.",
    sources: ["https://acme.example.com/about"],
  },
  role: {
    title: "Senior Backend Engineer",
    seniority: "Senior",
    responsibilities: ["Design resilient microservices", "Lead backend performance audits"],
    requirements: [
      {
        id: "r1",
        text: "5+ years experience with Node.js and TypeScript",
        kind: "technical",
        priority: "must",
      },
      {
        id: "r2",
        text: "Mentors junior engineers and conducts code reviews",
        kind: "behavioural",
        priority: "nice",
      },
    ],
  },
  questions: [
    {
      id: "q1",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Explain how Node.js handles event loop starvation and thread pool exhaustion.",
      answer_outline: "Discuss libuv worker pool, setImmediate vs process.nextTick, clustering.",
      difficulty: 3,
    },
    {
      id: "q2",
      requirement_ids: ["r2"],
      category: "behavioural",
      prompt: "Describe a time you gave critical architecture feedback to a colleague.",
      answer_outline: "STAR format: constructive feedback, blameless culture, positive outcome.",
      difficulty: 2,
    },
  ],
  flashcards: [
    {
      id: "f1",
      front: "What is the role of libuv in the Node.js architecture?",
      back: "Multi-platform C library providing asynchronous I/O and thread pooling.",
      requirement_ids: ["r1"],
    },
  ],
  schedule: {
    days_available: 3,
    days: [
      {
        day: 1,
        focus: "Core Node.js Runtime Architecture",
        question_ids: ["q1"],
        minutes: 60,
      },
      {
        day: 2,
        focus: "Leadership & Collaboration",
        question_ids: ["q2"],
        minutes: 45,
      },
      {
        day: 3,
        focus: "Flashcard Review & Mock Synthesis",
        question_ids: ["q1", "q2"],
        minutes: 30,
      },
    ],
  },
  coverage: {
    uncovered_requirement_ids: [],
    passes: 1,
  },
});

describe("Appendix A Kit Structure Validator", () => {
  it("passes validation for canonical valid kit", () => {
    const validKit = createValidKit();
    const result = validateKit(validKit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source.company).toBe("Acme Corp");
      expect(result.data.questions.length).toBe(2);
    }
  });

  it("assertValidKit returns kit on success", () => {
    const validKit = createValidKit();
    const validated = assertValidKit(validKit);
    expect(validated.source.role).toBe("Senior Backend Engineer");
  });

  it("fails when a required root section is missing", () => {
    const invalid: any = createValidKit();
    delete invalid.company_brief;

    const result = validateKit(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes("company_brief"))).toBe(true);
    }
  });

  it("fails when schedule references a non-existent question ID", () => {
    const invalid = createValidKit();
    // Reference ghost question 'q999'
    invalid.schedule.days[0].question_ids.push("q999");

    const result = validateKit(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes("non-existent question ID 'q999'"))).toBe(
        true
      );
    }
  });

  it("fails when question references a non-existent requirement ID", () => {
    const invalid = createValidKit();
    invalid.questions[0].requirement_ids.push("r999");

    const result = validateKit(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes("non-existent requirement ID 'r999'"))).toBe(
        true
      );
    }
  });

  it("fails when priority is not 'must' or 'nice'", () => {
    const invalid: any = createValidKit();
    invalid.role.requirements[0].priority = "critical";

    const result = validateKit(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes("priority"))).toBe(true);
    }
  });

  it("fails when category is not an allowed enum", () => {
    const invalid: any = createValidKit();
    invalid.questions[0].category = "general-knowledge";

    const result = validateKit(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes("category"))).toBe(true);
    }
  });

  it("fails when difficulty is not integer 1, 2, or 3", () => {
    const invalid: any = createValidKit();
    invalid.questions[0].difficulty = 4; // Out of bounds

    const result = validateKit(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes("difficulty"))).toBe(true);
    }

    const floatDifficulty: any = createValidKit();
    floatDifficulty.questions[0].difficulty = 2.5; // Float
    const floatResult = validateKit(floatDifficulty);
    expect(floatResult.success).toBe(false);
  });

  it("fails when schedule minutes are not integers", () => {
    const invalid: any = createValidKit();
    invalid.schedule.days[0].minutes = 45.5;

    const result = validateKit(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes("minutes"))).toBe(true);
    }
  });

  it("fails when jd_chars is not an integer", () => {
    const invalid: any = createValidKit();
    invalid.source.jd_chars = 1200.75;

    const result = validateKit(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes("jd_chars"))).toBe(true);
    }
  });
});
