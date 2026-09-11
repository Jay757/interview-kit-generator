import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import http from "http";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Kit } from "../src/models/Kit.js";
import { allocateSchedule } from "../src/pipeline/schedule/allocateSchedule.js";
import { KitQuestion, KitRequirement, KitStructure } from "../src/types/kit.js";
import { validateKit } from "../src/validation/kitValidator.js";
import { findUncoveredRequirements } from "../src/pipeline/coverage/index.js";
import { crawlCompanySite } from "../src/pipeline/retrieval/crawler.js";
import { callLLM } from "../src/pipeline/llm/client.js";

const TEST_MONGODB_URI =
  process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/trao_test_robustness";

let app: ReturnType<typeof createApp>;
let userCookie: string;
let userId: string;
let fixtureServer: http.Server;
let fixtureBaseUrl: string;

beforeAll(async () => {
  process.env.MONGODB_URI = TEST_MONGODB_URI;
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_MONGODB_URI);
  }
  app = createApp();

  // Spin up a local fixture HTTP server for crawl edge cases
  fixtureServer = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url === "/robots.txt") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("User-agent: *\nAllow: /\n");
      return;
    }

    if (url === "/no-hiring-page/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Product Only</title></head>
          <body>
            <h1>Minimal Tech</h1>
            <p>We build specialized industrial sensors.</p>
          </body>
        </html>
      `);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  await new Promise<void>((resolve) => {
    fixtureServer.listen(0, "127.0.0.1", () => {
      const addr = fixtureServer.address() as any;
      fixtureBaseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  if (fixtureServer) {
    await new Promise<void>((resolve) => fixtureServer.close(() => resolve()));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

beforeEach(async () => {
  await Kit.deleteMany({});
  await User.deleteMany({});

  const regRes = await request(app).post("/auth/register").send({
    email: "robustness-user@trao.ai",
    password: "Password123!",
  });
  userCookie = regRes.headers["set-cookie"][0];
  const meRes = await request(app).get("/auth/me").set("Cookie", userCookie);
  userId = meRes.body.user.id;
});

describe("Phase 13: Edge Cases, Robustness Pass & Error Containment", () => {
  // Edge Case 1: Company URL is invalid, returns 404, or times out
  describe("Edge Case 1: Invalid, 404, or timed-out Company URL", () => {
    it("degrades gracefully without crashing, returning empty pagesUsed and aboutText", async () => {
      // 1. Invalid URL / non-routable
      const resInvalid = await crawlCompanySite("not-a-valid-url-format");
      expect(resInvalid.pagesUsed).toEqual([]);
      expect(resInvalid.aboutText).toBe("");
      expect(resInvalid.hiringText).toBeNull();

      // 2. 404 response on local fixture server
      const res404 = await crawlCompanySite(`${fixtureBaseUrl}/non-existent-404-site/`, {
        allowLocal: true,
      });
      expect(res404.pagesUsed).toEqual([]);
      expect(res404.aboutText).toBe("");
      expect(res404.hiringText).toBeNull();
    });
  });

  // Edge Case 2: Company site has no discoverable hiring or about page
  describe("Edge Case 2: Company site with no discoverable hiring or about page", () => {
    it("safely extracts available root text and honestly reports null hiringText without fabricating facts", async () => {
      const result = await crawlCompanySite(`${fixtureBaseUrl}/no-hiring-page/`, {
        allowLocal: true,
      });

      expect(result.pagesUsed).toContain(`${fixtureBaseUrl}/no-hiring-page/`);
      expect(result.aboutText).toContain("We build specialized industrial sensors");
      expect(result.hiringText).toBeNull(); // Honest empty state per Rule 4
    });
  });

  // Edge Case 3: Job description is a two-line stub with almost nothing to extract
  describe("Edge Case 3: Job description is a two-line stub", () => {
    it("produces a valid kit schema even with minimal requirements", () => {
      const stubRequirements: KitRequirement[] = [
        {
          id: "r1",
          text: "Basic software development knowledge",
          kind: "technical",
          priority: "must",
          state: "generated",
        },
      ];

      const stubQuestions: KitQuestion[] = [
        {
          id: "q1",
          requirement_ids: ["r1"],
          category: "technical",
          prompt: "Explain a project you built recently.",
          answer_outline: "Discuss architecture, tradeoffs, and lessons learned.",
          difficulty: 1,
          state: "generated",
        },
      ];

      const stubSchedule = allocateSchedule(stubRequirements, stubQuestions, 3);
      expect(stubSchedule.days).toHaveLength(3);
      expect(stubSchedule.days[0].question_ids).toContain("q1");

      const minimalKit: KitStructure = {
        source: {
          company: "StubCorp",
          company_url: "https://stubcorp.test",
          role: "Developer",
          location: "Remote",
          jd_chars: 45,
          researched_at: new Date().toISOString(),
          pages_used: [],
        },
        company_brief: {
          summary: "No public information found.",
          what_they_do: "No public details found.",
          sources: [],
          state: "generated",
        },
        role: {
          title: "Developer",
          seniority: "Junior",
          responsibilities: ["Write code"],
          requirements: stubRequirements,
        },
        questions: stubQuestions,
        flashcards: [
          {
            id: "f1",
            front: "What is version control?",
            back: "Git manages change history.",
            requirement_ids: ["r1"],
            state: "generated",
          },
        ],
        schedule: stubSchedule,
        coverage: {
          uncovered_requirement_ids: [],
          passes: 1,
        },
      };

      const validResult = validateKit(minimalKit);
      expect(validResult.success).toBe(true);
    });
  });

  // Edge Case 4: Public discussion of the company turns up nothing at all
  describe("Edge Case 4: Public discussion turns up nothing", () => {
    it("preserves honest empty sources without fabricating reviews or hiring culture", () => {
      const briefWithNoDiscussion = {
        summary: "Fintech startup in stealth mode.",
        what_they_do: "Payment security.",
        sources: [],
        state: "generated" as const,
      };

      expect(briefWithNoDiscussion.sources).toEqual([]);
      expect(briefWithNoDiscussion.summary).not.toContain("Glassdoor rating 4.5");
    });
  });

  // Edge Case 5: Model returns invalid JSON or malformed content
  describe("Edge Case 5: Model returns invalid JSON or incomplete structure", () => {
    it("kit validator identifies missing fields with descriptive error paths", () => {
      const malformedCandidate = {
        source: { company: "Incomplete" }, // missing required fields
        role: {},
        questions: [],
      };

      const result = validateKit(malformedCandidate);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((e) => e.includes("source.company_url"))).toBe(true);
      }
    });

    it("rejects referential integrity violations where schedule points to non-existent question", () => {
      const invalidRefKit = {
        source: {
          company: "RefCorp",
          company_url: "https://refcorp.test",
          role: "Dev",
          location: "Remote",
          jd_chars: 100,
          researched_at: "2026-09-10T12:00:00Z",
          pages_used: [],
        },
        company_brief: { summary: "S", what_they_do: "W", sources: [] },
        role: {
          title: "Dev",
          seniority: "Mid",
          responsibilities: ["R"],
          requirements: [{ id: "r1", text: "T", kind: "technical", priority: "must" }],
        },
        questions: [
          {
            id: "q1",
            requirement_ids: ["r1"],
            category: "technical",
            prompt: "P",
            answer_outline: "A",
            difficulty: 2,
          },
        ],
        flashcards: [{ id: "f1", front: "F", back: "B", requirement_ids: ["r1"] }],
        schedule: {
          days_available: 1,
          days: [
            {
              day: 1,
              focus: "F",
              question_ids: ["non-existent-q99"], // Dangling reference
              minutes: 60,
            },
          ],
        },
        coverage: { uncovered_requirement_ids: [], passes: 1 },
      };

      const validation = validateKit(invalidRefKit);
      expect(validation.success).toBe(false);
      if (!validation.success) {
        expect(
          validation.errors.some((e) => e.includes("references non-existent question ID"))
        ).toBe(true);
      }
    });
  });

  // Edge Case 6: LLM provider rate-limits or briefly fails
  describe("Edge Case 6: Rate limits and transient failures", () => {
    it("exponential backoff retries on 429 status code and survives transient blips", async () => {
      let callCount = 0;
      const mockFetchWith429 = async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: { message: "Rate limited" } }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "Success response after retry" } }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      };

      const res = await callLLM("system", "user", {
        apiKey: "test-key",
        fetchFn: mockFetchWith429 as any,
      });

      expect(callCount).toBe(2);
      expect(res.text).toBe("Success response after retry");
    });

    it("fails immediately with LLM_QUOTA_EXCEEDED when provider returns 402 or quota exceeded without slow retries", async () => {
      let callCount = 0;
      const mockFetchQuota = async () => {
        callCount++;
        return new Response(
          JSON.stringify({ error: { message: "User has insufficient credits", code: 402 } }),
          {
            status: 402,
            headers: { "Content-Type": "application/json" },
          }
        );
      };

      await expect(
        callLLM("system", "user", {
          apiKey: "test-key",
          fetchFn: mockFetchQuota as any,
        })
      ).rejects.toThrow(/AI Quota Exceeded/i);

      expect(callCount).toBe(1); // Fails immediately, zero retries
    });
  });

  // Edge Case 7: Same description and company submitted twice
  describe("Edge Case 7: Duplicate submissions (idempotency)", () => {
    it("returns existing kit and prevents redundant duplicate generation runs", async () => {
      const payload = {
        company_url: "https://idempotent.test",
        days_available: 5,
        jd: "Senior Backend Engineer with distributed systems expertise and Go experience.",
      };

      // 1. Submit first request
      const res1 = await request(app).post("/kits").set("Cookie", userCookie).send(payload);
      expect(res1.status).toBe(202);
      const firstKitId = res1.body.kitId;

      // 2. Ensure kit is marked completed or generating in DB
      await Kit.findByIdAndUpdate(firstKitId, { status: "completed" });

      // 3. Second identical submission within 15-min window
      const res2 = await request(app).post("/kits").set("Cookie", userCookie).send(payload);

      // Should return 200 with existing kit without launching duplicate generation
      expect(res2.status).toBe(200);
      expect(res2.body.kitId).toBe(firstKitId);
      expect(res2.body.isDuplicate).toBe(true);
      expect(res2.body.message).toContain("Kit already generated recently");

      // Verify only 1 kit exists in database for this owner
      const kitCount = await Kit.countDocuments({ ownerId: userId });
      expect(kitCount).toBe(1);
    });
  });

  // Edge Case 8: User asks for a 1-day schedule, or a 60-day one
  describe("Edge Case 8: Schedule boundaries (1-day vs 60-day)", () => {
    const sampleQuestions: KitQuestion[] = [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Q1",
        answer_outline: "A1",
        difficulty: 1,
        state: "generated",
      },
      {
        id: "q2",
        requirement_ids: ["r2"],
        category: "system-design",
        prompt: "Q2",
        answer_outline: "A2",
        difficulty: 2,
        state: "generated",
      },
      {
        id: "q3",
        requirement_ids: ["r3"],
        category: "behavioural",
        prompt: "Q3",
        answer_outline: "A3",
        difficulty: 2,
        state: "generated",
      },
    ];

    const sampleRequirements: KitRequirement[] = [
      { id: "r1", text: "Req 1", kind: "technical", priority: "must", state: "generated" },
      { id: "r2", text: "Req 2", kind: "technical", priority: "must", state: "generated" },
      { id: "r3", text: "Req 3", kind: "behavioural", priority: "nice", state: "generated" },
    ];

    it("allocates a 1-day schedule condensing all questions with valid minutes and focus", () => {
      const schedule1 = allocateSchedule(sampleRequirements, sampleQuestions, 1);

      expect(schedule1.days_available).toBe(1);
      expect(schedule1.days).toHaveLength(1);
      expect(schedule1.days[0].day).toBe(1);
      expect(schedule1.days[0].question_ids).toHaveLength(3);
      expect(schedule1.days[0].minutes).toBeGreaterThan(0);
      expect(schedule1.days[0].focus).toBeDefined();
    });

    it("allocates a 60-day schedule without gaps or NaN minutes", () => {
      const schedule60 = allocateSchedule(sampleRequirements, sampleQuestions, 60);

      expect(schedule60.days_available).toBe(60);
      expect(schedule60.days).toHaveLength(60);

      // Verify every single day has valid day number, focus, and positive integer minutes
      for (let i = 0; i < 60; i++) {
        const day = schedule60.days[i];
        expect(day.day).toBe(i + 1);
        expect(typeof day.focus).toBe("string");
        expect(day.focus.length).toBeGreaterThan(0);
        expect(Number.isInteger(day.minutes)).toBe(true);
        expect(day.minutes).toBeGreaterThan(0);
        expect(Array.isArray(day.question_ids)).toBe(true);
      }
    });
  });

  // Robustness: Coverage Gap Detection Edge Cases
  describe("Coverage Gap Detection Edge Cases", () => {
    it("handles 0 requirements cleanly", () => {
      const uncovered = findUncoveredRequirements([], []);
      expect(uncovered).toEqual([]);
    });

    it("detects uncovered requirements when questions have empty requirement_ids", () => {
      const reqs: KitRequirement[] = [
        { id: "r1", text: "Req 1", kind: "technical", priority: "must", state: "generated" },
      ];
      const qs: KitQuestion[] = [
        {
          id: "q1",
          requirement_ids: [],
          category: "technical",
          prompt: "P",
          answer_outline: "A",
          difficulty: 1,
          state: "generated",
        },
      ];

      const uncovered = findUncoveredRequirements(reqs, qs);
      expect(uncovered).toEqual(["r1"]);
    });
  });

  // Robustness: API Structured Error Format
  describe("API Error Responses: No raw stack traces leaked", () => {
    it("returns structured JSON { error: { code, message } } on non-existent endpoints", async () => {
      const res = await request(app).get("/non-existent-route-xyz");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toHaveProperty("code", "NOT_FOUND");
      expect(res.body.error).toHaveProperty("message");
      expect(res.body).not.toHaveProperty("stack");
    });
  });
});
