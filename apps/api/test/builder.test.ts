import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Kit } from "../src/models/Kit.js";
import { KitStructure } from "../src/types/kit.js";
import { validateKit } from "../src/validation/kitValidator.js";

const TEST_MONGODB_URI =
  process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/trao_test_builder";

describe("Phase 11 The Builder: Edit, Reorder, and Safe Sectional Regeneration", () => {
  let app: ReturnType<typeof createApp>;
  let authCookie: string[];
  let userId: string;

  beforeAll(async () => {
    process.env.MONGODB_URI = TEST_MONGODB_URI;
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
    app = createApp();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    await Kit.deleteMany({});
    await User.deleteMany({});

    const res = await request(app).post("/auth/register").send({
      email: "builder@example.com",
      password: "password12345",
    });
    authCookie = res.headers["set-cookie"];
    userId = res.body.user.id;
  });

  const createInitialTestKit = (): KitStructure => ({
    source: {
      company: "Acme Systems",
      company_url: "https://acme.example.com",
      role: "Senior Distributed Engineer",
      location: "Remote",
      jd_chars: 1200,
      researched_at: "2026-09-10T12:00:00Z",
      pages_used: ["https://acme.example.com/about"],
    },
    company_brief: {
      summary: "Leading edge compute platform.",
      what_they_do: "Global distributed database infrastructure.",
      sources: ["https://acme.example.com/about"],
      state: "generated",
    },
    role: {
      title: "Senior Distributed Engineer",
      seniority: "Senior",
      responsibilities: ["Build state machine replication", "Scale Raft clusters"],
      requirements: [
        {
          id: "r1",
          text: "5+ years distributed systems in Go or Rust",
          kind: "technical",
          priority: "must",
          state: "generated",
        },
        {
          id: "r2",
          text: "Experience with Raft or Paxos consensus",
          kind: "technical",
          priority: "must",
          state: "generated",
        },
        {
          id: "r3",
          text: "Mentors junior engineers and conducts RFC reviews",
          kind: "behavioural",
          priority: "nice",
          state: "generated",
        },
      ],
    },
    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Explain event loop starvation.",
        answer_outline: "Discuss worker pool and blocking calls.",
        difficulty: 3,
        state: "edited", // USER EDITED
      },
      {
        id: "q2",
        requirement_ids: ["r2"],
        category: "technical",
        prompt: "Custom User Question on Raft Leadership.",
        answer_outline: "Term numbers, heartbeat timers, split votes.",
        difficulty: 2,
        state: "pinned", // USER PINNED / ADDED
      },
      {
        id: "q3",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Original Generated Question to be Replaced.",
        answer_outline: "Old outline.",
        difficulty: 1,
        state: "generated", // REPLAYABLE
      },
      {
        id: "q4",
        requirement_ids: ["r3"],
        category: "behavioural",
        prompt: "Describe a mentorship challenge.",
        answer_outline: "STAR response.",
        difficulty: 2,
        state: "generated",
      },
    ],
    flashcards: [
      {
        id: "f1",
        front: "What is Raft split-vote prevention?",
        back: "Randomized election timeouts.",
        requirement_ids: ["r2"],
        state: "generated",
      },
    ],
    schedule: {
      days_available: 3,
      days: [
        {
          day: 1,
          focus: "Core Consensus",
          question_ids: ["q1", "q2"],
          minutes: 60,
        },
        {
          day: 2,
          focus: "System Resilience",
          question_ids: ["q3"],
          minutes: 45,
        },
        {
          day: 3,
          focus: "Leadership & STAR",
          question_ids: ["q4"],
          minutes: 45,
        },
      ],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 1,
    },
  });

  describe("PATCH /kits/:id - Inline Editing & Cascading Deletion", () => {
    it("updates question prompt in-place and marks state as 'edited'", async () => {
      // 1. Create initial kit
      const initialKit = createInitialTestKit();
      const createRes = await request(app)
        .post("/kits")
        .set("Cookie", authCookie)
        .send(initialKit);

      const kitId = createRes.body.kit._id;

      // 2. Patch question q3 to have updated prompt and state="edited"
      const updatedQuestions = [...initialKit.questions];
      updatedQuestions[2] = {
        ...updatedQuestions[2],
        prompt: "Newly updated prompt by user.",
        state: "edited",
      };

      const patchRes = await request(app)
        .patch(`/kits/${kitId}`)
        .set("Cookie", authCookie)
        .send({ questions: updatedQuestions });

      expect(patchRes.status).toBe(200);
      const patchedKit = patchRes.body.kit;
      expect(patchedKit.questions[2].prompt).toBe("Newly updated prompt by user.");
      expect(patchedKit.questions[2].state).toBe("edited");
      expect(validateKit(patchedKit).success).toBe(true);
    });

    it("cascade-removes deleted question from schedule.days[].question_ids", async () => {
      const initialKit = createInitialTestKit();
      const createRes = await request(app)
        .post("/kits")
        .set("Cookie", authCookie)
        .send(initialKit);

      const kitId = createRes.body.kit._id;

      // Delete q3 (which was in Day 2 schedule)
      const remainingQuestions = initialKit.questions.filter((q) => q.id !== "q3");

      const patchRes = await request(app)
        .patch(`/kits/${kitId}`)
        .set("Cookie", authCookie)
        .send({ questions: remainingQuestions });

      expect(patchRes.status).toBe(200);
      const updatedKit = patchRes.body.kit;

      // Assert q3 is gone from questions
      expect(updatedKit.questions.some((q: any) => q.id === "q3")).toBe(false);

      // Assert Day 2 schedule no longer references q3
      const day2 = updatedKit.schedule.days.find((d: any) => d.day === 2);
      expect(day2.question_ids).toEqual([]);

      // Referential integrity check passes
      expect(validateKit(updatedKit).success).toBe(true);
    });
  });

  describe("POST /kits/:id/regenerate - Rule 9 State Preservation", () => {
    it("preserves 'edited' and 'pinned' questions untouched while replacing 'generated' ones in category", async () => {
      const initialKit = createInitialTestKit();
      const createRes = await request(app)
        .post("/kits")
        .set("Cookie", authCookie)
        .send(initialKit);

      const kitId = createRes.body.kit._id;

      // Regenerate "technical" category
      const regenRes = await request(app)
        .post(`/kits/${kitId}/regenerate`)
        .set("Cookie", authCookie)
        .send({ target: "category", category: "technical" });

      expect(regenRes.status).toBe(200);
      const updatedKit = regenRes.body.kit;

      // 1. Assert q1 (edited) is strictly preserved untouched
      const q1 = updatedKit.questions.find((q: any) => q.id === "q1");
      expect(q1).toBeDefined();
      expect(q1.prompt).toBe("Explain event loop starvation.");
      expect(q1.state).toBe("edited");

      // 2. Assert q2 (pinned) is strictly preserved untouched
      const q2 = updatedKit.questions.find((q: any) => q.id === "q2");
      expect(q2).toBeDefined();
      expect(q2.prompt).toBe("Custom User Question on Raft Leadership.");
      expect(q2.state).toBe("pinned");

      // 3. Assert behavioural questions (other categories) were untouched
      const q4 = updatedKit.questions.find((q: any) => q.id === "q4");
      expect(q4).toBeDefined();
      expect(q4.prompt).toBe("Describe a mentorship challenge.");

      // 4. Referential integrity passes
      expect(validateKit(updatedKit).success).toBe(true);
    });

    it("regenerates schedule while preserving daysAvailable and valid question references", async () => {
      const initialKit = createInitialTestKit();
      const createRes = await request(app)
        .post("/kits")
        .set("Cookie", authCookie)
        .send(initialKit);

      const kitId = createRes.body.kit._id;

      const regenRes = await request(app)
        .post(`/kits/${kitId}/regenerate`)
        .set("Cookie", authCookie)
        .send({ target: "schedule" });

      expect(regenRes.status).toBe(200);
      const updatedKit = regenRes.body.kit;

      expect(updatedKit.schedule.days_available).toBe(3);
      expect(updatedKit.schedule.days.length).toBe(3);
      expect(validateKit(updatedKit).success).toBe(true);
    });

    it("leaves company_brief untouched if marked 'edited' or 'pinned'", async () => {
      const initialKit = createInitialTestKit();
      initialKit.company_brief.state = "edited";
      initialKit.company_brief.summary = "Custom user written summary.";

      const createRes = await request(app)
        .post("/kits")
        .set("Cookie", authCookie)
        .send(initialKit);

      const kitId = createRes.body.kit._id;

      const regenRes = await request(app)
        .post(`/kits/${kitId}/regenerate`)
        .set("Cookie", authCookie)
        .send({ target: "company_brief" });

      expect(regenRes.status).toBe(200);
      expect(regenRes.body.kit.company_brief.summary).toBe("Custom user written summary.");
      expect(regenRes.body.kit.company_brief.state).toBe("edited");
    });
  });

  describe("Concurrent and Rapid Edit Safety", () => {
    it("handles rapid consecutive patches predictably using last-write-wins", async () => {
      const initialKit = createInitialTestKit();
      const createRes = await request(app)
        .post("/kits")
        .set("Cookie", authCookie)
        .send(initialKit);

      const kitId = createRes.body.kit._id;

      // Edit 1
      const patch1 = await request(app)
        .patch(`/kits/${kitId}`)
        .set("Cookie", authCookie)
        .send({
          company_brief: {
            summary: "Edit 1 summary",
            what_they_do: "Edit 1 description",
            sources: [],
            state: "edited",
          },
        });

      // Edit 2 immediate follow-up
      const patch2 = await request(app)
        .patch(`/kits/${kitId}`)
        .set("Cookie", authCookie)
        .send({
          company_brief: {
            summary: "Edit 2 final summary",
            what_they_do: "Edit 2 final description",
            sources: [],
            state: "edited",
          },
        });

      expect(patch1.status).toBe(200);
      expect(patch2.status).toBe(200);
      expect(patch2.body.kit.company_brief.summary).toBe("Edit 2 final summary");
    });
  });
});
