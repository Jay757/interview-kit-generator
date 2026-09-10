import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import fs from "fs";
import path from "path";
import {
  parseCliArgs,
  runBatchEvaluation,
  EvaluationBatchOutput,
} from "../src/cli/evaluate.js";
import { validateKit } from "../src/validation/kitValidator.js";

describe("Phase 9 Batch Evaluation CLI", () => {
  let server: http.Server;
  let serverPort: number;
  let serverBaseUrl: string;

  const tempDir = path.resolve(process.cwd(), "tmp/test-eval");
  const fixtureInputPath = path.join(tempDir, "cases.json");
  const fixtureOutputPath = path.join(tempDir, "kits.json");

  beforeAll(async () => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Spin up local HTTP server simulating grader's local company site
    server = http.createServer((req, res) => {
      const url = req.url || "/";

      if (url === "/robots.txt") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("User-agent: *\nAllow: /\n");
        return;
      }

      // Main company entry point with relative links
      if (url === "/acme/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Acme Corporation</title></head>
            <body>
              <h1>Welcome to Acme</h1>
              <p>We build resilient distributed systems for global logistics.</p>
              <a href="careers/engineering">Join our Engineering Team</a>
              <a href="about/mission">About Our Mission</a>
            </body>
          </html>
        `);
        return;
      }

      // Relative hiring page linked from /acme/
      if (url === "/acme/careers/engineering") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Acme Engineering Hiring</title></head>
            <body>
              <h2>Interview Process</h2>
              <p>Candidates go through a 45-min live coding session, a distributed systems design whiteboard, and an architectural deep dive.</p>
            </body>
          </html>
        `);
        return;
      }

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
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const mockLLMCaller = async (systemPrompt: string, userPrompt: string) => {
    // Requirements extraction
    if (systemPrompt.includes("extract atomic requirements")) {
      return {
        text: JSON.stringify([
          {
            text: "5+ years of distributed backend systems with Node.js/Go",
            kind: "technical",
            priority: "must",
          },
          {
            text: "Demonstrated ability to mentor engineers through technical design docs",
            kind: "behavioural",
            priority: "nice",
          },
        ]),
      };
    }

    // Company brief extraction
    if (systemPrompt.includes("expert company intelligence analyst")) {
      return {
        text: JSON.stringify({
          summary: "Acme delivers high-scale logistics automation software.",
          what_they_do: "Cloud supply chain orchestration and routing engines.",
        }),
      };
    }

    // Questions
    if (systemPrompt.includes("interviewer")) {
      return {
        text: JSON.stringify([
          {
            category: "technical",
            prompt: "How do you handle head-of-line blocking in distributed message queues?",
            answer_outline: "Discuss partitioned consumer groups, dead letter queues, backpressure.",
            difficulty: 3,
          },
        ]),
      };
    }

    // Flashcards
    if (systemPrompt.includes("flashcard")) {
      return {
        text: JSON.stringify([
          {
            front: "What pattern prevents HOL blocking in consumer groups?",
            back: "Key-based topic partitioning and separate failure queues.",
          },
        ]),
      };
    }

    return { text: "[]" };
  };

  describe("CLI Argument Parsing", () => {
    it("parses --input and --output arguments correctly", () => {
      const parsed = parseCliArgs([
        "--input",
        "path/to/cases.json",
        "--output",
        "path/to/kits.json",
      ]);
      expect(parsed.inputPath).toBe("path/to/cases.json");
      expect(parsed.outputPath).toBe("path/to/kits.json");
    });

    it("parses short flags -i and -o correctly", () => {
      const parsed = parseCliArgs(["-i", "cases.json", "-o", "kits.json"]);
      expect(parsed.inputPath).toBe("cases.json");
      expect(parsed.outputPath).toBe("kits.json");
    });

    it("parses equals syntax --input=... and --output=...", () => {
      const parsed = parseCliArgs([
        "--input=cases.json",
        "--output=kits.json",
      ]);
      expect(parsed.inputPath).toBe("cases.json");
      expect(parsed.outputPath).toBe("kits.json");
    });
  });

  describe("Batch Evaluation Execution & Appendix B Conformance", () => {
    it("runs batch evaluation, resolves local server relative links, isolates failure, and outputs valid Appendix B format", async () => {
      // 3 test cases:
      // 1. Normal case with local server URL
      // 2. Thin JD case without company URL
      // 3. Deliberately failing case (empty JD)
      const inputCases = [
        {
          id: "case-01-acme",
          jd: "Senior Backend Engineer\nLocation: Remote\n5+ years with Node.js and distributed systems.",
          company_url: `${serverBaseUrl}/acme/`,
          days: 5,
        },
        {
          id: "case-02-thin",
          jd: "Frontend Engineer\nMust know React and TypeScript.",
          days: 3,
        },
        {
          id: "case-03-invalid",
          jd: "", // Deliberate failure
          company_url: "https://invalid.example.com",
          days: 5,
        },
      ];

      fs.writeFileSync(fixtureInputPath, JSON.stringify(inputCases, null, 2), "utf-8");

      const output = await runBatchEvaluation(fixtureInputPath, fixtureOutputPath, {
        llmCaller: mockLLMCaller,
        allowLocalFetch: true,
      });

      // 1. Verify Appendix B top-level schema
      expect(output.version).toBe("1.0");
      expect(output.generated_at).toBeDefined();
      expect(new Date(output.generated_at).toISOString()).toBe(output.generated_at);
      expect(output.kits.length).toBe(3);

      // 2. Verify Case 1 (Happy path + local crawler relative link)
      const case1 = output.kits.find((k) => k.id === "case-01-acme")!;
      expect(case1).toBeDefined();
      expect(case1.status).toBe("ok");
      expect(case1.error).toBeNull();
      expect(case1.kit).not.toBeNull();
      expect(validateKit(case1.kit).success).toBe(true);
      // Verify local crawler discovered relative link
      expect(case1.kit!.source.pages_used).toContain(`${serverBaseUrl}/acme/careers/engineering`);
      expect(case1.kit!.company_brief.sources).toContain(`${serverBaseUrl}/acme/careers/engineering`);

      // 3. Verify Case 2 (Thin JD without company URL)
      const case2 = output.kits.find((k) => k.id === "case-02-thin")!;
      expect(case2).toBeDefined();
      expect(case2.status).toBe("ok");
      expect(case2.error).toBeNull();
      expect(case2.kit).not.toBeNull();
      expect(validateKit(case2.kit).success).toBe(true);
      expect(case2.kit!.source.pages_used).toEqual([]);

      // 4. Verify Case 3 (Failing case handled honestly without stopping the batch)
      const case3 = output.kits.find((k) => k.id === "case-03-invalid")!;
      expect(case3).toBeDefined();
      expect(case3.status).toBe("failed");
      expect(case3.kit).toBeNull();
      expect(case3.error).not.toBeNull();
      expect(case3.error!.code).toBe("EMPTY_JOB_DESCRIPTION");

      // 5. Verify physical output file on disk matches byte-for-byte in structure
      expect(fs.existsSync(fixtureOutputPath)).toBe(true);
      const writtenOutput: EvaluationBatchOutput = JSON.parse(
        fs.readFileSync(fixtureOutputPath, "utf-8")
      );
      expect(writtenOutput.version).toBe("1.0");
      expect(writtenOutput.kits.length).toBe(3);
    });
  });
});
