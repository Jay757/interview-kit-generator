import { LLMCallOptions, LLMError, LLMResponse } from "./types.js";

const DEFAULT_MODEL = "google/gemini-2.5-flash";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Executes a call to OpenRouter's Chat Completions API with exponential backoff on 429 / 5xx,
 * structured system prompt support, and optional JSON mode.
 */
export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: LLMCallOptions = {}
): Promise<LLMResponse> {
  let apiKey = options.apiKey || process.env.OPENROUTER_API_KEY;

  if (apiKey) {
    apiKey = apiKey.trim().replace(/^["']|["']$/g, "");
    if (apiKey.startsWith("OPENROUTER_API_KEY=")) {
      apiKey = apiKey.replace(/^OPENROUTER_API_KEY=/, "").trim();
    }
  }

  if (!apiKey) {
    throw new LLMError(
      "OPENROUTER_API_KEY is missing. Set OPENROUTER_API_KEY in environment variables.",
      "LLM_CONFIG_MISSING"
    );
  }

  const model = options.model || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const temperature = options.temperature ?? 0.2;
  const jsonMode = options.jsonMode ?? false;
  const fetchClient = options.fetchFn ?? fetch;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://trao.app",
    "X-Title": "Trao AI Interview Prep Kit",
  };

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (systemPrompt.trim()) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userPrompt });

  const requestBody: Record<string, any> = {
    model,
    messages,
    temperature,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  };

  let attempt = 0;
  let delay = 1000;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchClient(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle successful response
      if (response.ok) {
        const data = (await response.json()) as any;
        const candidateText = data.choices?.[0]?.message?.content ?? "";

        return {
          text: candidateText,
          model: data.model || model,
          usage: {
            promptTokens: data.usage?.prompt_tokens,
            completionTokens: data.usage?.completion_tokens,
            totalTokens: data.usage?.total_tokens,
          },
        };
      }

      // Read error body
      const errorText = await response.text();
      let errorJson: any = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // Not JSON
      }

      const status = response.status;
      const isRetryable = status === 429 || (status >= 500 && status < 600);

      if (isRetryable && attempt < maxRetries) {
        attempt++;
        const jitter = Math.floor(Math.random() * 200);
        await new Promise((r) => setTimeout(r, delay + jitter));
        delay *= 2;
        continue;
      }

      const errorMessage =
        errorJson?.error?.message ||
        errorJson?.message ||
        `OpenRouter API returned HTTP ${status}: ${errorText}`;
      const code = status === 429 ? "LLM_RATE_LIMITED" : "LLM_UNAVAILABLE";
      throw new LLMError(errorMessage, code, status, errorJson);
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err instanceof LLMError) {
        throw err;
      }

      const isAbort = err.name === "AbortError";
      if (isAbort) {
        throw new LLMError(
          `LLM call timed out after ${timeoutMs}ms`,
          "LLM_TIMEOUT"
        );
      }

      if (attempt < maxRetries) {
        attempt++;
        const jitter = Math.floor(Math.random() * 200);
        await new Promise((r) => setTimeout(r, delay + jitter));
        delay *= 2;
        continue;
      }

      throw new LLMError(
        err.message || "Network error while connecting to OpenRouter",
        "LLM_UNAVAILABLE",
        undefined,
        err
      );
    }
  }

  throw new LLMError(
    "Max retries exceeded communicating with OpenRouter",
    "LLM_UNAVAILABLE"
  );
}
