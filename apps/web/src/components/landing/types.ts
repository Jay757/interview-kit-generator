export interface CrawledPage {
  url: string;
  status: string;
  bytes: string;
  time: string;
}

export interface Requirement {
  id: string;
  text: string;
  kind: "technical" | "behavioural" | "domain";
  priority: "must" | "nice";
  coverage: string;
}

export interface SampleQuestion {
  id: string;
  category: string;
  difficulty: number;
  reqBadge: string;
  prompt: string;
  starMethod: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface ScheduleItem {
  day: number;
  title: string;
  mins: number;
  focus: string;
}

export interface SimulatorPreset {
  id: string;
  company: string;
  badge: string;
  role: string;
  domain: string;
  crawledPages: CrawledPage[];
  intelligenceFound: string;
  requirements: Requirement[];
  sampleQuestion: SampleQuestion;
  flashcard: Flashcard;
  schedule: ScheduleItem[];
}

export type SimulatorTabType = "matrix" | "crawl" | "questions" | "flashcard" | "schedule";
