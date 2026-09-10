# Architectural Decisions Log

This document tracks technical decisions, trade-offs, and heuristics chosen throughout the phases of the Trao AI Interview Prep Kit project.

---

## 2026-09-10: Phase 1 Decisions

### LLM Provider Selection
- **Decision**: Primary provider is Google Gemini API (`gemini-2.5-flash` / `gemini-1.5-flash`), with architectural design allowing provider abstraction (e.g., Groq fallback).
- **Reasoning**: Gemini provides a generous free tier with high quality structured output and fast inference latency.

### Scraping & Retrieval Strategy
- **Decision**: Use `cheerio` + `undici` / native `fetch` for content retrieval.
- **Reasoning**: Fast, lightweight, robust HTML parsing without the overhead and brittle dependencies of headless browser automation, perfectly fitting company site and hiring page extraction needs.

---

## 2026-09-10: Phase 2 Decisions — Authentication & Session Lifecycle

### Session-Based Cookies vs Raw JWTs
- **Decision**: Implemented cookie-based HTTP sessions using `express-session` backed by MongoDB (`connect-mongo`) rather than stateless JWTs.
- **Reasoning**: Per the brief, session cookies with `httpOnly`, `sameSite: "lax"` (or `"none"` in cross-origin prod), and `secure` in production are simpler, impervious to XSS-based token theft from localStorage, and enable instant, server-authoritative session revocation upon logout without maintaining complex JWT blacklists.

### Session Lifecycle & Expired/Invalid Session Handling
- **TTL Configuration**: MongoDB session collection configured with a 14-day TTL (`ttl: 14 * 24 * 60 * 60`) leveraging MongoDB native TTL index (`autoRemove: "native"`).
- **Invalid/Expired Lookup**: When a request arrives with an invalid, expired, or non-existent session ID:
  1. The `requireAuth` middleware immediately halts processing and returns a structured 401 response: `{ error: { code: "UNAUTHORIZED", message: "..." } }`.
  2. If the user object associated with the session ID is no longer found in the database (e.g., account deleted), the route destroys the active session and explicitly clears the client cookie via `res.clearCookie()`.
- **Password Security**: Passwords hashed using `bcryptjs` with 10 salt rounds before persistence; plain text passwords never leave the registration boundary.

---

## 2026-09-10: Phase 3 Decisions — Kit Schema, Validator & Shared Types

### Shared Kit Types Location
- **Decision**: Maintained canonical TypeScript types in `apps/api/src/types/kit.ts`.
- **Reasoning**: The pipeline (`apps/api/src/pipeline/`), the batch evaluation CLI (`apps/api/src/cli/`), and the API models/routes all execute inside the Node.js backend workspace. Keeping types co-located in `apps/api/src/types/kit.ts` avoids unnecessary build-step overhead of a separate packages monorepo build, while keeping the types cleanly decoupled from Mongoose models so they can be consumed by both pure functions and validators.

### Runtime Schema Validator: Zod Selection
- **Decision**: Chosen **Zod** over Ajv for the runtime validator (`apps/api/src/validation/kitValidator.ts`).
- **Reasoning**:
  1. Zod provides first-class TypeScript type inference and expressive composite validation without needing JSON-schema compilation steps.
  2. The `.superRefine()` hook enables referential integrity enforcement: asserting that all `question_ids` in `schedule.days` exist in `questions`, and all `requirement_ids` referenced in questions exist in `role.requirements`.
  3. Formatted error messages surface granular JSON paths directly to API callers and the LLM retry loop.

### Item State Tags Architecture
- **Decision**: Attached `state: "generated" | "edited" | "pinned"` with a default of `"generated"` across `requirements`, `questions`, and `flashcards`.
- **Reasoning**: Scaffolding for Phase 11 (The Builder), ensuring that during future regeneration cycles, user-modified items (`"edited"` or `"pinned"`) are never clobbered or discarded.

---

## 2026-09-10: Phase 4 Decisions — Retrieval: Company Crawler, Page Fetcher & SSRF Barrier

