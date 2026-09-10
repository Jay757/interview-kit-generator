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
