export type ItemState = "generated" | "edited" | "pinned";

export type RequirementKind = "technical" | "behavioural" | "domain";
export type RequirementPriority = "must" | "nice";

export type QuestionCategory =
  | "technical"
  | "behavioural"
  | "system-design"
  | "company-fit";

export type DifficultyLevel = 1 | 2 | 3;

export interface KitSource {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number;
  researched_at: string;
  pages_used: string[];
}

export interface KitCompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
  state?: ItemState;
}

export interface KitRequirement {
  id: string;
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
  state?: ItemState;
}

export type Requirement = KitRequirement;
export type CompanyBrief = KitCompanyBrief;

export interface KitRole {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: KitRequirement[];
}

export interface KitQuestion {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: DifficultyLevel;
  state?: ItemState;
}

export interface KitFlashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  state?: ItemState;
}

export type Question = KitQuestion;
export type Flashcard = KitFlashcard;


export interface KitScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface KitSchedule {
  days_available: number;
  days: KitScheduleDay[];
}

export interface KitCoverage {
  uncovered_requirement_ids: string[];
  passes: number;
}

/**
 * Exact Appendix A Kit Structure byte-for-byte in field names.
 */
export interface KitStructure {
  source: KitSource;
  company_brief: KitCompanyBrief;
  role: KitRole;
  questions: KitQuestion[];
  flashcards: KitFlashcard[];
  schedule: KitSchedule;
  coverage: KitCoverage;
}