### SSRF Protection Barrier
- **Decision**: Implemented `validateUrlForFetch(url, allowLocal)` in `apps/api/src/pipeline/retrieval/ssrf.ts`.
- **Reasoning**:
  1. Blocks non-HTTP/HTTPS schemes (file, ftp, gopher).
  2. Blocks localhost hostnames (`localhost`, `127.0.0.1`, `::1`, `0.0.0.0`).
  3. Blocks RFC1918 private IPv4 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
  4. Blocks link-local addresses and cloud metadata services (`169.254.169.254`).
  5. Provides explicit opt-in bypass via `ALLOW_LOCAL_FETCH=true` or options parameter, ensuring the batch evaluation test harness (serving fixture sites on localhost) functions seamlessly without compromising production security.

### HTML Boilerplate Stripping & Content Extraction
- **Decision**: Used `cheerio` with selective element extraction rather than heavier headless browser runtimes.
- **Reasoning**:
  - Strips noisy non-content elements (`script`, `style`, `nav`, `footer`, `header`, `noscript`, `svg`, `form`, `dialog`, `iframe`, and elements with `aria-hidden="true"`).
  - Normalizes whitespace and paragraphs to preserve readable text flow.
  - Enforces a 1 MB response size cap and 8-second request timeout to avoid slowloris/DoS attacks.
  - Automatically resolves relative `href` links into absolute canonical URLs.

### Dynamic Link Ranking over Hardcoded Paths
- **Decision**: Heuristic scoring engine (`rankLinks` in `apps/api/src/pipeline/retrieval/linkRanker.ts`) evaluating both anchor text and URL pathnames against targeted hiring (`hiring`, `careers`, `jobs`, `positions`, `work-with-us`, `openings`, `join`) and about (`about`, `mission`, `values`, `team`, `story`, `engineering`) keywords.
- **Reasoning**: Companies frequently nest hiring portals under arbitrary slugs (e.g. `/join-our-crew-2026` or `/jobs/engineering`). Static path guessing fails on unconventional URLs. Heuristic ranking dynamically floats high-signal links to the top.

### Robots.txt Compliance
- **Decision**: Implemented `parseRobotsTxt` in `apps/api/src/pipeline/retrieval/robots.ts`.
- **Reasoning**: Matches target User-Agent (`*` and `trao-crawler/1.0`), respects explicit `Allow:` and `Disallow:` directives, records disallowed paths in `pagesSkipped`, and safely defaults to allow-all if `robots.txt` is absent (404) or unreachable.

### Public Interview Discussion Search Strategy
- **Decision**: Implemented `searchPublicInterviewDiscussion(companyName)` in `apps/api/src/pipeline/retrieval/discussion.ts` with transparent null fallback.
- **Reasoning**: Connects to Tavily Search API when `TAVILY_API_KEY` is present. When absent or unconfigured, it returns `null` cleanly without throwing errors and strictly adheres to the rule: **Never invent facts**. LLM generation downstream operates honestly with company about/hiring text alone when public discussions are unavailable.

---

## 2026-09-10: Phase 5 Decisions — LLM Extraction: Requirements & Company Brief

### Provider & Model Selection: OpenRouter
- **Decision**: Implemented **OpenRouter** (`https://openrouter.ai/api/v1/chat/completions`) as the exclusive unified LLM API gateway, configured with `OPENROUTER_API_KEY` and configurable model via `OPENROUTER_MODEL` (defaulting to `google/gemini-2.5-flash` or models like `openrouter/free`).
- **Reasoning**:
  1. OpenRouter provides direct access to top-tier models (Gemini 2.5 Flash, Claude, Llama 3.3, DeepSeek) through a single standard OpenAI-compatible API without vendor lock-in.
  2. The custom client implementation in `apps/api/src/pipeline/llm/client.ts` uses native `fetch` with zero SDK bloat, full streaming/JSON mode support (`response_format: { type: "json_object" }`), custom `HTTP-Referer`/`X-Title` headers, and automatic exponential backoff on 429/5xx status codes with jitter.

