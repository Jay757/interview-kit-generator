import { describe, it, expect, vi } from "vitest";
import { extractRequirements } from "../src/pipeline/generation/extractRequirements.js";
import { extractCompanyBrief } from "../src/pipeline/generation/extractCompanyBrief.js";
import { callLLM } from "../src/pipeline/llm/client.js";
import { LLMError } from "../src/pipeline/llm/types.js";

describe("Phase 5: LLM Extraction (Requirements & Company Brief)", () => {
  const REALISTIC_JD = `
Job Title: Senior Backend Engineer (Node.js & Distributed Systems)
About Us: Acme Cloud is a high-throughput messaging platform.

Requirements & Qualifications:
- 5+ years building production web services in Node.js and TypeScript (Required)
- Deep proficiency with PostgreSQL schema design, indexing, and query optimization (Required)
- Demonstrated experience designing resilient distributed systems and message queues like Kafka or RabbitMQ (Must have)
- Strong team collaboration and cross-functional communication skills (Required)

Preferred & Nice-to-Have:
- Experience deploying and managing workloads on Kubernetes (Nice to have)
- Prior exposure to Go or Rust for high-performance microservices (Bonus)
- Familiarity with FinTech compliance standards like SOC2 or PCI-DSS (Preferred)
`;

  const THIN_JD = `
Looking for a Senior TypeScript Engineer.
Must have 4+ years of professional Node.js and React experience.
`;

  describe("extractRequirements", () => {
    it("extracts requirements from realistic JD with correct must/nice split and assigns stable r1, r2 IDs", async () => {
      const mockLLM = vi.fn().mockResolvedValue({
        model: "mock-gemini",
        text: JSON.stringify([
          {
            text: "5+ years building production web services in Node.js and TypeScript",
            kind: "technical",
            priority: "must",
          },
          {
            text: "Deep proficiency with PostgreSQL schema design, indexing, and query optimization",
            kind: "technical",
            priority: "must",
          },
          {
            text: "Demonstrated experience designing resilient distributed systems and message queues (Kafka/RabbitMQ)",
            kind: "technical",
            priority: "must",
          },
          {
            text: "Strong team collaboration and cross-functional communication skills",
            kind: "behavioural",
            priority: "must",
          },
          {
            text: "Experience deploying and managing workloads on Kubernetes",
            kind: "technical",
            priority: "nice",
          },
          {
            text: "Prior exposure to Go or Rust for high-performance microservices",
            kind: "technical",
            priority: "nice",
          },
          {
            text: "Familiarity with FinTech compliance standards like SOC2 or PCI-DSS",
            kind: "domain",
            priority: "nice",
          },
        ]),
      });

      const requirements = await extractRequirements(REALISTIC_JD, { llmCaller: mockLLM });

      expect(mockLLM).toHaveBeenCalledTimes(1);
      expect(requirements).toHaveLength(7);

      // Verify stable sequential IDs and state: "generated"
      expect(requirements[0].id).toBe("r1");
      expect(requirements[1].id).toBe("r2");
      expect(requirements[6].id).toBe("r7");
      expect(requirements.every((r) => r.state === "generated")).toBe(true);

      // Verify priority distribution
      const musts = requirements.filter((r) => r.priority === "must");
      const nices = requirements.filter((r) => r.priority === "nice");
      expect(musts).toHaveLength(4);
      expect(nices).toHaveLength(3);

      // Verify kinds
      expect(requirements.some((r) => r.kind === "behavioural")).toBe(true);
      expect(requirements.some((r) => r.kind === "domain")).toBe(true);
      expect(requirements.some((r) => r.kind === "technical")).toBe(true);
    });

    it("recovers gracefully when first LLM response is malformed JSON and retry succeeds", async () => {
      const mockLLM = vi
        .fn()
        // 1st attempt: malformed response with text garbage
        .mockResolvedValueOnce({
          model: "mock-gemini",
          text: "Here is your JSON: ```json [ { text: invalid_unquoted_json } ] ```",
        })
        // 2nd attempt: valid corrected JSON
        .mockResolvedValueOnce({
          model: "mock-gemini",
          text: JSON.stringify([
            {
              text: "Node.js and TypeScript expertise",
              kind: "technical",
              priority: "must",
            },
          ]),
        });

      const requirements = await extractRequirements(REALISTIC_JD, { llmCaller: mockLLM });

      expect(mockLLM).toHaveBeenCalledTimes(2);
      expect(requirements).toHaveLength(1);
      expect(requirements[0].id).toBe("r1");
      expect(requirements[0].text).toBe("Node.js and TypeScript expertise");
      expect(requirements[0].priority).toBe("must");
    });

    it("throws typed LLM_INVALID_OUTPUT when LLM repeatedly returns invalid schema", async () => {
      const mockLLM = vi.fn().mockResolvedValue({
        model: "mock-gemini",
        // Valid JSON but invalid schema: missing priority and kind
        text: JSON.stringify([{ text: "Some skill" }]),
      });

      await expect(
        extractRequirements(REALISTIC_JD, { llmCaller: mockLLM })
      ).rejects.toThrowError(/LLM output was invalid after corrective retry/);

      expect(mockLLM).toHaveBeenCalledTimes(2);
    });

    it("produces a proportionally thin, grounded requirement list from a 2-line JD", async () => {
      const mockLLM = vi.fn().mockResolvedValue({
        model: "mock-gemini",
        text: JSON.stringify([
          {
            text: "4+ years of professional Node.js and React experience",
            kind: "technical",
            priority: "must",
          },
        ]),
      });

      const requirements = await extractRequirements(THIN_JD, { llmCaller: mockLLM });

      expect(mockLLM).toHaveBeenCalledTimes(1);
      expect(requirements).toHaveLength(1);
      expect(requirements[0].id).toBe("r1");
      expect(requirements[0].priority).toBe("must");
      expect(requirements[0].text).toContain("Node.js and React");
    });

    it("rejects immediately with LLM_INVALID_OUTPUT on empty job description without calling LLM", async () => {
      const mockLLM = vi.fn();

      await expect(
        extractRequirements("   ", { llmCaller: mockLLM })
      ).rejects.toThrowError(/Cannot extract requirements from an empty job description/);

      expect(mockLLM).not.toHaveBeenCalled();
    });
  });

  describe("extractCompanyBrief", () => {
    it("returns honest no-info brief directly in code without calling LLM when crawl input is empty", async () => {
      const mockLLM = vi.fn();

      const result1 = await extractCompanyBrief("", "", { llmCaller: mockLLM });
      const result2 = await extractCompanyBrief(null, null, { llmCaller: mockLLM });
      const result3 = await extractCompanyBrief("   ", undefined, { llmCaller: mockLLM });

      expect(mockLLM).not.toHaveBeenCalled();
      expect(result1.summary).toBe("No public company information found.");
      expect(result1.what_they_do).toBe("No public company information found.");
      expect(result2.summary).toBe("No public company information found.");
      expect(result3.what_they_do).toBe("No public company information found.");
    });

    it("extracts grounded company brief when about and hiring text are present", async () => {
      const mockLLM = vi.fn().mockResolvedValue({
        model: "mock-gemini",
        text: JSON.stringify({
          summary: "Acme Cloud provides cloud-native observability infrastructure for fintech enterprises.",
          what_they_do: "Builds real-time telemetry streaming pipelines and metric ingestion engines.",
        }),
      });

      const brief = await extractCompanyBrief(
        "Acme Cloud empowers modern engineering teams with instant observability across hybrid clouds.",
        "We are hiring engineers to scale our distributed telemetry engine.",
        { llmCaller: mockLLM }
      );

      expect(mockLLM).toHaveBeenCalledTimes(1);
      expect(brief.summary).toContain("Acme Cloud");
      expect(brief.what_they_do).toContain("telemetry streaming");
    });
  });

  describe("callLLM Client & Error Handling", () => {
    it("throws LLM_CONFIG_MISSING when API key is missing", async () => {
      const prevOpenRouter = process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      try {
        await expect(callLLM("system", "user")).rejects.toThrowError(
          /OPENROUTER_API_KEY is missing/
        );
      } finally {
        if (prevOpenRouter) process.env.OPENROUTER_API_KEY = prevOpenRouter;
      }
    });

    it("formats and executes OpenRouter completions cleanly", async () => {
      let interceptedBody: any = null;
      let interceptedHeaders: any = null;

      const mockFetch = vi.fn().mockImplementation(async (_url: string, init: any) => {
        interceptedHeaders = init.headers;
        interceptedBody = JSON.parse(init.body);
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "{\"result\":\"ok\"}" } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const res = await callLLM("system rules", "extract something", {
        apiKey: "sk-or-v1-dummy-key",
        model: "google/gemini-2.5-flash",
        fetchFn: mockFetch as any,
        jsonMode: true,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(interceptedHeaders["Authorization"]).toBe("Bearer sk-or-v1-dummy-key");
      expect(interceptedBody.model).toBe("google/gemini-2.5-flash");
      expect(interceptedBody.response_format).toEqual({ type: "json_object" });
      expect(res.text).toBe("{\"result\":\"ok\"}");
      expect(res.usage?.totalTokens).toBe(15);
    });

    it("retries on 429 rate limit with exponential backoff and succeeds on subsequent attempt", async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: { message: "Resource exhausted" } }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "technical content" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const res = await callLLM("system prompt", "user prompt", {
        fetchFn: mockFetch as any,
        timeoutMs: 5000,
        maxRetries: 2,
        apiKey: "sk-or-v1-dummy-key",
      });

      expect(callCount).toBe(2);
      expect(res.text).toContain("technical");
    });
  });

  describe("Live OpenRouter Integration Test", () => {
    const hasKey = Boolean(process.env.OPENROUTER_API_KEY);

    it.skipIf(!hasKey)(
      "successfully calls live OpenRouter model when OPENROUTER_API_KEY is present",
      async () => {
        const result = await extractRequirements(
          "We are seeking a Backend Developer with strong experience in TypeScript, Node.js, and MongoDB.",
          {}
        );

        expect(result.length).toBeGreaterThanOrEqual(1);
        expect(result[0].id).toBe("r1");
        expect(["technical", "behavioural", "domain"]).toContain(result[0].kind);
        expect(["must", "nice"]).toContain(result[0].priority);
      },
      30000
    );
  });
});
