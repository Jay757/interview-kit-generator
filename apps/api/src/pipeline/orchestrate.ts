import { URL } from "url";
import { KitStructure } from "../types/kit.js";
import { assertValidKit } from "../validation/kitValidator.js";
import { crawlCompanySite, CrawlResult } from "./retrieval/index.js";
import {
  extractRequirements,
  extractCompanyBrief,
  generateAllQuestions,
  generateFlashcards,
} from "./generation/index.js";
import { runCoverageLoop } from "./coverage/index.js";
import { allocateSchedule } from "./schedule/index.js";
import { callLLM } from "./llm/client.js";

export type GenerationStage =
  | "retrieving"
  | "extracting"
  | "generating_questions"
  | "verifying_coverage"
  | "generating_flashcards"
  | "allocating_schedule"
  | "assembling_kit"
  | "completed";

export interface GenerateKitInput {
  jd: string;
  companyUrl?: string | null;
  days?: number;
  options?: {
    llmCaller?: typeof callLLM;
    allowLocalFetch?: boolean;
    onProgress?: (stage: GenerationStage) => void;
  };
}

/**
 * Extracts company name from website URL hostname.
 * Example: https://careers.stripe.com/jobs -> Stripe
 */
export function parseCompanyFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const parts = host.split(".");
    // Grab domain label (ignore subdomains if careers.xyz.com, or take first if xyz.com)
    const label = parts.length > 2 && parts[0] === "careers" ? parts[1] : parts[0];
    if (!label) return "";
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return "";
  }
}

/**
 * Deterministically parses role metadata (title, seniority, responsibilities, location)
 * from job description text without hallucinating facts.
 */
