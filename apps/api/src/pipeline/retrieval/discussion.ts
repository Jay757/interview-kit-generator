/**
 * Public interview discussion search.
 * When an external search provider or public search query returns no verified information,
 * this function cleanly and honestly returns null / empty string without hallucinating.
 */
export async function searchPublicInterviewDiscussion(
  companyName: string
): Promise<string | null> {
  if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
    return null;
  }

  // If a search API key is configured (e.g., TAVILY_API_KEY, SERPAPI_KEY),
  // we can query targeted platforms (Reddit, Glassdoor, Blind).
  // Otherwise, we return null honestly per Rule 4 ("Never invent facts").
  const apiKey = process.env.SEARCH_API_KEY || process.env.TAVILY_API_KEY;

  if (!apiKey) {
    // Documented honest fallback: No external search key configured
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${companyName} software engineer interview process questions experience glassdoor reddit`,
        search_depth: "basic",
        max_results: 3,
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as any;
    if (data.results && Array.isArray(data.results) && data.results.length > 0) {
      return data.results
        .map((r: any) => `[Source: ${r.url}]\n${r.content}`)
        .join("\n\n");
    }

    return null;
  } catch {
    return null;
  }
}
