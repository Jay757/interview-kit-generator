import { Requirement } from "../../types/kit.js";
import { callLLM } from "../llm/client.js";
import { LLMError } from "../llm/types.js";
import {
  cleanJsonString,
  ExtractionOptions,
  RequirementCandidate,
  RequirementCandidateListSchema,
} from "./types.js";

const SYSTEM_PROMPT = `You are an expert technical interviewer and job requirements analyzer.
Your task is to extract atomic requirements from a provided job description.

Strict Rules:
1. Grounding: ONLY extract requirements explicitly stated in the source text. Never invent, hallucinate, or extrapolate qualifications that are not mentioned.
2. Thin JD: If the job description is brief (even just 1-3 lines), return ONLY the few requirements explicitly mentioned. Never pad or inflate the list.
3. For each requirement, assign:
   - "kind": exactly one of "technical", "behavioural", or "domain".
   - "priority": exactly one of "must" or "nice".
     * "must": mandatory, core qualifications, minimum experience, required degrees, or required competencies ("required", "must have", "minimum qualifications", "essential").
     * "nice": preferred, optional, or bonus qualifications ("nice to have", "bonus points", "preferred", "plus", "ideally").
     * "must" and "nice" are distinct signals. Do not confuse them.
4. Return strictly a JSON array of objects conforming to:
[
  {
    "text": "Specific requirement text",
    "kind": "technical" | "behavioural" | "domain",
    "priority": "must" | "nice"
  }
]
Do not return markdown wrappers, explanations, or any extra text.`;

/**
 * Extracts atomic requirements from a raw job description string with must/nice splitting,
 * assigning stable sequential IDs (r1, r2, ...) in code.
 */
export async function extractRequirements(
  jdText: string,
  options: ExtractionOptions = {}
): Promise<Requirement[]> {
  const trimmed = jdText.trim();
  if (!trimmed) {
    throw new LLMError(
      "Cannot extract requirements from an empty job description.",
      "LLM_INVALID_OUTPUT"
    );
  }

  const caller = options.llmCaller ?? callLLM;

  const userPrompt = `Extract the job requirements from the following job description:

<source>
${trimmed}
</source>`;

  let rawResponse = await caller(SYSTEM_PROMPT, userPrompt, { jsonMode: true });
  let candidates: RequirementCandidate[];

  try {
    candidates = parseAndValidateCandidates(rawResponse.text);
  } catch (firstErr: any) {
    // Retry once with corrective instruction
    const correctivePrompt = `Your previous response was invalid: ${firstErr.message || "Invalid JSON or schema mismatch"}.
Please correct it now. Return ONLY a valid JSON array of objects with the exact schema:
[
  {
    "text": "string (min 3 chars)",
    "kind": "technical" | "behavioural" | "domain",
    "priority": "must" | "nice"
  }
]

Original job description:
<source>
${trimmed}
</source>`;

    try {
      const retryResponse = await caller(SYSTEM_PROMPT, correctivePrompt, { jsonMode: true });
      candidates = parseAndValidateCandidates(retryResponse.text);
    } catch (retryErr: any) {
      throw new LLMError(
        `LLM output was invalid after corrective retry: ${retryErr.message}`,
        "LLM_INVALID_OUTPUT",
        422,
        { original: rawResponse.text, error: retryErr.message }
      );
    }
  }

  // Assign stable sequential IDs r1, r2, ... and state: "generated" in code
  return candidates.map((item, index) => ({
    id: `r${index + 1}`,
    text: item.text,
    kind: item.kind,
    priority: item.priority,
    state: "generated" as const,
  }));
}

function parseAndValidateCandidates(rawText: string): RequirementCandidate[] {
  const cleaned = cleanJsonString(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    throw new Error(`JSON parse failure: ${err.message}`);
  }

  // Defensively handle models returning a single object or wrapped { requirements: [...] }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, any>;
    if (Array.isArray(obj.requirements)) {
      parsed = obj.requirements;
    } else if (Array.isArray(obj.items)) {
      parsed = obj.items;
    } else {
      parsed = [parsed];
    }
  }

  const result = RequirementCandidateListSchema.safeParse(parsed);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Schema validation failed: ${errorDetails}`);
  }

  return result.data;
}
