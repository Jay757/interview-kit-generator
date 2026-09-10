import { z } from "zod";
import {
  Requirement,
  Question,
  Flashcard,
  QuestionCategory,
  DifficultyLevel,
} from "../../types/kit.js";

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

export const QuestionCandidateSchema = z.object({
  prompt: z.string().trim().min(5, "Prompt must be at least 5 characters"),
  answer_outline: z.string().trim().min(10, "Answer outline must be at least 10 characters"),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)], {
    message: "Difficulty must be integer 1, 2, or 3",
  }),
});

export type QuestionCandidate = z.infer<typeof QuestionCandidateSchema>;

export const QuestionCandidateListSchema = z
  .array(QuestionCandidateSchema)
  .min(1, "At least one question must be generated");

export const FlashcardCandidateSchema = z.object({
  front: z.string().trim().min(3, "Flashcard front must be at least 3 characters"),
  back: z.string().trim().min(5, "Flashcard back must be at least 5 characters"),
});

export type FlashcardCandidate = z.infer<typeof FlashcardCandidateSchema>;

export const FlashcardCandidateListSchema = z
  .array(FlashcardCandidateSchema)
  .min(1, "At least one flashcard must be generated");

export interface GenerationOptions {
  llmCaller?: (
    systemPrompt: string,
    userPrompt: string,
    options?: any
  ) => Promise<{ text: string; model: string }>;
  model?: string;
}

export type ExtractionOptions = GenerationOptions;

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

/**
 * Defensively extracts and normalizes an array of objects from raw JSON text,
 * handling cases where LLMs return a single object or wrap items in { questions: [...] } etc.
 */
export function parseAndNormalizeJsonArray(rawText: string, keyHints: string[] = []): any[] {
  const cleaned = cleanJsonString(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    throw new Error(`JSON parse failure: ${err.message}`);
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, any>;
    for (const key of [...keyHints, "items", "data", "results", "questions", "requirements", "flashcards"]) {
      if (Array.isArray(obj[key])) {
        return obj[key];
      }
    }
    // Single object returned
    return [parsed];
  }

  throw new Error("Expected JSON array or object, received " + typeof parsed);
}
