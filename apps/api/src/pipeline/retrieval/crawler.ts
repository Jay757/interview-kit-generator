import { URL } from "url";
import { fetchPage, FetchPageOptions } from "./fetcher.js";
import { getRobotsChecker } from "./robots.js";
import { rankLinks } from "./linkRanker.js";
import { validateUrlForFetch } from "./ssrf.js";
import { searchPublicInterviewDiscussion } from "./discussion.js";
import { CrawlResult, FetchedPage, SkippedPage } from "./types.js";

export interface CrawlOptions {
  maxHiringPages?: number;
  maxAboutPages?: number;
  requestDelayMs?: number;
  allowLocal?: boolean;
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes a fetch with exponential backoff on 429/5xx status codes.
 */
async function fetchWithRetry(
  url: string,
  options: FetchPageOptions,
  maxRetries = 2
): Promise<FetchedPage> {
  let attempt = 0;
  let delay = 300;

  while (true) {
    try {
      return await fetchPage(url, options);
    } catch (err: any) {
      attempt++;
      const isRateOrServer =
        err.message.includes("429") ||
        err.message.includes("500") ||
        err.message.includes("502") ||
        err.message.includes("503") ||
        err.message.includes("504");

      if (attempt <= maxRetries && isRateOrServer) {
        await sleep(delay);
        delay *= 2;
        continue;
      }

      throw err;
    }
  }
}

/**
 * Crawls a company website, discovers and ranks hiring/about pages, and compiles intelligence.
 * Degrades gracefully upon 404s, timeouts, or robots.txt restrictions without throwing.
 */
export async function crawlCompanySite(
  baseUrl: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  const maxHiringPages = options.maxHiringPages ?? 2;
  const maxAboutPages = options.maxAboutPages ?? 1;
  const delayMs = options.requestDelayMs ?? 150;
  const allowLocal = options.allowLocal ?? process.env.ALLOW_LOCAL_FETCH === "true";

  const pagesUsed: string[] = [];
  const pagesSkipped: SkippedPage[] = [];

  let aboutText = "";
  let hiringText: string | null = null;

  // 1. SSRF check on base URL
  const ssrf = validateUrlForFetch(baseUrl, allowLocal);
  if (!ssrf.valid || !ssrf.parsedUrl) {
    pagesSkipped.push({
      url: baseUrl,
      reason: ssrf.reason || "Invalid URL or blocked by SSRF barrier",
    });
    return {
      pagesUsed,
      pagesSkipped,
      aboutText: "",
      hiringText: null,
      publicDiscussionText: null,
    };
  }

  const normalizedBase = ssrf.parsedUrl.href;

  // 2. Fetch robots.txt
  const robots = await getRobotsChecker(normalizedBase, allowLocal);

  // 3. Fetch Homepage
  let homepage: FetchedPage;
  try {
    if (!robots.isAllowed(ssrf.parsedUrl.pathname)) {
      pagesSkipped.push({
        url: normalizedBase,
        reason: "Disallowed by robots.txt",
      });
      return {
        pagesUsed,
        pagesSkipped,
        aboutText: "",
        hiringText: null,
        publicDiscussionText: null,
      };
    }

    homepage = await fetchWithRetry(
      normalizedBase,
      { allowLocal, timeoutMs: options.timeoutMs },
      2
    );

    pagesUsed.push(homepage.url);
    aboutText += `[Homepage: ${homepage.title}]\n${homepage.text}\n\n`;
  } catch (err: any) {
    // If homepage fails (e.g. 404, unreachable), record skip and report gracefully
    pagesSkipped.push({
      url: normalizedBase,
      reason: err.message || "Failed to reach base URL",
    });

    return {
      pagesUsed,
      pagesSkipped,
      aboutText: "",
      hiringText: null,
      publicDiscussionText: null,
    };
  }

  // 4. Rank candidate links from homepage
  const { hiringCandidates, aboutCandidates } = rankLinks(
    homepage.links,
    normalizedBase
  );

  // 5. Crawl About Candidates
  for (const candidate of aboutCandidates.slice(0, maxAboutPages)) {
    if (pagesUsed.includes(candidate.href)) continue;

    try {
      const candUrl = new URL(candidate.href);
      if (!robots.isAllowed(candUrl.pathname)) {
        pagesSkipped.push({
          url: candidate.href,
          reason: "Disallowed by robots.txt",
        });
        continue;
      }

      await sleep(delayMs);
      const page = await fetchWithRetry(
        candidate.href,
        { allowLocal, timeoutMs: options.timeoutMs },
        1
      );

      pagesUsed.push(page.url);
      aboutText += `[About Page: ${page.title}]\n${page.text}\n\n`;
    } catch (err: any) {
      pagesSkipped.push({
        url: candidate.href,
        reason: err.message || "Fetch failed",
      });
    }
  }

  // 6. Crawl Hiring Candidates
  const hiringParts: string[] = [];
  for (const candidate of hiringCandidates.slice(0, maxHiringPages)) {
    if (pagesUsed.includes(candidate.href)) continue;

    try {
      const candUrl = new URL(candidate.href);
      if (!robots.isAllowed(candUrl.pathname)) {
        pagesSkipped.push({
          url: candidate.href,
          reason: "Disallowed by robots.txt",
        });
        continue;
      }

      await sleep(delayMs);
      const page = await fetchWithRetry(
        candidate.href,
        { allowLocal, timeoutMs: options.timeoutMs },
        1
      );

      pagesUsed.push(page.url);
      hiringParts.push(`[Hiring/Careers Page: ${page.title}]\n${page.text}`);
    } catch (err: any) {
      pagesSkipped.push({
        url: candidate.href,
        reason: err.message || "Fetch failed",
      });
    }
  }

  if (hiringParts.length > 0) {
    hiringText = hiringParts.join("\n\n");
  }

  // 7. Extract company name heuristic from title or URL for discussion search
  let companyName = homepage.title.split(/[-–|]/)[0].trim();
  if (!companyName || companyName.length > 40) {
    companyName = ssrf.parsedUrl.hostname.replace(/^www\./, "").split(".")[0];
  }

  const publicDiscussionText = await searchPublicInterviewDiscussion(companyName);

  return {
    pagesUsed,
    pagesSkipped,
    aboutText: aboutText.trim(),
    hiringText: hiringText ? hiringText.trim() : null,
    publicDiscussionText,
  };
}
