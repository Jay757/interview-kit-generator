export interface LLMCallOptions {
  jsonMode?: boolean;
  timeoutMs?: number;
  temperature?: number;
  maxRetries?: number;
  apiKey?: string;
  model?: string;
  fetchFn?: typeof fetch;
}

export interface LLMResponse {
  text: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export type LLMErrorCode =
  | "LLM_INVALID_OUTPUT"
  | "LLM_TIMEOUT"
  | "LLM_UNAVAILABLE"
  | "LLM_CONFIG_MISSING"
  | "LLM_RATE_LIMITED"
  | "LLM_QUOTA_EXCEEDED"
  | "LLM_AUTH_ERROR";

export class LLMError extends Error {
  readonly code: LLMErrorCode;
  readonly status?: number;
  readonly details?: unknown;

  constructor(message: string, code: LLMErrorCode, status?: number, details?: unknown) {
    super(message);
    this.name = "LLMError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
