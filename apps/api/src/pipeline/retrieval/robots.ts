import { URL } from "url";
import { validateUrlForFetch } from "./ssrf.js";

export interface RobotsChecker {
  isAllowed(pathname: string): boolean;
  disallowedPaths: string[];
}

/**
 * Parses raw robots.txt content into an active path checker.
 */
export function parseRobotsTxt(content: string, targetAgent = "*"): RobotsChecker {
  const lines = content.split(/\r?\n/);
  const disallowed: string[] = [];
  const allowed: string[] = [];

  let appliesToTarget = false;

  for (let rawLine of lines) {
    // Strip comments and whitespace
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const directive = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (directive === "user-agent") {
      const agent = value.toLowerCase();
      appliesToTarget = agent === "*" || agent === targetAgent.toLowerCase();
    } else if (appliesToTarget) {
      if (directive === "disallow" && value) {
        disallowed.push(value);
      } else if (directive === "allow" && value) {
        allowed.push(value);
      }
    }
  }

  return {
    disallowedPaths: disallowed,
    isAllowed(pathname: string): boolean {
      const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

      // If an exact or longer allow rule matches, permit it
      for (const allowRule of allowed) {
        if (normalizedPath.startsWith(allowRule)) {
          return true;
        }
      }

      // Check disallow rules
      for (const disallowRule of disallowed) {
        if (disallowRule === "/" || normalizedPath.startsWith(disallowRule)) {
          return false;
        }
      }

      return true;
    },
  };
}

/**
 * Fetches and parses robots.txt for a given base domain.
 * Gracefully defaults to allow-all if robots.txt returns 404 or fails.
 */
export async function getRobotsChecker(
  baseUrl: string,
  allowLocal?: boolean
): Promise<RobotsChecker> {
  const allowAll: RobotsChecker = {
    isAllowed: () => true,
    disallowedPaths: [],
  };

  const validation = validateUrlForFetch(baseUrl, allowLocal);
  if (!validation.valid || !validation.parsedUrl) {
    return allowAll;
  }

  const robotsUrl = `${validation.parsedUrl.origin}/robots.txt`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "trao-crawler/1.0",
        Accept: "text/plain, */*",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return allowAll;
    }

    const text = await res.text();
    return parseRobotsTxt(text);
  } catch {
    return allowAll;
  }
}
