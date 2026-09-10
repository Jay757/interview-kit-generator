import { z } from "zod";
import { KitStructure } from "../types/kit.js";

export const StateEnum = z.enum(["generated", "edited", "pinned"]);

export const SourceSchema = z.object({
  company: z.string(),
  company_url: z.string(),
  role: z.string(),
  location: z.string(),
  jd_chars: z.number().int({ message: "jd_chars must be an integer" }),
  researched_at: z.string(),
  pages_used: z.array(z.string()),
});

export const CompanyBriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
  sources: z.array(z.string()),
  state: StateEnum.optional(),
});

export const RequirementSchema = z.object({
  id: z.string().min(1, "Requirement ID is required"),
  text: z.string().min(1, "Requirement text is required"),
  kind: z.enum(["technical", "behavioural", "domain"], {
    message: "kind must be 'technical', 'behavioural', or 'domain'",
  }),
  priority: z.enum(["must", "nice"], {
    message: "priority must be 'must' or 'nice'",
  }),
  state: StateEnum.optional(),
});

export const RoleSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(RequirementSchema),
});

export const QuestionSchema = z.object({
  id: z.string().min(1, "Question ID is required"),
  requirement_ids: z.array(z.string()),
  category: z.enum(["technical", "behavioural", "system-design", "company-fit"], {
    message:
      "category must be 'technical', 'behavioural', 'system-design', or 'company-fit'",
  }),
  prompt: z.string(),
  answer_outline: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)], {
    message: "difficulty must be an integer between 1 and 3",
  }),
  state: StateEnum.optional(),
});

export const FlashcardSchema = z.object({
  id: z.string().min(1, "Flashcard ID is required"),
  front: z.string(),
  back: z.string(),
  requirement_ids: z.array(z.string()),
  state: StateEnum.optional(),
});

export const ScheduleDaySchema = z.object({
  day: z.number().int({ message: "day must be an integer" }).min(1),
  focus: z.string(),
  question_ids: z.array(z.string()),
  minutes: z.number().int({ message: "minutes must be an integer" }).min(0),
});

export const ScheduleSchema = z.object({
  days_available: z
    .number()
    .int({ message: "days_available must be an integer" })
    .min(1),
  days: z.array(ScheduleDaySchema),
});

export const CoverageSchema = z.object({
  uncovered_requirement_ids: z.array(z.string()),
  passes: z.number().int({ message: "passes must be an integer" }).min(0),
});

/**
 * Complete Appendix A Kit Zod Schema with referential integrity validation.
 */
export const KitZodSchema = z
  .object({
    source: SourceSchema,
    company_brief: CompanyBriefSchema,
    role: RoleSchema,
    questions: z.array(QuestionSchema),
    flashcards: z.array(FlashcardSchema),
    schedule: ScheduleSchema,
    coverage: CoverageSchema,
  })
  .superRefine((kit, ctx) => {
    if (!kit) return;

    // 1. Verify question IDs in schedule point to questions that actually exist
    if (Array.isArray(kit.questions) && kit.schedule && Array.isArray(kit.schedule.days)) {
      const existingQuestionIds = new Set(
        kit.questions.filter((q) => q && q.id).map((q) => q.id)
      );

      kit.schedule.days.forEach((day, dayIndex) => {
        if (day && Array.isArray(day.question_ids)) {
          day.question_ids.forEach((qid, qIndex) => {
            if (!existingQuestionIds.has(qid)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Schedule day ${day.day} references non-existent question ID '${qid}'`,
                path: ["schedule", "days", dayIndex, "question_ids", qIndex],
              });
            }
          });
        }
      });
    }

    // 2. Verify question requirement IDs point to existing requirements
    if (kit.role && Array.isArray(kit.role.requirements) && Array.isArray(kit.questions)) {
      const existingReqIds = new Set(
        kit.role.requirements.filter((r) => r && r.id).map((r) => r.id)
      );

      kit.questions.forEach((q, qIndex) => {
        if (q && Array.isArray(q.requirement_ids)) {
          q.requirement_ids.forEach((rid, rIndex) => {
            if (!existingReqIds.has(rid)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Question '${q.id}' references non-existent requirement ID '${rid}'`,
                path: ["questions", qIndex, "requirement_ids", rIndex],
              });
            }
          });
        }
      });
    }
  });

export type ValidationResult =
  | { success: true; data: KitStructure }
  | { success: false; errors: string[] };

/**
 * Standalone, pure runtime validator for Appendix A kit structure.
 */
export function validateKit(candidate: unknown): ValidationResult {
  const result = KitZodSchema.safeParse(candidate);

  if (result.success) {
    return { success: true, data: result.data as KitStructure };
  }

  const errors = (result.error.issues || []).map((err) => {
    const path = err.path.join(".");
    return path ? `${path}: ${err.message}` : err.message;
  });

  return { success: false, errors };
}

/**
 * Throws a formatted Error if validation fails.
 */
export function assertValidKit(candidate: unknown): KitStructure {
  const result = validateKit(candidate);
  if (!result.success) {
    throw new Error(`Kit validation failed: ${result.errors.join("; ")}`);
  }
  return result.data;
}