export function parseRoleMetadata(jdText: string): {
  title: string;
  seniority: string;
  responsibilities: string[];
  location: string;
  company: string;
} {
  const lines = jdText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let title = "";
  let seniority = "";
  let location = "";
  let company = "";
  const responsibilities: string[] = [];

  // Seniority detection keywords
  const seniorityPatterns = [
    { name: "Staff", regex: /\bstaff\b/i },
    { name: "Principal", regex: /\bprincipal\b/i },
    { name: "Lead", regex: /\blead\b/i },
    { name: "Senior", regex: /\bsenior\b/i },
    { name: "Junior", regex: /\bjunior\b/i },
    { name: "Entry", regex: /\bentry[- ]level\b/i },
    { name: "Intern", regex: /\bintern(ship)?\b/i },
    { name: "Mid-Level", regex: /\bmid[- ]level\b/i },
  ];

  // Try to find the title in the first 3 lines
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const line = lines[i];
    // Skip markdown titles or headers like "# Job Description" or "About Us"
    if (/^(#+\s*)?(job description|about us|careers|who we are)\b/i.test(line)) {
      continue;
    }
    const cleanLine = line.replace(/^(#+\s*|(role|title|position):\s*)/i, "").trim();
    if (cleanLine.length > 0 && !title) {
      title = cleanLine;
      break;
    }
  }

  if (!title) {
    title = "Target Role";
  }

  // Check seniority from title first, then early text
  for (const pat of seniorityPatterns) {
    if (pat.regex.test(title)) {
      seniority = pat.name;
      break;
    }
  }
  if (!seniority) {
    const earlyText = lines.slice(0, 8).join(" ");
    for (const pat of seniorityPatterns) {
      if (pat.regex.test(earlyText)) {
        seniority = pat.name;
        break;
      }
    }
  }

  // Location detection
  for (const line of lines.slice(0, 10)) {
    const locMatch = line.match(/(?:location|workplace|based in):\s*([^,.\n]+)/i);
    if (locMatch && locMatch[1]) {
      location = locMatch[1].trim();
      break;
    }
    if (/\b(remote|hybrid|on[- ]site)\b/i.test(line) && !location) {
      const match = line.match(/\b(remote|hybrid|on[- ]site)\b/i);
      if (match) {
        location = match[0].charAt(0).toUpperCase() + match[0].slice(1).toLowerCase();
      }
    }
  }

  // Company detection from early text
  for (const line of lines.slice(0, 5)) {
    const compMatch = line.match(/(?:company|at):\s*([A-Za-z0-9\s]+)/i);
    if (compMatch && compMatch[1]) {
      company = compMatch[1].trim();
      break;
    }
  }

  // Responsibilities extraction: scan for section
  let inResponsibilitiesSection = false;
  for (const line of lines) {
    if (/^(responsibilities|what you('ll| will) do|the role|your impact|duties):?/i.test(line)) {
      inResponsibilitiesSection = true;
      continue;
    }
    if (
      inResponsibilitiesSection &&
      /^(requirements|qualifications|skills|who you are|what you bring|benefits):?/i.test(line)
    ) {
      inResponsibilitiesSection = false;
      break;
    }

    if (inResponsibilitiesSection) {
      if (/^[-*•]\s+/.test(line)) {
        const item = line.replace(/^[-*•]\s+/, "").trim();
        if (item) responsibilities.push(item);
      } else if (/^\d+\.\s+/.test(line)) {
        const item = line.replace(/^\d+\.\s+/, "").trim();
        if (item) responsibilities.push(item);
      }
    }
  }

  return {
    title,
    seniority,
    responsibilities,
    location,
    company,
  };
}

/**
 * End-to-end kit generation pipeline.
 *
 * Sequence:
 * 1. Crawl company website (retrieving about & hiring signals)
 * 2. LLM Extraction (requirements from JD + company brief from crawl)
 * 3. Question Generation (per requirement/category)
 * 4. Coverage Loop (pure set logic gap detection + targeted follow-up generation)
 * 5. Flashcard Generation (high-yield spaced repetition cards)
 * 6. Schedule Allocation (pure arithmetic bin-packing across available days)
 * 7. Appendix A Assembly & Referential Integrity Validation
 */
export async function generateKit(input: GenerateKitInput): Promise<KitStructure> {
  const trimmedJd = (input.jd || "").trim();
  if (!trimmedJd) {
    throw new Error("A non-empty job description string ('jd') is required.");
  }

  const daysAvailable =
    typeof input.days === "number" && input.days >= 1 ? Math.floor(input.days) : 5;

  const onProgress = input.options?.onProgress;

  // 1. Crawl company site (Phase 4)
  onProgress?.("retrieving");
  let crawlResult: CrawlResult = {
    pagesUsed: [],
    pagesSkipped: [],
    aboutText: "",
    hiringText: null,
    publicDiscussionText: null,
  };

  if (input.companyUrl && input.companyUrl.trim()) {
    try {
      crawlResult = await crawlCompanySite(input.companyUrl.trim(), {
        allowLocal: input.options?.allowLocalFetch,
      });
    } catch (crawlErr) {
      console.warn(
        "Company crawl encountered an unhandled error, continuing with empty crawl:",
        crawlErr
      );
    }
  }

  // 2. Extract requirements from JD + grounded company brief (Phase 5)
  onProgress?.("extracting");
  const [requirements, briefCandidate] = await Promise.all([
    extractRequirements(trimmedJd, { llmCaller: input.options?.llmCaller }),
    extractCompanyBrief(crawlResult.aboutText, crawlResult.hiringText, {
      llmCaller: input.options?.llmCaller,
    }),
  ]);

  // 3. Generate initial questions per requirement & category (Phase 6)
  onProgress?.("generating_questions");
  const draftQuestions = await generateAllQuestions(
    requirements,
    crawlResult.hiringText,
    { llmCaller: input.options?.llmCaller }
  );

  // 4. Deterministic coverage verification loop (Phase 7)
  onProgress?.("verifying_coverage");
  const { questions: coveredQuestions, coverage } = await runCoverageLoop(
    requirements,
    draftQuestions,
    (uncovered) =>
      generateAllQuestions(uncovered, crawlResult.hiringText, {
        llmCaller: input.options?.llmCaller,
      })
  );

  // 5. Generate high-yield spaced repetition flashcards (Phase 6)
  onProgress?.("generating_flashcards");
  const flashcards = await generateFlashcards(coveredQuestions, {
    llmCaller: input.options?.llmCaller,
  });

  // 6. Deterministic schedule allocation (Phase 7)
  onProgress?.("allocating_schedule");
  const schedule = allocateSchedule(requirements, coveredQuestions, daysAvailable);

  // 7. Assemble final Kit object exactly matching Appendix A specifications
  onProgress?.("assembling_kit");
  const roleInfo = parseRoleMetadata(trimmedJd);
  const companyName =
    roleInfo.company ||
    (input.companyUrl ? parseCompanyFromUrl(input.companyUrl) : "") ||
    "Target Company";

  const rawKit: KitStructure = {
    source: {
      company: companyName,
      company_url: input.companyUrl ? input.companyUrl.trim() : "",
      role: roleInfo.title || "Target Role",
      location: roleInfo.location || "",
      jd_chars: trimmedJd.length,
      researched_at: new Date().toISOString(),
      pages_used: crawlResult.pagesUsed || [],
    },
    company_brief: {
      summary: briefCandidate.summary,
      what_they_do: briefCandidate.what_they_do,
      sources: crawlResult.pagesUsed || [],
    },
    role: {
      title: roleInfo.title || "Target Role",
      seniority: roleInfo.seniority || "",
      responsibilities: roleInfo.responsibilities,
      requirements,
    },
    questions: coveredQuestions,
    flashcards,
    schedule,
    coverage,
  };

  // 8. Strict structural validation against Appendix A schema
  const validatedKit = assertValidKit(rawKit);

  onProgress?.("completed");
  return validatedKit;
}
