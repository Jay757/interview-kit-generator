import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Kit } from "../src/models/Kit.js";
import { KitFlashcard, KitRequirement } from "../src/types/kit.js";
import {
  orderFlashcardsForNextSession,
  computeCardPracticeMetrics,
  computePracticeCoverage,
  PracticeAttempt,
} from "../src/pipeline/practice/ordering.js";

const TEST_MONGODB_URI =
  process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/trao_test_practice";

let app: ReturnType<typeof createApp>;
let userCookie: string;
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
  await User.deleteMany({});
  await Kit.deleteMany({});

  // Register a user
  const regRes = await request(app).post("/auth/register").send({
    email: "practice-user@trao.ai",
    password: "Password123!",
  });
  userCookie = regRes.headers["set-cookie"][0];
  const meRes = await request(app).get("/auth/me").set("Cookie", userCookie);
  userId = meRes.body.user.id;
});

describe("Phase 12 Practice Mode: Spaced Repetition Ordering & Coverage", () => {
  const sampleFlashcards: KitFlashcard[] = [
    {
      id: "f1",
      front: "What is an LSM-tree?",
      back: "Log-Structured Merge-tree optimized for write throughput with memtable and SSTables.",
      requirement_ids: ["r1"],
      state: "generated",
    },
    {
      id: "f2",
      front: "Explain the Raft consensus algorithm.",
      back: "Leader election, log replication, and safety guarantees.",
      requirement_ids: ["r1", "r2"],
      state: "generated",
    },
    {
      id: "f3",
      front: "What is eventual consistency?",
      back: "Guarantees all replicas eventually converge to the same value given no new updates.",
      requirement_ids: ["r2"],
      state: "generated",
    },
    {
      id: "f4",
      front: "How do database indexes work?",
      back: "B-Trees / Hash indexes mapping indexed keys to disk page references.",
      requirement_ids: ["r3"],
      state: "generated",
    },
  ];

  const sampleRequirements: KitRequirement[] = [
    {
      id: "r1",
      text: "Experience with distributed storage systems",
      kind: "technical",
      priority: "must",
      state: "generated",
    },
    {
      id: "r2",
      text: "Knowledge of consensus and replication",
      kind: "technical",
      priority: "must",
      state: "generated",
    },
    {
      id: "r3",
      text: "SQL query optimization and database tuning",
      kind: "technical",
      priority: "nice",
      state: "generated",
    },
  ];

  describe("orderFlashcardsForNextSession (SM-2 Spaced Repetition)", () => {
    it("places never-seen cards at the front of the deck to maximize syllabus coverage", () => {
      const now = new Date("2026-09-10T12:00:00Z");
      // f1 and f2 have been practiced, f3 and f4 are never seen
      const attempts: PracticeAttempt[] = [
        { card_id: "f1", confidence: 4, timestamp: "2026-09-10T10:00:00Z" },
        { card_id: "f2", confidence: 3, timestamp: "2026-09-10T11:00:00Z" },
      ];

      const ordered = orderFlashcardsForNextSession(sampleFlashcards, attempts, { now });
      const orderedIds = ordered.map((c) => c.id);

      // Never-seen cards f3, f4 should be prioritized first
      expect(orderedIds[0]).toBe("f3");
      expect(orderedIds[1]).toBe("f4");
      // Practiced cards come after
      expect(orderedIds.slice(2)).toContain("f1");
      expect(orderedIds.slice(2)).toContain("f2");
    });

    it("prioritizes low-confidence / failed cards (rating 1 Again, 2 Hard) over high-confidence cards (rating 4 Easy)", () => {
      const now = new Date("2026-09-10T12:00:00Z");
      // All cards practiced yesterday
      const yesterday = "2026-09-09T12:00:00Z";
      const attempts: PracticeAttempt[] = [
        { card_id: "f1", confidence: 4, timestamp: yesterday }, // Easy
        { card_id: "f2", confidence: 3, timestamp: yesterday }, // Good
        { card_id: "f3", confidence: 2, timestamp: yesterday }, // Hard
        { card_id: "f4", confidence: 1, timestamp: yesterday }, // Again (lapse)
      ];

      const ordered = orderFlashcardsForNextSession(sampleFlashcards, attempts, { now });
      const orderedIds = ordered.map((c) => c.id);

      // f4 (confidence 1) was a lapse, interval is ~1hr -> extremely overdue -> priority 1
      expect(orderedIds[0]).toBe("f4");
      // f3 (confidence 2) was Hard, interval is 1 day -> due now -> priority 2
      expect(orderedIds[1]).toBe("f3");
      // f2 (confidence 3) was Good, interval is 1 day -> due now
      expect(orderedIds[2]).toBe("f2");
      // f1 (confidence 4) was Easy, interval is 2 days -> not yet due -> last
      expect(orderedIds[3]).toBe("f1");
    });

    it("handles lapses correctly: previously mastered card rating 'Again' resets repetition and jumps to front", () => {
      const now = new Date("2026-09-10T12:00:00Z");
      const attempts: PracticeAttempt[] = [
        // f1 has 3 consecutive Easy ratings, well mastered
        { card_id: "f1", confidence: 4, timestamp: "2026-09-01T10:00:00Z" },
        { card_id: "f1", confidence: 4, timestamp: "2026-09-03T10:00:00Z" },
        { card_id: "f1", confidence: 4, timestamp: "2026-09-08T10:00:00Z" },
        // f2 has 2 Good ratings
        { card_id: "f2", confidence: 3, timestamp: "2026-09-05T10:00:00Z" },
        { card_id: "f2", confidence: 3, timestamp: "2026-09-08T10:00:00Z" },
        // f3 was practiced once with Easy
        { card_id: "f3", confidence: 4, timestamp: "2026-09-09T10:00:00Z" },
        // f4 was previously mastered, but just suffered a lapse ("Again" rating today)
        { card_id: "f4", confidence: 4, timestamp: "2026-09-01T10:00:00Z" },
        { card_id: "f4", confidence: 4, timestamp: "2026-09-05T10:00:00Z" },
        { card_id: "f4", confidence: 1, timestamp: "2026-09-10T11:00:00Z" }, // LAPSE
      ];

      const ordered = orderFlashcardsForNextSession(sampleFlashcards, attempts, { now });

      // f4 suffered a lapse, immediate repetition needed -> must be first
      expect(ordered[0].id).toBe("f4");

      const metricsF4 = computeCardPracticeMetrics("f4", attempts, now);
      expect(metricsF4.repetitions).toBe(0); // Repetitions reset to 0
      expect(metricsF4.intervalDays).toBeLessThan(0.1); // Immediate interval
    });

    it("breaks ties deterministically using stable card id", () => {
      const now = new Date("2026-09-10T12:00:00Z");
      // All cards have identical attempts
      const attempts: PracticeAttempt[] = [
        { card_id: "f1", confidence: 3, timestamp: "2026-09-10T10:00:00Z" },
        { card_id: "f2", confidence: 3, timestamp: "2026-09-10T10:00:00Z" },
        { card_id: "f3", confidence: 3, timestamp: "2026-09-10T10:00:00Z" },
        { card_id: "f4", confidence: 3, timestamp: "2026-09-10T10:00:00Z" },
      ];

      const ordered = orderFlashcardsForNextSession(sampleFlashcards, attempts, { now });
      expect(ordered.map((c) => c.id)).toEqual(["f1", "f2", "f3", "f4"]);
    });
  });

  describe("computePracticeCoverage", () => {
    it("accurately computes flashcard and requirement coverage", () => {
      // f1 covers r1; f2 covers r1, r2
      const attempts: PracticeAttempt[] = [
        { card_id: "f1", confidence: 3, timestamp: "2026-09-10T10:00:00Z" },
        { card_id: "f2", confidence: 4, timestamp: "2026-09-10T11:00:00Z" },
      ];

      const coverage = computePracticeCoverage(sampleFlashcards, sampleRequirements, attempts);

      expect(coverage.totalCards).toBe(4);
      expect(coverage.practicedCardsCount).toBe(2);
      expect(coverage.unpracticedCardsCount).toBe(2);
      expect(coverage.cardCoveragePercentage).toBe(50);
      expect(coverage.practicedCardIds).toEqual(["f1", "f2"]);
      expect(coverage.unpracticedCardIds).toEqual(["f3", "f4"]);

      // Requirements coverage: f1 (r1) and f2 (r1, r2) cover r1 and r2; r3 is uncovered
      expect(coverage.totalRequirementsCount).toBe(3);
      expect(coverage.coveredRequirementsCount).toBe(2);
      expect(coverage.uncoveredRequirementsCount).toBe(1);
      expect(coverage.coveredRequirementIds).toContain("r1");
      expect(coverage.coveredRequirementIds).toContain("r2");
      expect(coverage.uncoveredRequirementIds).toEqual(["r3"]);

      // Confidence metrics
      expect(coverage.averageConfidence).toBe(3.5);
      expect(coverage.confidenceDistribution).toEqual({ 1: 0, 2: 0, 3: 1, 4: 1 });
    });
  });

  describe("Practice Mode API Endpoints", () => {
    let testKitId: string;

    beforeEach(async () => {
      const kit = await Kit.create({
        ownerId: new mongoose.Types.ObjectId(userId),
        status: "completed",
        source: {
          company: "CloudScale Inc",
          company_url: "https://cloudscale.test",
          role: "Distributed Systems Engineer",
          location: "Remote",
          jd_chars: 1200,
          researched_at: new Date().toISOString(),
          pages_used: [],
        },
        company_brief: {
          summary: "Cloud infrastructure company.",
          what_they_do: "Scalable databases.",
          sources: [],
          state: "generated",
        },
        role: {
          title: "Distributed Systems Engineer",
          seniority: "Senior",
          responsibilities: ["Design database engines"],
          requirements: sampleRequirements,
        },
        questions: [
          {
            id: "q1",
            requirement_ids: ["r1"],
            category: "technical",
            prompt: "Explain write amplification in LSM trees.",
            answer_outline: "Compaction overhead...",
            difficulty: 3,
            state: "generated",
          },
        ],
        flashcards: sampleFlashcards,
        schedule: {
          days_available: 3,
          days: [
            { day: 1, focus: "Storage", question_ids: ["q1"], minutes: 60 },
            { day: 2, focus: "Consensus", question_ids: [], minutes: 60 },
            { day: 3, focus: "Tuning", question_ids: [], minutes: 60 },
          ],
        },
        coverage: {
          uncovered_requirement_ids: ["r2", "r3"],
          passes: 1,
        },
        practice_attempts: [],
      });

      testKitId = kit._id.toString();
    });

    it("GET /kits/:id/practice returns flashcards ordered by next session priority and coverage", async () => {
      const res = await request(app)
        .get(`/kits/${testKitId}/practice`)
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.flashcards).toHaveLength(4);
      expect(res.body.coverage.practicedCardsCount).toBe(0);
      expect(res.body.coverage.unpracticedCardsCount).toBe(4);
      expect(res.body.coverage.cardCoveragePercentage).toBe(0);
      expect(res.body.role).toBe("Distributed Systems Engineer");
      expect(res.body.company).toBe("CloudScale Inc");
    });

    it("POST /kits/:id/practice/attempt records attempt, persists timestamp, and updates coverage", async () => {
      const attemptRes = await request(app)
        .post(`/kits/${testKitId}/practice/attempt`)
        .set("Cookie", userCookie)
        .send({
          card_id: "f1",
          confidence: 4,
        });

      expect(attemptRes.status).toBe(200);
      expect(attemptRes.body.status).toBe("ok");
      expect(attemptRes.body.attempt.card_id).toBe("f1");
      expect(attemptRes.body.attempt.confidence).toBe(4);
      expect(attemptRes.body.attempt.timestamp).toBeDefined();

      // Coverage updated
      expect(attemptRes.body.coverage.practicedCardsCount).toBe(1);
      expect(attemptRes.body.coverage.cardCoveragePercentage).toBe(25);
      expect(attemptRes.body.coverage.coveredRequirementIds).toContain("r1");

      // Verify persistence by fetching GET /kits/:id/practice again
      const getRes = await request(app)
        .get(`/kits/${testKitId}/practice`)
        .set("Cookie", userCookie);

      expect(getRes.status).toBe(200);
      expect(getRes.body.attempts).toHaveLength(1);
      // Unseen cards (f2, f3, f4) are now ordered before f1
      expect(getRes.body.flashcards[3].id).toBe("f1");
    });

    it("POST /kits/:id/practice/attempt rejects invalid confidence ratings or missing card_id", async () => {
      // Invalid confidence 5 (scale is 1-4)
      const res1 = await request(app)
        .post(`/kits/${testKitId}/practice/attempt`)
        .set("Cookie", userCookie)
        .send({
          card_id: "f1",
          confidence: 5,
        });

      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe("INVALID_REQUEST");

      // Non-existent card_id
      const res2 = await request(app)
        .post(`/kits/${testKitId}/practice/attempt`)
        .set("Cookie", userCookie)
        .send({
          card_id: "non-existent-card",
          confidence: 3,
        });

      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe("CARD_NOT_FOUND");
    });

    it("enforces authentication and owner scoping on practice endpoints", async () => {
      // Unauthenticated GET
      const res1 = await request(app).get(`/kits/${testKitId}/practice`);
      expect(res1.status).toBe(401);

      // Unauthenticated POST
      const res2 = await request(app)
        .post(`/kits/${testKitId}/practice/attempt`)
        .send({ card_id: "f1", confidence: 3 });
      expect(res2.status).toBe(401);

      // Another user cannot access or record attempts
      const otherReg = await request(app).post("/auth/register").send({
        email: "other@trao.ai",
        password: "Password123!",
      });
      const otherCookie = otherReg.headers["set-cookie"][0];

      const res3 = await request(app)
        .get(`/kits/${testKitId}/practice`)
        .set("Cookie", otherCookie);
      expect(res3.status).toBe(403);

      const res4 = await request(app)
        .post(`/kits/${testKitId}/practice/attempt`)
        .set("Cookie", otherCookie)
        .send({ card_id: "f1", confidence: 3 });
      expect(res4.status).toBe(403);
    });
  });
});
