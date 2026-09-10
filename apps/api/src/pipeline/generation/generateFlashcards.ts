import { Flashcard, Question } from "../../types/kit.js";
import { FlashcardSchema } from "../../validation/kitValidator.js";
import { callLLM } from "../llm/client.js";
import {
  FlashcardCandidate,
  FlashcardCandidateListSchema,
  GenerationOptions,
  parseAndNormalizeJsonArray,
} from "./types.js";

const SYSTEM_PROMPT = `You are a study card and flashcard design specialist.
Your task is to convert interview questions and their answer outlines into concise, high-yield flashcards for rapid spaced-repetition study.

Strict Rules:
1. "front": A concise, clear question or core technical concept to recall (must be self-contained).
2. "back": Concise bullet points or key takeaways (under 50 words) capturing the essential answer points, trade-offs, or formulas.
3. Return ONLY a valid JSON array of objects with the exact schema:
[
  {
    "front": "string (min 3 chars)",
    "back": "string (min 5 chars)"
  }
]
No extra conversational text or markdown code blocks outside JSON.`;

/**
 * Derives spaced-repetition flashcards from generated questions, carrying through requirement_ids
 * and assigning stable sequential f1, f2... IDs in code.
 */
export async function generateFlashcards(
  questions: Question[],
  options: GenerationOptions = {}
): Promise<Flashcard[]> {
  if (!questions || questions.length === 0) {
    return [];
  }

  // Select key questions (up to 10 questions to keep flashcard review focused)
  const selectedQuestions = questions.slice(0, 10);
  const caller = options.llmCaller ?? callLLM;

  const userPrompt = `Create one high-retention flashcard for each of the following interview questions:

${selectedQuestions
  .map(
    (q, i) => `[Question ${i + 1}]
Category: ${q.category}
Prompt: ${q.prompt}
Answer Outline: ${q.answer_outline}`
  )
  .join("\n\n")}`;

  let candidates: FlashcardCandidate[] = [];

  try {
    const rawResponse = await caller(SYSTEM_PROMPT, userPrompt, {
      jsonMode: true,
      model: options.model,
    });

    const parsed = parseAndNormalizeJsonArray(rawResponse.text, ["flashcards"]);
    const validated = FlashcardCandidateListSchema.safeParse(parsed);
    if (validated.success) {
      candidates = validated.data;
    }
  } catch (err) {
    console.warn("LLM flashcard distillation failed, falling back to direct distillation:", err);
  }

  // If LLM output failed or produced fewer cards, fall back to direct distillation from questions
  if (candidates.length === 0) {
    candidates = selectedQuestions.map((q) => ({
      front: q.prompt,
      back: q.answer_outline.length > 200 ? q.answer_outline.slice(0, 197) + "..." : q.answer_outline,
    }));
  }

  const flashcards: Flashcard[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const sourceQuestion = selectedQuestions[i % selectedQuestions.length];

    const card: Flashcard = {
      id: `f${i + 1}`,
      requirement_ids: sourceQuestion ? [...sourceQuestion.requirement_ids] : [],
      front: candidate.front,
      back: candidate.back,
      state: "generated",
    };

    // Validate against Appendix A schema
    FlashcardSchema.parse(card);
    flashcards.push(card);
  }

  return flashcards;
}