### Grounding, Untrusted Source Framing & Thin-JD Handling
- **Decision**:
  1. All untrusted job descriptions and crawled page texts are encapsulated inside `<source>` blocks per Rule 5, preventing prompt injection.
  2. Prompts strictly forbid the LLM from inventing, hallucinating, or extrapolating qualifications not explicitly stated in the text.
  3. Thin-JD handling is explicitly enforced: when presented with a 1-3 line JD, the prompt forbids padding or expanding the requirements, and returns only the atomic requirements directly present.

### Must vs Nice Priority Split
- **Decision**: Instructed the LLM to separate mandatory requirements (`must`) from optional/preferred qualifications (`nice`) as distinct signals.
- **Reasoning**: Per the brief, recruiters and grading benchmarks heavily penalize conflating optional bonuses (e.g., "bonus if you know Go") with hard prerequisites (e.g., "5+ years TypeScript required").

### Code-Assigned Stable IDs & Defensive Corrective Retry
- **Decision**:
  1. The LLM is never asked to generate requirement IDs. Stable IDs (`r1`, `r2`, ...) and `state: "generated"` are assigned deterministically in code after output parsing.
  2. Outputs are defensively parsed (stripping any accidental markdown code fences) and validated against Zod schemas.
  3. If JSON parsing or Zod schema validation fails on the first attempt, the system issues a single corrective follow-up prompt providing the exact error details. If it fails a second time, it throws a typed `LLMError` with code `LLM_INVALID_OUTPUT`.

### Honest Empty Crawl Fallback (Rule 4 Compliance)
- **Decision**: In `extractCompanyBrief(aboutText, hiringText)`, if both inputs are empty, null, or whitespace-only, the function returns `{ summary: "No public company information found.", what_they_do: "No public company information found." }` directly in code without calling the LLM.
- **Reasoning**: Strictly complies with Rule 4: "Never invent facts; return honest empty/unfound states when crawl or public info is missing." Calling an LLM with no source text causes hallucination; intercepting at the code layer ensures 100% honesty.

---

## 2026-09-10: Phase 6 Decisions — Question & Flashcard Generation

### Separate LLM Calls Per Requirement & Category
- **Decision**: Built `generateQuestionsForRequirement(requirement, category, hiringProcessContext)` to execute dedicated, isolated LLM calls per requirement/category rather than a single monolithic batch call.
- **Reasoning**:
  1. The brief explicitly evaluates prompt sequencing and quality. A technical skill like "TypeScript event loop" demands fundamentally different evaluation framing than a behavioural skill like "cross-team mentorship."
  2. Granular calls eliminate prompt dilution, ensure every single requirement receives dedicated interview attention, and allow fine-grained error resilience (a single timeout on one question does not abort the entire prep kit).

### Category-Specific Prompt Differentiation
- **Decision**: Implemented `buildCategorySystemPrompt(category, hiringProcessContext)` producing distinct evaluator personas and evaluation criteria:
  - **Technical**: Implementation depth, debugging scenarios, performance bottlenecks, runtime trade-offs.
  - **Behavioural**: STAR method (Situation, Task, Action, Result), leadership under ambiguity, conflict resolution.
  - **System Design**: Scale (throughput/latency), partitioning strategies, failure modes, consistency trade-offs.
  - **Company Fit**: Cultural adaptability, mission alignment, communication style.

### Dynamic Hiring-Process Context Integration
- **Decision**: If crawl/retrieval discovered hiring-process details (e.g. whiteboard system design round, take-home challenge, live pair programming), this context is injected inside `<hiring-process>` tags to align the questions with the company's real interview stages. When absent, it falls back to standard industry benchmarks without hallucinating custom rounds.

### Flashcard Derivation & Dual Strategy
- **Decision**: In `generateFlashcards(questions)`:
  1. Primary path uses the LLM to condense questions into high-yield spaced-repetition prompt/answer flashcards.
  2. Automatic fallback path distills directly from the question prompt and answer outline if LLM call times out or is bypassed, guaranteeing the kit is never missing flashcards.
  3. Stable sequential IDs (`f1`, `f2`...) and `requirement_ids` are mapped deterministically in code.

