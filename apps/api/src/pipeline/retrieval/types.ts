export interface ExtractedLink {
  href: string;
  text: string;
}

export interface FetchedPage {
  url: string;
  title: string;
  text: string;
  links: ExtractedLink[];
}

export interface SkippedPage {
  url: string;
  reason: string;
}

export interface CrawlResult {
  pagesUsed: string[];
  pagesSkipped: SkippedPage[];
  aboutText: string;
  hiringText: string | null;
  publicDiscussionText: string | null;
}

export interface ScoredLink {
  href: string;
  text: string;
  score: number;
}
