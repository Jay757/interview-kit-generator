import { callLLM } from "../llm/client.js";
import { LLMError } from "../llm/types.js";
import {
  cleanJsonString,
  CompanyBriefCandidate,
  CompanyBriefCandidateSchema,
  ExtractionOptions,
} from "./types.js";

const NO_INFO_FALLBACK: CompanyBriefCandidate = {
  summary: "No public company information found.",
  what_they_do: "No public company information found.",
};

const SYSTEM_PROMPT = `You are an expert company intelligence analyst.
Your task is to summarize what a company does and provide a high-level briefing based strictly on the retrieved website texts.

Strict Rules:
1. Grounding: Rely ONLY on the provided text in the <source> blocks. Do NOT hallucinate, assume, or fabricate company products, business models, or history that are not in the text.
2. If the text provides minimal details, give a concise, grounded factual summary of what is mentioned.
3. Return strictly a JSON object with this exact schema:
{
  "summary": "Concise 1-3 sentence overview of the company, mission, and current focus",
  "what_they_do": "Clear, grounded description of their primary product, services, or core technology"
}
Do not return markdown wrappers, explanations, or any extra text.`;

/**
 * Extracts a grounded company brief ({ summary, what_they_do }) from crawled about and hiring pages.
 * If both inputs are empty or missing, returns an honest no-info fallback directly without calling the LLM.
 */
export async function extractCompanyBrief(
  aboutText: string | null | undefined,
  hiringText: string | null | undefined,
  options: ExtractionOptions = {}
): Promise<CompanyBriefCandidate> {
  const cleanAbout = (aboutText || "").trim();
  const cleanHiring = (hiringText || "").trim();

  // If no content was retrieved by the crawler, never call the LLM to hallucinate
  if (!cleanAbout && !cleanHiring) {
    return { ...NO_INFO_FALLBACK };
  }

  const caller = options.llmCaller ?? callLLM;

  const userPrompt = `Extract the company brief from the following retrieved pages:

${cleanAbout ? `<source label="about-pages">\n${cleanAbout}\n</source>` : ""}
${cleanHiring ? `<source label="hiring-pages">\n${cleanHiring}\n</source>` : ""}`;

  let rawResponse = await caller(SYSTEM_PROMPT, userPrompt, { jsonMode: true });
  let candidate: CompanyBriefCandidate;

  try {
    candidate = parseAndValidateBrief(rawResponse.text);
  } catch (firstErr: any) {
    const correctivePrompt = `Your previous response was invalid: ${firstErr.message || "Invalid JSON or schema mismatch"}.
Please correct it now. Return ONLY a valid JSON object matching the exact schema:
{
  "summary": "string (min 5 chars)",
  "what_they_do": "string (min 5 chars)"
}

Source text:
${cleanAbout ? `<source label="about-pages">\n${cleanAbout}\n</source>` : ""}
${cleanHiring ? `<source label="hiring-pages">\n${cleanHiring}\n</source>` : ""}`;

    try {
      const retryResponse = await caller(SYSTEM_PROMPT, correctivePrompt, { jsonMode: true });
      candidate = parseAndValidateBrief(retryResponse.text);
    } catch (retryErr: any) {
      throw new LLMError(
        `LLM output was invalid after corrective retry: ${retryErr.message}`,
        "LLM_INVALID_OUTPUT",
        422,
        { original: rawResponse.text, error: retryErr.message }
      );
    }
  }

  return candidate;
}

function parseAndValidateBrief(rawText: string): CompanyBriefCandidate {
  const cleaned = cleanJsonString(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    throw new Error(`JSON parse failure: ${err.message}`);
  }

  const result = CompanyBriefCandidateSchema.safeParse(parsed);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Schema validation failed: ${errorDetails}`);
  }

  return result.data;
}