---

## 2026-09-10: Phase 7 Decisions — Coverage Loop & Schedule Allocation

### Pure Set-Logic Coverage Check (Rule 3 Compliance)
- **Decision**: Implemented `findUncoveredRequirements(requirements, questions)` and `runCoverageLoop` as pure TypeScript set logic (`allReqIds - coveredReqIds`).
- **Reasoning**:
  1. Strictly follows Rule 3: Deterministic logic never goes to the LLM. An LLM might hallucinate that an item is covered when no corresponding question exists.
  2. Mandatory gaps (`must`) trigger targeted LLM follow-up generation passes.
  3. Any remaining `nice` gaps are preserved honestly without fake questions or dropped requirements.

### Deterministic Schedule Allocation & Partitioning
- **Decision**: Implemented `allocateSchedule(questions, timelineDays)` using pure arithmetic bin packing.
- **Reasoning**:
  1. Sorts candidate questions by priority (`must` over `nice`) and difficulty (3 -> 2 -> 1) to maximize mastery of critical competencies early in the study plan.
  2. Handles edge cases:
     - **1-day timeline**: All questions packed into Day 1 with intensive cramming blocks.
     - **5-day timeline**: Evenly distributed workload partitions.
     - **60-day timeline**: Questions distributed across early foundation days with spaced repetition review drills scheduled on later days so that no day is left empty.
  3. Guaranteed invariants: All `allocated_minutes >= 15`, every day has `day: number` and `items: ScheduleItem[]`.

---

## 2026-09-10: Phase 8 Decisions — Pipeline Orchestration & Async Kit Creation Route

### End-to-End Orchestrator (`generateKit`)
- **Decision**: Implemented `generateKit({ jd, companyUrl, days, options })` in `apps/api/src/pipeline/orchestrate.ts` sequentially coordinating:
  1. Phase 4: Company site crawler (discovering about and hiring pages).
  2. Phase 5: LLM requirement extraction (`extractRequirements`) and grounded company brief (`extractCompanyBrief`).
  3. Phase 6: Per-requirement question generation (`generateAllQuestions`).
  4. Phase 7: Pure set logic coverage verification loop (`runCoverageLoop`).
  5. Phase 6: High-yield spaced repetition flashcards (`generateFlashcards`).
  6. Phase 7: Deterministic arithmetic schedule allocation (`allocateSchedule`).
  7. Appendix A assembly with role metadata parser (`parseRoleMetadata`) and strict structure validation (`assertValidKit`).
- **Reasoning**: Ensures all stages are wired into a single typed pipeline callable by both the HTTP API route and the future Phase 9 batch evaluation CLI.

### Robust Graceful Degradation (Rule 4 Compliance)
- **Decision**: If company website crawl fails, 404s, or times out, the pipeline catches the error gracefully, populates `pages_used: []`, falls back to honest brief `"No public company information found."` without LLM calls, and proceeds with JD-only extraction. If LLM calls fail after exponential retries, typed `LLMError` exceptions are surfaced to the caller.

### Truly Async Route & Status Polling (`POST /kits`, `GET /kits/:id/status`)
- **Decision**:
  1. `POST /kits` responds immediately with HTTP `202 Accepted` and `{ kitId, status: "generating" }`, preventing HTTP timeout during 30-90 second generation runs.
  2. Background execution updates progress stages (`retrieving`, `extracting`, `generating_questions`, `verifying_coverage`, `generating_flashcards`, `allocating_schedule`, `completed`) on the kit record in MongoDB.
  3. `GET /kits/:id/status` provides a lightweight, owner-scoped polling endpoint returning the active stage and status.

### Idempotency & Rate Limit Protection
- **Decision**: Implemented `computeGenerationHash(userId, jd, companyUrl, days)` using SHA-256 with a 15-minute sliding window.
- **Reasoning**: Protects the user's OpenRouter rate limits from accidental double-clicks or duplicate submissions. If a kit with the exact same inputs is already generating or completed within 15 minutes, the existing kit ID is returned immediately with `isDuplicate: true` rather than spawning a duplicate generation job.





