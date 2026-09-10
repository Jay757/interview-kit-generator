import { z } from "zod";
import { Requirement, RequirementKind, RequirementPriority } from "../../types/kit.js";

export const RequirementCandidateSchema = z.object({
  text: z.string().trim().min(3, "Requirement text must be at least 3 characters"),
  kind: z.enum(["technical", "behavioural", "domain"] as const),
  priority: z.enum(["must", "nice"] as const),
});

export type RequirementCandidate = z.infer<typeof RequirementCandidateSchema>;

export const RequirementCandidateListSchema = z
  .array(RequirementCandidateSchema)
  .min(1, "At least one requirement must be extracted");

export const CompanyBriefCandidateSchema = z.object({
  summary: z.string().trim().min(5, "Summary must be at least 5 characters"),
  what_they_do: z.string().trim().min(5, "what_they_do must be at least 5 characters"),
});

export type CompanyBriefCandidate = z.infer<typeof CompanyBriefCandidateSchema>;

export interface ExtractionOptions {
  llmCaller?: (
    systemPrompt: string,
    userPrompt: string,
    options?: any
  ) => Promise<{ text: string; model: string }>;
}

/**
 * Strips markdown code fences (```json ... ```) and leading/trailing whitespace.
 */
export function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();

  // If wrapped in ```json ... ``` or ``` ... ```
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/, "");
  }

  return cleaned.trim();
}
