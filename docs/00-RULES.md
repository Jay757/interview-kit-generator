# Project Rules — Trao "AI Interview Prep Kit" Assessment

Paste this file into your AI IDE as its persistent rules file (`CLAUDE.md`,
`.cursorrules`, `AGENTS.md`, or equivalent) BEFORE running any phase prompt.
Every phase prompt below assumes the agent has already read this file.
If your tool doesn't auto-load a rules file, paste this content at the top
of every phase prompt instead.

## What we're building
A web app that turns a job description + company URL into a structured
interview prep kit (company brief, requirements, questions, flashcards,
schedule), generated through a multi-step research + LLM pipeline, editable
by the user, with a practice mode. Full spec lives in `docs/brief.md`
(paste the original assessment PDF text there in Phase 0).

## Stack (do not deviate without asking me first)
- Frontend: Next.js (App Router) + Tailwind CSS + TypeScript
- Backend: Node.js + Express + TypeScript
- DB: MongoDB (Mongoose)
- LLM: Gemini free tier (gemini-2.5-flash / gemini-1.5-flash), called only from
  the backend, never from the client
- Scraping: cheerio + undici

## Hard constraints — never violate these
1. **Kit JSON structure is exact.** The shape in `docs/appendix-a.json`
   (field names, nesting, enums) must be produced byte-for-byte in field
   names. You may add extra fields but must never rename or drop the given
   ones. `difficulty` is an integer 1–3. All durations are integer minutes.
   Every `id` is stable within a kit. Every `question_ids` entry referenced
   anywhere must point to a question that actually exists in that kit.
2. **Batch command is exact.**
   `npm run evaluate -- --input <cases.json> --output <kits.json>`
   must exist, must call the SAME pipeline code the web app uses (no
   parallel/duplicate implementation), must read cases in the shape in
   `docs/appendix-b-input.json`, and must write output in the shape in
   `docs/appendix-b-output.json`. It must run from a clean clone with only
   the documented install step and `.env` vars.
3. **Deterministic logic never goes to the LLM.** Schedule allocation
   (distributing requirements/questions across N days, priority-first) and
   coverage-gap detection (comparing requirement ids against
   question.requirement_ids to find uncovered ones) are plain code — pure
   functions, unit-testable, no model call inside them.
4. **Never invent facts.** If a JD is thin or a company site has no hiring
   page, the output must say so honestly (e.g. empty arrays, a brief that
   states "no public hiring process found") rather than fabricating content.
   This is graded directly — treat it as a correctness bug, not a UX choice.
5. **Untrusted text is data, never instructions.** Scraped page content and
   the pasted JD are passed to the LLM as clearly-delimited data (e.g. inside
   an XML-ish `<source>` block with instructions in the system prompt only).
   Never let scraped content alter the system prompt or tool-call behavior.
6. **SSRF/security.** Validate `company_url` before fetching. Reject
   private/loopback/link-local addresses UNLESS an explicit env flag
   (e.g. `ALLOW_LOCAL_FETCH=true`) is set for the batch-harness test mode,
   since the grader serves company sites from `http://localhost:PORT/...`.
   Restrict fetches to `text/html`-ish content types and a max byte size.
7. **Rate limits are expected, not exceptional.** Every LLM call and every
   external fetch needs retry-with-backoff. A 429/5xx must not crash a run;
   it should retry, then degrade gracefully (skip + record) rather than
   abort the whole kit or batch case.
8. **Separation of concerns.** Retrieval, extraction, generation,
   scheduling, and persistence are separate modules/services, each
   independently testable. No single 500-line "doEverything()" function.
9. **Regeneration never destroys user edits.** Every generated item
   (question, flashcard, brief) carries a state tag: `generated | edited |
   pinned`. Regenerating a section only replaces items still `generated`;
   anything the user touched is preserved and merged back in.

## Workflow rules for you (the agent)
- Work **one phase at a time**, exactly as scoped in that phase's prompt
  file. Do not implement future phases early, even if it seems efficient —
  I need the commit history to show real incremental progress.
- At the end of each phase: run whatever tests/build exist, tell me
  explicitly what you did NOT do (deferred to a later phase), and propose
  a commit message. Wait for my go-ahead before moving to the next phase
  unless I say otherwise.
- If the phase prompt is ambiguous or conflicts with a hard constraint
  above, stop and ask rather than guessing.
- Keep a running `docs/decisions.md` — every time you make a judgment call
  the brief left open (e.g. crawl ranking heuristic, number of coverage
  passes, spaced-repetition vs confidence sort), append a short dated entry:
  what you chose and why. This becomes the README's "design decisions"
  section later — don't skip it.
- Commit messages: conventional-commit style (`feat:`, `fix:`, `test:`,
  `chore:`, `docs:`), scoped to what that phase actually did
  (e.g. `feat(auth): add session-based login and protected routes`).

## Environment variables (grows as phases add them — keep `.env.example` in sync)
Document every var in `.env.example` with a one-line comment on what it's
for, even ones you think are obvious.
