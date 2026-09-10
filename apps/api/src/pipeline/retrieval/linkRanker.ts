import { URL } from "url";
import { ExtractedLink, ScoredLink } from "./types.js";

const HIRING_KEYWORDS = [
  { term: "hiring", weight: 12 },
  { term: "career", weight: 12 },
  { term: "job", weight: 12 },
  { term: "interview", weight: 10 },
  { term: "join", weight: 10 },
  { term: "work-with", weight: 9 },
  { term: "work-at", weight: 9 },
  { term: "handbook", weight: 8 },
  { term: "culture", weight: 7 },
  { term: "engineering", weight: 6 },
  { term: "team", weight: 6 },
  { term: "people", weight: 5 },
  { term: "life", weight: 5 },
  { term: "openings", weight: 5 },
  { term: "positions", weight: 4 },
];

const ABOUT_KEYWORDS = [
  { term: "about", weight: 12 },
  { term: "company", weight: 10 },
  { term: "mission", weight: 9 },
  { term: "who-we-are", weight: 9 },
  { term: "story", weight: 8 },
  { term: "overview", weight: 7 },
  { term: "what-we-do", weight: 7 },
  { term: "platform", weight: 5 },
  { term: "product", weight: 4 },
];

const DISQUALIFIED_TERMS = [
  "login",
  "signin",
  "signup",
  "register",
  "privacy",
  "terms",
  "legal",
  "cookie",
  "cart",
  "checkout",
  "billing",
  "support",
  "help",
  "status",
  "password",
];

function scoreLinkForCategory(
  link: ExtractedLink,
  keywords: { term: string; weight: number }[]
): number {
  const combined = `${link.href} ${link.text}`.toLowerCase();

  // Check disqualified terms
  for (const dq of DISQUALIFIED_TERMS) {
    if (combined.includes(dq)) {
      return 0;
    }
  }

  let totalScore = 0;

  for (const { term, weight } of keywords) {
    // Exact anchor match is highest signal
    if (link.text.toLowerCase().includes(term)) {
      totalScore += weight + 3;
    }
    // URL path match
    if (link.href.toLowerCase().includes(term)) {
      totalScore += weight;
    }
  }

  return totalScore;
}

/**
 * Checks if candidate link shares the same root host as the base URL.
 */
export function isSameRootDomain(urlA: string, urlB: string): boolean {
  try {
    const hostA = new URL(urlA).hostname.replace(/^www\./, "").toLowerCase();
    const hostB = new URL(urlB).hostname.replace(/^www\./, "").toLowerCase();

    return hostA === hostB || hostA.endsWith(`.${hostB}`) || hostB.endsWith(`.${hostA}`);
  } catch {
    return false;
  }
}

/**
 * Ranks extracted links into scored candidates for hiring and company about intelligence.
 */
export function rankLinks(
  links: ExtractedLink[],
  baseUrl: string
): {
  hiringCandidates: ScoredLink[];
  aboutCandidates: ScoredLink[];
} {
  const hiringMap = new Map<string, ScoredLink>();
  const aboutMap = new Map<string, ScoredLink>();

  for (const link of links) {
    // Only crawl links on the same company domain
    if (!isSameRootDomain(link.href, baseUrl)) {
      continue;
    }

    // Skip self-referencing links
    if (link.href.replace(/\/$/, "") === baseUrl.replace(/\/$/, "")) {
      continue;
    }

    const hiringScore = scoreLinkForCategory(link, HIRING_KEYWORDS);
    if (hiringScore > 4) {
      const existing = hiringMap.get(link.href);
      if (!existing || existing.score < hiringScore) {
        hiringMap.set(link.href, { ...link, score: hiringScore });
      }
    }

    const aboutScore = scoreLinkForCategory(link, ABOUT_KEYWORDS);
    if (aboutScore > 4) {
      const existing = aboutMap.get(link.href);
      if (!existing || existing.score < aboutScore) {
        aboutMap.set(link.href, { ...link, score: aboutScore });
      }
    }
  }

  const hiringCandidates = Array.from(hiringMap.values()).sort(
    (a, b) => b.score - a.score
  );

  const aboutCandidates = Array.from(aboutMap.values()).sort(
    (a, b) => b.score - a.score
  );

  return { hiringCandidates, aboutCandidates };
}
