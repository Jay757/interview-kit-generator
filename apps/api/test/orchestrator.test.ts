import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Kit } from "../src/models/Kit.js";
import { generateKit } from "../src/pipeline/orchestrate.js";
import { validateKit } from "../src/validation/kitValidator.js";

const TEST_MONGODB_URI =
  process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/trao_test_orchestration";

describe("Phase 8 Pipeline Orchestration & Async Kit Creation", () => {
  let server: http.Server;
  let serverPort: number;
  let serverBaseUrl: string;
  let app: ReturnType<typeof createApp>;
  let authCookie: string[];
  let userId: string;

  beforeAll(async () => {
    // 1. Connect test MongoDB
    process.env.MONGODB_URI = TEST_MONGODB_URI;
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
    app = createApp();

    // 2. Spin up local HTTP fixture server
    server = http.createServer((req, res) => {
      const url = req.url || "/";

      if (url === "/robots.txt") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("User-agent: *\nAllow: /\n");
        return;
      }

      if (url === "/hiring-corp/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>CloudScale Technologies</title></head>
            <body>
              <h1>Welcome to CloudScale</h1>
              <p>We build edge computation and distributed database infrastructure.</p>
              <a href="/hiring-corp/careers">Careers & Hiring Process</a>
            </body>
          </html>
        `);
        return;
      }

      if (url === "/hiring-corp/careers") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Careers at CloudScale</title></head>
            <body>
              <h2>Interview Process</h2>
              <p>Our interview consists of a technical screen, system design whiteboard, and values alignment.</p>
            </body>
          </html>
        `);
        return;
      }

      // Default 404
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as any;
        serverPort = address.port;
        serverBaseUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    await Kit.deleteMany({});
    await User.deleteMany({});

    // Register user for authenticated route tests
    const res = await request(app).post("/auth/register").send({
      email: "engineer@example.com",
      password: "securepassword123",
    });
    authCookie = res.headers["set-cookie"];
    userId = res.body.user.id;
  });

  const mockLLMCaller = async (systemPrompt: string, userPrompt: string) => {
    // 1. Requirements extraction
    if (systemPrompt.includes("extract atomic requirements")) {
      if (userPrompt.includes("Thin JD")) {
        return {
          text: JSON.stringify([
            {
              text: "Proficient with TypeScript",
              kind: "technical",
              priority: "must",
            },
          ]),
        };
      }

      return {
        text: JSON.stringify([
          {
            text: "Deep expertise in Node.js and TypeScript runtime architecture",
            kind: "technical",
            priority: "must",
          },
          {
            text: "Experience designing distributed consensus or caching topologies",
            kind: "technical",
            priority: "must",
          },
          {
            text: "Mentors junior engineers and drives architectural RFC reviews",
            kind: "behavioural",
            priority: "nice",
          },
        ]),
      };
    }

    // 2. Company brief extraction
    if (systemPrompt.includes("expert company intelligence analyst")) {
      if (userPrompt.includes("CloudScale")) {
        return {
          text: JSON.stringify({
            summary: "CloudScale Technologies delivers edge compute infrastructure.",
            what_they_do: "Global distributed database and serverless computing platform.",
          }),
        };
      }
      return {
        text: JSON.stringify({
          summary: "Modern software enterprise.",
          what_they_do: "Cloud software solutions.",
        }),
      };
    }

    // 3. Question generation
    if (systemPrompt.includes("interviewer")) {
      return {
        text: JSON.stringify([
          {
            category: "technical",
            prompt: "How would you diagnose an event loop lag spike in a distributed Node.js cluster?",
            answer_outline:
              "Use perf_hooks eventLoopUtilization, isolate synchronous crypto/regex blocking, offload to worker threads.",
            difficulty: 3,
          },
        ]),
      };
    }

    // 4. Flashcard distillation
    if (systemPrompt.includes("flashcard")) {
      return {
        text: JSON.stringify([
          {
            front: "What metric identifies Node.js event loop starvation?",
            back: "Event Loop Utilization (ELU) via perf_hooks.",
          },
        ]),
      };
    }

    return { text: "[]" };
  };

  describe("End-to-End generateKit Function", () => {
    it("generates a full valid kit for a normal JD + site with hiring page", async () => {
      const jd = `
Senior Distributed Systems Engineer
Location: Remote
Responsibilities:
- Architect multi-region state machines
- Lead technical design reviews

Requirements:
- 5+ years with Node.js and TypeScript
- Experience with distributed consensus
- Mentorship and cross-functional leadership
      `;

      const kit = await generateKit({
        jd,
        companyUrl: `${serverBaseUrl}/hiring-corp/`,
        days: 5,
        options: {
          llmCaller: mockLLMCaller,
          allowLocalFetch: true,
        },
      });

      // Strict Appendix A validation
      const validation = validateKit(kit);
      expect(validation.success).toBe(true);

      // Verify sources and crawl results
      expect(kit.source.company_url).toBe(`${serverBaseUrl}/hiring-corp/`);
      expect(kit.source.pages_used.length).toBeGreaterThan(0);
      expect(kit.source.pages_used).toContain(`${serverBaseUrl}/hiring-corp/careers`);
      expect(kit.company_brief.sources).toContain(`${serverBaseUrl}/hiring-corp/careers`);
      expect(kit.company_brief.summary).toContain("CloudScale");

      // Verify role and source location
      expect(kit.role.title).toBe("Senior Distributed Systems Engineer");
      expect(kit.role.seniority).toBe("Senior");
      expect(kit.source.location).toBe("Remote");
      expect(kit.role.responsibilities.length).toBeGreaterThan(0);
      expect(kit.role.requirements.length).toBe(3);

      // Verify questions, flashcards, schedule, and coverage
      expect(kit.questions.length).toBeGreaterThan(0);
      expect(kit.flashcards.length).toBeGreaterThan(0);
      expect(kit.schedule.days_available).toBe(5);
      expect(kit.schedule.days.length).toBe(5);
      expect(kit.coverage.passes).toBeGreaterThanOrEqual(1);
    });

    it("generates a valid, unpadded kit for a thin 2-line JD", async () => {
      const thinJd = `Software Developer\nThin JD: Must know TypeScript.`;

      const kit = await generateKit({
        jd: thinJd,
        days: 3,
        options: {
          llmCaller: mockLLMCaller,
          allowLocalFetch: true,
        },
      });

      const validation = validateKit(kit);
      expect(validation.success).toBe(true);
      expect(kit.role.requirements.length).toBe(1);
      expect(kit.role.requirements[0].text).toBe("Proficient with TypeScript");
      expect(kit.source.company_url).toBe("");
      expect(kit.source.pages_used).toEqual([]);
      expect(kit.schedule.days_available).toBe(3);
    });

    it("handles an unreachable/404 company URL honestly without crashing", async () => {
      const jd = `Backend Engineer\nMust know distributed messaging.`;

      const kit = await generateKit({
        jd,
        companyUrl: `${serverBaseUrl}/non-existent-company/`,
        days: 5,
        options: {
          llmCaller: mockLLMCaller,
          allowLocalFetch: true,
        },
      });

      const validation = validateKit(kit);
      expect(validation.success).toBe(true);
      // Pages used must be honestly empty
      expect(kit.source.pages_used).toEqual([]);
      expect(kit.company_brief.sources).toEqual([]);
      // Honest fallback brief per Rule 4
      expect(kit.company_brief.summary).toBe("No public company information found.");
      expect(kit.company_brief.what_they_do).toBe("No public company information found.");
    });
  });

  describe("Async POST /kits and Status Tracking", () => {
    it("returns 202 immediately with status: 'generating'", async () => {
      const res = await request(app)
        .post("/kits")
        .set("Cookie", authCookie)
        .send({
          jd: "Frontend Engineer with React and Next.js mastery",
          companyUrl: "https://stripe.com",
          days: 7,
        });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe("generating");
      expect(res.body.kitId).toBeDefined();

      // Check immediate status polling
      const statusRes = await request(app)
        .get(`/kits/${res.body.kitId}/status`)
        .set("Cookie", authCookie);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.status).toBe("generating");
      expect(statusRes.body.stage).toBeDefined();
    });

    it("prevents double-billing and duplicate runs via idempotency hash", async () => {
      const payload = {
        jd: "Senior Reliability Engineer with Kubernetes expertise",
        companyUrl: "https://datadog.com",
        days: 5,
      };

      // First submission
      const firstRes = await request(app)
        .post("/kits")
        .set("Cookie", authCookie)
        .send(payload);

      expect(firstRes.status).toBe(202);
      const originalKitId = firstRes.body.kitId;

      // Second identical submission within short window
      const secondRes = await request(app)
        .post("/kits")
        .set("Cookie", authCookie)
        .send(payload);

      expect(secondRes.status).toBe(202);
      expect(secondRes.body.kitId).toBe(originalKitId);
      expect(secondRes.body.isDuplicate).toBe(true);

      // Verify in DB that only one record was created
      const kitCount = await Kit.countDocuments({ ownerId: userId });
      expect(kitCount).toBe(1);
    });
  });
});
