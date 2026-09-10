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
