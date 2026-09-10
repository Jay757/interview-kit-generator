import * as cheerio from "cheerio";
import { URL } from "url";
import { validateUrlForFetch } from "./ssrf.js";
import { FetchedPage, ExtractedLink } from "./types.js";

export interface FetchPageOptions {
  timeoutMs?: number;
  maxBytes?: number;
  allowLocal?: boolean;
}

const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_MAX_BYTES = 1.5 * 1024 * 1024; // 1.5 MB

/**
 * Fetches and parses an HTML page with timeout, SSRF protection, size caps, and text cleaning.
 */
export async function fetchPage(
  targetUrl: string,
  options: FetchPageOptions = {}
): Promise<FetchedPage> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  // 1. SSRF validation
  const ssrfCheck = validateUrlForFetch(targetUrl, options.allowLocal);
  if (!ssrfCheck.valid || !ssrfCheck.parsedUrl) {
    throw new Error(ssrfCheck.reason || "Invalid target URL");
  }

  const cleanUrl = ssrfCheck.parsedUrl.href;

  // 2. Fetch with abort timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "trao-crawler/1.0 (+https://trao.app/bot)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5",
      },
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw new Error(`Fetch failed: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // 3. Content-Type restriction
  const contentType = response.headers.get("content-type") || "";
  const isHtml =
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml+xml") ||
    contentType.includes("text/plain");

  if (!isHtml) {
    throw new Error(`Unsupported content type '${contentType}'. Only HTML is supported.`);
  }

  // 4. Response body reading with size cap
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) {
    throw new Error(
      `Response size (${arrayBuffer.byteLength} bytes) exceeds maximum allowance of ${maxBytes} bytes.`
    );
  }

  const rawHtml = Buffer.from(arrayBuffer).toString("utf-8");

  // 5. Cheerio HTML parsing & link extraction
  const $ = cheerio.load(rawHtml);

  const title = $("title").first().text().trim() || "";

  // Extract links before stripping nav/footer
  const links: ExtractedLink[] = [];
  const seenUrls = new Set<string>();

  $("a[href]").each((_, el) => {
    const rawHref = $(el).attr("href");
    const linkText = $(el).text().replace(/\s+/g, " ").trim();

    if (!rawHref || rawHref.startsWith("javascript:") || rawHref.startsWith("mailto:")) {
      return;
    }

    try {
      const resolved = new URL(rawHref, cleanUrl);
      // Remove hash fragments
      resolved.hash = "";

      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        const fullHref = resolved.href;
        if (!seenUrls.has(fullHref)) {
          seenUrls.add(fullHref);
          links.push({
            href: fullHref,
            text: linkText,
          });
        }
      }
    } catch {
      // Ignore unparseable link
    }
  });

  // 6. Clean boilerplate (scripts, styles, navigations, footers)
  $("script, style, noscript, svg, iframe, nav, footer, header, form, [role='navigation']").remove();

  // Extract clean text
  let cleanedText = $("body").text() || $.root().text();
  cleanedText = cleanedText
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();

  // Truncate to reasonable upper bound (25k characters)
  if (cleanedText.length > 25000) {
    cleanedText = cleanedText.slice(0, 25000) + "... [truncated]";
  }

  return {
    url: cleanUrl,
    title,
    text: cleanedText,
    links,
  };
}
