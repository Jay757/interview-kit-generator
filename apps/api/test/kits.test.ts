import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Kit } from "../src/models/Kit.js";
import { KitStructure } from "../src/types/kit.js";

const TEST_MONGODB_URI =
  process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/trao_test_kits";

const createValidKitPayload = (): KitStructure => ({
  source: {
    company: "Stripe",
    company_url: "https://stripe.com",
    role: "Staff Infrastructure Engineer",
    location: "San Francisco, CA",
    jd_chars: 2100,
    researched_at: "2026-09-10T14:30:00Z",
    pages_used: ["https://stripe.com/jobs", "https://stripe.com/about"],
  },
  company_brief: {
    summary: "Financial infrastructure platform for the internet.",
    what_they_do: "Global economic payment processing and developer APIs.",
    sources: ["https://stripe.com/about"],
  },
  role: {
    title: "Staff Infrastructure Engineer",
    seniority: "Staff",
    responsibilities: ["Scale core ledgers to millions of TPS", "Automate chaos testing"],
    requirements: [
      {
        id: "r1",
        text: "Deep expertise with distributed consensus (Raft/Paxos)",
        kind: "technical",
        priority: "must",
      },
      {
        id: "r2",
        text: "Demonstrated technical leadership across org boundaries",
        kind: "behavioural",
        priority: "must",
      },
    ],
  },
  questions: [
    {
      id: "q1",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "How would you design a distributed lock service resilient to network partitions?",
      answer_outline: "Discuss leases, fencing tokens, heartbeat timeouts, split-brain avoidance.",
      difficulty: 3,
    },
    {
      id: "q2",
      requirement_ids: ["r2"],
      category: "behavioural",
      prompt: "Walk through a disagreement over architectural direction with a partner team.",
      answer_outline: "Principles-first evaluation, data-driven compromise, disagree-and-commit.",
      difficulty: 2,
    },
  ],
  flashcards: [
    {
      id: "f1",
      front: "Why are fencing tokens required with distributed locks?",
      back: "To prevent stale lock holders delayed by GC pauses from performing illegal writes.",
      requirement_ids: ["r1"],
    },
  ],
  schedule: {
    days_available: 2,
    days: [
      {
        day: 1,
        focus: "Distributed Consensus & Partitioning",
        question_ids: ["q1"],
        minutes: 60,
      },
      {
        day: 2,
        focus: "Leadership Dynamics & Synthesis",
        question_ids: ["q2"],
        minutes: 45,
      },
    ],
  },
  coverage: {
    uncovered_requirement_ids: [],
    passes: 1,
  },
});

describe("Kit Model & Owner-Scoped CRUD API", () => {
  let app: ReturnType<typeof createApp>;
  let userACookie: string[];
  let userBCookie: string[];
  let userAId: string;
  let userBId: string;

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

    // Register User A
    const resA = await request(app).post("/auth/register").send({
      email: "usera@example.com",
      password: "password12345",
    });
    userACookie = resA.headers["set-cookie"];
    userAId = resA.body.user.id;

    // Register User B
    const resB = await request(app).post("/auth/register").send({
      email: "userb@example.com",
      password: "password12345",
    });
    userBCookie = resB.headers["set-cookie"];
    userBId = resB.body.user.id;
  });

  it("POST /kits requires authentication (returns 401)", async () => {
    const res = await request(app)
      .post("/kits")
      .send(createValidKitPayload());

    expect(res.status).toBe(401);
  });

  it("POST /kits rejects malformed kits with 400 and validation details", async () => {
    const invalidKit: any = createValidKitPayload();
    delete invalidKit.source; // missing required section

    const res = await request(app)
      .post("/kits")
      .set("Cookie", userACookie)
      .send(invalidKit);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_KIT_STRUCTURE");
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it("POST /kits persists a valid kit and associates ownerId", async () => {
    const payload = createValidKitPayload();
    const res = await request(app)
      .post("/kits")
      .set("Cookie", userACookie)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.kit._id).toBeDefined();
    expect(res.body.kit.ownerId).toBe(userAId);
    expect(res.body.kit.source.company).toBe("Stripe");
    expect(res.body.kit.status).toBe("completed");

    // Verify item default states are 'generated'
    expect(res.body.kit.role.requirements[0].state).toBe("generated");
    expect(res.body.kit.questions[0].state).toBe("generated");
  });

  it("GET /kits returns only the current authenticated user's kits", async () => {
    // User A creates 2 kits
    await request(app)
      .post("/kits")
      .set("Cookie", userACookie)
      .send(createValidKitPayload());

    await request(app)
      .post("/kits")
      .set("Cookie", userACookie)
      .send(createValidKitPayload());

    // User B creates 1 kit
    await request(app)
      .post("/kits")
      .set("Cookie", userBCookie)
      .send(createValidKitPayload());

    // User A fetches kits
    const resA = await request(app).get("/kits").set("Cookie", userACookie);
    expect(resA.status).toBe(200);
    expect(resA.body.kits.length).toBe(2);

    // User B fetches kits
    const resB = await request(app).get("/kits").set("Cookie", userBCookie);
    expect(resB.status).toBe(200);
    expect(resB.body.kits.length).toBe(1);
  });

  it("GET /kits/:id round-trips persisted kit for owner", async () => {
    const createRes = await request(app)
      .post("/kits")
      .set("Cookie", userACookie)
      .send(createValidKitPayload());

    const kitId = createRes.body.kit._id;

    const getRes = await request(app)
      .get(`/kits/${kitId}`)
      .set("Cookie", userACookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body.kit._id).toBe(kitId);
    expect(getRes.body.kit.source.company).toBe("Stripe");
    expect(getRes.body.kit.questions.length).toBe(2);
  });

  it("GET /kits/:id returns 403 when User B attempts to access User A's kit", async () => {
    const createRes = await request(app)
      .post("/kits")
      .set("Cookie", userACookie)
      .send(createValidKitPayload());

    const kitId = createRes.body.kit._id;

    // User B tries to access User A's kit
    const getRes = await request(app)
      .get(`/kits/${kitId}`)
      .set("Cookie", userBCookie);

    expect(getRes.status).toBe(403);
    expect(getRes.body.error.code).toBe("FORBIDDEN");
  });

  it("DELETE /kits/:id returns 403 when User B attempts to delete User A's kit", async () => {
    const createRes = await request(app)
      .post("/kits")
      .set("Cookie", userACookie)
      .send(createValidKitPayload());

    const kitId = createRes.body.kit._id;

    // User B tries to delete User A's kit
    const deleteRes = await request(app)
      .delete(`/kits/${kitId}`)
      .set("Cookie", userBCookie);

    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body.error.code).toBe("FORBIDDEN");

    // Verify kit still exists
    const checkRes = await request(app)
      .get(`/kits/${kitId}`)
      .set("Cookie", userACookie);
    expect(checkRes.status).toBe(200);
  });

  it("DELETE /kits/:id successfully removes kit for owner", async () => {
    const createRes = await request(app)
      .post("/kits")
      .set("Cookie", userACookie)
      .send(createValidKitPayload());

    const kitId = createRes.body.kit._id;

    const deleteRes = await request(app)
      .delete(`/kits/${kitId}`)
      .set("Cookie", userACookie);

    expect(deleteRes.status).toBe(200);

    const checkRes = await request(app)
      .get(`/kits/${kitId}`)
      .set("Cookie", userACookie);
    expect(checkRes.status).toBe(404);
  });
});
