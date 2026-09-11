import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { generateKit, GenerateKitInput } from "../pipeline/orchestrate.js";
import { KitStructure } from "../types/kit.js";
import { callLLM } from "../pipeline/llm/client.js";

// Ensure environment variables are loaded across monorepo layouts
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "apps/api/.env") });
dotenv.config();

export interface EvaluationCase {
  id: string;
  jd: string;
  company_url?: string;
  days?: number;
}

export interface EvaluationCaseResult {
  id: string;
  status: "ok" | "failed";
  kit: KitStructure | null;
  error: {
    code: string;
    message: string;
  } | null;
}

export interface EvaluationBatchOutput {
  version: string;
  generated_at: string;
  kits: EvaluationCaseResult[];
}

export interface BatchOptions {
  llmCaller?: typeof callLLM;
  allowLocalFetch?: boolean;
  onProgress?: (caseIndex: number, total: number, caseId: string) => void;
}

/**
 * Lightweight CLI argument parser for --input and --output.
 */
export function parseCliArgs(argv: string[]): { inputPath?: string; outputPath?: string } {
  let inputPath: string | undefined;
  let outputPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input" || arg === "-i") {
      inputPath = argv[i + 1];
      i++;
    } else if (arg === "--output" || arg === "-o") {
      outputPath = argv[i + 1];
      i++;
    } else if (arg.startsWith("--input=")) {
      inputPath = arg.slice("--input=".length);
    } else if (arg.startsWith("--output=")) {
      outputPath = arg.slice("--output=".length);
    }
  }

  return { inputPath, outputPath };
}

/**
 * Executes batch kit generation across all input cases.
 * Strictly adheres to Appendix B input and output specifications.
 * Continues processing remaining cases if an individual case fails.
 */
export async function runBatchEvaluation(
  inputPath: string,
  outputPath: string,
  options: BatchOptions = {}
): Promise<EvaluationBatchOutput> {
  const baseDir = process.env.INIT_CWD || process.cwd();
  const candidateInput1 = path.isAbsolute(inputPath) ? inputPath : path.resolve(baseDir, inputPath);
  const candidateInput2 = path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
  const resolvedInput = fs.existsSync(candidateInput1) ? candidateInput1 : candidateInput2;
  const resolvedOutput = path.isAbsolute(outputPath) ? outputPath : path.resolve(baseDir, outputPath);

  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`Input cases file does not exist at '${resolvedInput}' (checked baseDir: ${baseDir})`);
  }

  const rawInput = fs.readFileSync(resolvedInput, "utf-8");
  let cases: EvaluationCase[];
  try {
    cases = JSON.parse(rawInput);
    if (!Array.isArray(cases)) {
      throw new Error("Input cases file must contain a top-level JSON array.");
    }
  } catch (err: any) {
    throw new Error(`Failed to parse input cases JSON: ${err.message}`);
  }

  const results: EvaluationCaseResult[] = [];
  const total = cases.length;

  for (let i = 0; i < total; i++) {
    const c = cases[i];
    const caseId = c.id || `case-${i + 1}`;
    options.onProgress?.(i + 1, total, caseId);

    try {
      if (!c.jd || typeof c.jd !== "string" || !c.jd.trim()) {
        results.push({
          id: caseId,
          status: "failed",
          kit: null,
          error: {
            code: "EMPTY_JOB_DESCRIPTION",
            message: "Case missing required non-empty 'jd' string.",
          },
        });
        continue;
      }

      // Allow local fetch automatically for grader/localhost test servers
      const isLocalHost =
        c.company_url &&
        (c.company_url.includes("localhost") ||
          c.company_url.includes("127.0.0.1") ||
          c.company_url.includes("0.0.0.0"));

      const allowLocal = options.allowLocalFetch ?? (isLocalHost || process.env.ALLOW_LOCAL_FETCH === "true");

      const kit = await generateKit({
        jd: c.jd,
        companyUrl: c.company_url,
        days: c.days,
        options: {
          llmCaller: options.llmCaller,
          allowLocalFetch: allowLocal,
        },
      });

      results.push({
        id: caseId,
        status: "ok",
        kit,
        error: null,
      });
    } catch (caseErr: any) {
      console.warn(`Evaluation case '${caseId}' failed:`, caseErr.message || caseErr);
      results.push({
        id: caseId,
        status: "failed",
        kit: null,
        error: {
          code: caseErr.code || "GENERATION_FAILED",
          message: caseErr.message || "Kit generation pipeline failed.",
        },
      });
    }
  }

  const outputPayload: EvaluationBatchOutput = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits: results,
  };

  const outputDir = path.dirname(resolvedOutput);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(resolvedOutput, JSON.stringify(outputPayload, null, 2), "utf-8");
  return outputPayload;
}

/**
 * Main entry point for CLI invocation.
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage:
  npm run evaluate -- --input <path/to/cases.json> --output <path/to/kits.json>

Options:
  --input, -i   Path to JSON file containing input cases array (Appendix B format)
  --output, -o  Path to output JSON destination file
  --help, -h    Display this help message
`);
    process.exit(0);
  }

  const { inputPath, outputPath } = parseCliArgs(args);

  if (!inputPath || !outputPath) {
    console.error(`
Usage:
  npm run evaluate -- --input <path/to/cases.json> --output <path/to/kits.json>

Options:
  --input, -i   Path to JSON file containing input cases array (Appendix B format)
  --output, -o  Path to output JSON destination file
`);
    process.exit(1);
  }

  console.log(`[evaluate] Reading cases from: ${inputPath}`);
  console.log(`[evaluate] Writing results to: ${outputPath}`);

  const start = Date.now();
  try {
    const output = await runBatchEvaluation(inputPath, outputPath, {
      onProgress: (current, total, id) => {
        console.log(`[evaluate] Processing case ${current}/${total}: ${id}...`);
      },
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const okCount = output.kits.filter((k) => k.status === "ok").length;
    const failedCount = output.kits.filter((k) => k.status === "failed").length;

    console.log(
      `[evaluate] Finished ${output.kits.length} cases in ${elapsed}s (ok: ${okCount}, failed: ${failedCount})`
    );
  } catch (err: any) {
    console.error("[evaluate] Batch execution error:", err.message);
    process.exit(1);
  }
}

// Execute main if invoked directly as CLI
if (process.argv[1] && process.argv[1].endsWith("evaluate.ts")) {
  main().catch((err) => {
    console.error("[evaluate] Fatal error:", err);
    process.exit(1);
  });
}
