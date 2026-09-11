import { Question, QuestionCategory, Requirement } from "../../types/kit.js";
import { QuestionSchema } from "../../validation/kitValidator.js";
import { callLLM } from "../llm/client.js";
import { LLMError } from "../llm/types.js";
import {
  GenerationOptions,
  parseAndNormalizeJsonArray,
  QuestionCandidate,
  QuestionCandidateListSchema,
} from "./types.js";

/**
 * Builds specialized system instructions tailored specifically to the target question category.
 */
export function buildCategorySystemPrompt(
  category: QuestionCategory,
  hiringProcessContext?: string | null
): string {
  let categoryInstructions = "";

  switch (category) {
    case "technical":
      categoryInstructions = `Focus strictly on practical coding, system fundamentals, architecture patterns, debugging scenarios, and technology-specific depth.
Ask questions that test genuine implementation experience rather than trivial trivia.`;
      break;

    case "behavioural":
      categoryInstructions = `Focus strictly on past behaviors, collaboration, conflict resolution, mentoring, and ownership using the STAR method (Situation, Task, Action, Result).
Ask scenario-based questions that reveal how the candidate navigates interpersonal challenges and high-stakes deadlines.`;
      break;

    case "system-design":
      categoryInstructions = `Focus strictly on large-scale distributed system architecture, scalability, latency, throughput bottlenecks, failure modes, data modeling, and trade-offs.
Ask questions requiring architectural diagramming, API contract design, and storage/caching decisions.`;
      break;

    case "company-fit":
      categoryInstructions = `Focus strictly on alignment with engineering culture, cross-functional communication, mission-driven problem solving, and team values.
Ask questions that test cultural adaptability and self-motivation.`;
      break;
  }

  let hiringContextSection = "";
  if (hiringProcessContext && hiringProcessContext.trim()) {
    hiringContextSection = `
Company Hiring Process Intelligence:
The company's interview rounds and evaluation stages are known as:
<hiring-process>
${hiringProcessContext.trim()}
</hiring-process>
Incorporate these specific evaluation expectations and formats into the question styling.`;
  } else {
    hiringContextSection = `
(No company-specific interview round information was retrieved; use top-tier standard industry interview benchmarks.)`;
  }

  return `You are a principal engineering interviewer specializing in ${category.toUpperCase()} interview evaluations.
Your task is to generate 1 to 3 targeted interview questions strictly assessing ONE specific job requirement.

Category Directives:
${categoryInstructions}
${hiringContextSection}

Strict Rules:
1. Grounding: Questions must directly evaluate the provided requirement. Do NOT introduce arbitrary unmentioned frameworks or unrelated trivia.
2. Structure: For every question, provide:
   - "prompt": The exact question the interviewer asks the candidate.
   - "answer_outline": Clear, comprehensive guidance detailing what a strong answer must include (key technical terms, trade-offs, or STAR components).
   - "difficulty": Integer 1 (foundational), 2 (intermediate / senior standard), or 3 (staff+ / advanced depth).
3. Output format: Return ONLY a valid JSON array of objects with the exact schema:
[
  {
    "prompt": "Interview question text",
    "answer_outline": "What a strong answer contains...",
    "difficulty": 1 | 2 | 3
  }
]
Do not include any conversational filler, explanations, or markdown fences outside the JSON.`;
}

/**
 * Generates 1-3 targeted interview questions for ONE requirement in ONE category.
 */
export async function generateQuestionsForRequirement(
  requirement: Requirement,
  category: QuestionCategory,
  hiringProcessContext?: string | null,
  options: GenerationOptions = {}
): Promise<QuestionCandidate[]> {
  const caller = options.llmCaller ?? callLLM;
  const systemPrompt = buildCategorySystemPrompt(category, hiringProcessContext);

  const userPrompt = `Generate 1 to 3 ${category} interview questions to evaluate the following requirement:

<source label="job-requirement">
Requirement ID: ${requirement.id}
Priority: ${requirement.priority}
Kind: ${requirement.kind}
Text: ${requirement.text}
</source>`;

  let rawResponse = await caller(systemPrompt, userPrompt, {
    jsonMode: true,
    model: options.model,
  });

  try {
    return parseAndValidateQuestions(rawResponse.text);
  } catch (firstErr: any) {
    // Retry once with corrective prompt
    const correctivePrompt = `Your previous output was invalid: ${firstErr.message}.
Please re-generate 1 to 3 ${category} questions for the requirement below. Return ONLY a valid JSON array matching the schema:
[
  {
    "prompt": "string (min 5 chars)",
    "answer_outline": "string (min 10 chars)",
    "difficulty": 1 | 2 | 3
  }
]

Requirement:
${requirement.text}`;

    try {
      const retryResponse = await caller(systemPrompt, correctivePrompt, {
        jsonMode: true,
        model: options.model,
      });
      return parseAndValidateQuestions(retryResponse.text);
    } catch (retryErr: any) {
      throw new LLMError(
        `Failed to generate questions for requirement ${requirement.id} in ${category}: ${retryErr.message}`,
        "LLM_INVALID_OUTPUT",
        422,
        { original: rawResponse.text, error: retryErr.message }
      );
    }
  }
}

