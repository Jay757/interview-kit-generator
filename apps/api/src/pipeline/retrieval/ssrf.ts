import { URL } from "url";

export interface SSRFValidationResult {
  valid: boolean;
  reason?: string;
  parsedUrl?: URL;
}

/**
 * Checks if a hostname or IPv4 address falls within private/loopback ranges.
 */
export function isPrivateAddress(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower === "127.0.0.1" ||
    lower === "::1" ||
    lower === "0.0.0.0"
  ) {
    return true;
  }

  // IPv4 pattern check
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = lower.match(ipv4Regex);

  if (match) {
    const [, a, b, c, d] = match.map(Number);
    if ([a, b, c, d].some((octet) => octet < 0 || octet > 255)) {
      return true; // Invalid octet
    }

    // 10.0.0.0/8
    if (a === 10) return true;

    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;

    // 127.0.0.0/8 Loopback
    if (a === 127) return true;

    // 169.254.0.0/16 Link-local / Cloud Metadata
    if (a === 169 && b === 254) return true;

    // 0.0.0.0/8 Current network
    if (a === 0) return true;
  }

  // IPv6 prefix checks
  if (lower.startsWith("fe80:") || lower.startsWith("fc00:") || lower.startsWith("fd00:")) {
    return true;
  }

  return false;
}

/**
 * Validates a target URL against SSRF attack vectors.
 */
export function validateUrlForFetch(
  targetUrl: string,
  overrideAllowLocal?: boolean
): SSRFValidationResult {
  if (!targetUrl || typeof targetUrl !== "string") {
    return { valid: false, reason: "URL must be a non-empty string" };
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl.trim());
  } catch {
    return { valid: false, reason: "Malformed URL structure" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      reason: `Unsupported protocol '${parsed.protocol}'. Only http: and https: are allowed.`,
    };
  }

  const allowLocal =
    overrideAllowLocal ?? process.env.ALLOW_LOCAL_FETCH === "true";

  if (!allowLocal && isPrivateAddress(parsed.hostname)) {
    return {
      valid: false,
      reason: `SSRF Barrier: Requests to private or loopback destination '${parsed.hostname}' are prohibited.`,
    };
  }

  return { valid: true, parsedUrl: parsed };
}