function parseAndValidateQuestions(rawText: string): QuestionCandidate[] {
  const items = parseAndNormalizeJsonArray(rawText, ["questions"]);
  const result = QuestionCandidateListSchema.safeParse(items);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Question validation failed: ${issues}`);
  }

  return result.data;
}

/**
 * Orchestrates question generation across all requirements, calling the generator
 * per requirement/category and assembling stable q1, q2... IDs.
 */
export async function generateAllQuestions(
  requirements: Requirement[],
  hiringProcessContext?: string | null,
  options: GenerationOptions = {}
): Promise<Question[]> {
  interface QuestionTask {
    req: Requirement;
    cat: QuestionCategory;
    index: number;
  }

  const tasks: QuestionTask[] = [];
  let taskIdx = 0;

  for (const req of requirements) {
    // Determine category sequence per requirement
    const categoriesToGenerate: QuestionCategory[] = [];

    if (req.kind === "technical") {
      categoriesToGenerate.push("technical");

      // If requirement mentions architectural/distributed concepts, or hiring process has system design round
      const textLower = req.text.toLowerCase();
      const isSystemDesignRelated =
        textLower.includes("distributed") ||
        textLower.includes("architect") ||
        textLower.includes("scalab") ||
        textLower.includes("microservice") ||
        textLower.includes("system design") ||
        (hiringProcessContext && /system[\s-]design/i.test(hiringProcessContext));

      if (isSystemDesignRelated && req.priority === "must") {
        categoriesToGenerate.push("system-design");
      }
    } else if (req.kind === "behavioural") {
      categoriesToGenerate.push("behavioural");
    } else if (req.kind === "domain") {
      categoriesToGenerate.push("technical");
      categoriesToGenerate.push("company-fit");
    }

    for (const cat of categoriesToGenerate) {
      tasks.push({ req, cat, index: taskIdx++ });
    }
  }

  if (tasks.length === 0) {
    return [];
  }

  console.log(
    `🚀 [Question Generation] Dispatching ${tasks.length} category tasks across ${requirements.length} requirements (concurrency=3)...`
  );
  const startGenTime = Date.now();

  // Execute with concurrency limit of 3 to drastically speed up generation
  const taskResults: Array<{ task: QuestionTask; candidates: QuestionCandidate[] }> = new Array(
    tasks.length
  );
  let nextIndex = 0;
  const concurrencyLimit = 3;

  const workers = Array.from({ length: Math.min(concurrencyLimit, tasks.length) }, async () => {
    while (nextIndex < tasks.length) {
      const current = nextIndex++;
      const task = tasks[current];
      try {
        const candidates = await generateQuestionsForRequirement(
          task.req,
          task.cat,
          hiringProcessContext,
          options
        );
        taskResults[current] = { task, candidates };
      } catch (err) {
        // Individual requirement failure does not abort the entire batch
        console.warn(
          `Skipped question generation for requirement ${task.req.id} in category ${task.cat}:`,
          err
        );
        taskResults[current] = { task, candidates: [] };
      }
    }
  });

  await Promise.all(workers);

  // Deterministically assemble questions in stable requirement/category sequence
  const assembledQuestions: Question[] = [];
  let questionCounter = 1;

  for (const res of taskResults) {
    if (!res || !res.candidates) continue;
    for (const candidate of res.candidates) {
      const q: Question = {
        id: `q${questionCounter++}`,
        requirement_ids: [res.task.req.id],
        category: res.task.cat,
        prompt: candidate.prompt,
        answer_outline: candidate.answer_outline,
        difficulty: candidate.difficulty,
        state: "generated",
      };

      // Validate individual question against Appendix A schema
      QuestionSchema.parse(q);
      assembledQuestions.push(q);
    }
  }

  console.log(
    `✅ [Question Generation] Finished in ${Date.now() - startGenTime}ms! Produced ${assembledQuestions.length} questions.`
  );

  return assembledQuestions;
}
