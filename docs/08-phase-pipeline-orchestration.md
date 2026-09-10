# Phase 8 — Pipeline Orchestration & Kit Creation Route

**Goal:** wire Phases 4-7 together into one orchestrated pipeline function
that the real `POST /kits` route calls, replacing the Phase 3 stub. This
is the first point where a real end-to-end kit gets generated from a
pasted JD + company URL.

**Prerequisites:** Phase 7 merged.

---

## Prompt to paste into your AI IDE

> Build `apps/api/src/pipeline/orchestrate.ts`:
> `generateKit({ jd, companyUrl, days })` that calls, in order: crawl
> (Phase 4) → extract requirements + brief (Phase 5) → generate questions
> + flashcards (Phase 6) → coverage loop (Phase 7) → schedule allocation
> (Phase 7) → assemble the final object exactly matching Appendix A,
> including the `source` block (`jd_chars`, `researched_at`,
> `pages_used` from the crawler's actual results) → validate against the
> Phase 3 structure validator before returning.
>
> Requirements:
> 1. Every step's failure mode is handled without crashing the whole run:
>    company unreachable → `pages_used: []`, honest brief, pipeline
>    continues with JD-only extraction; LLM step fails after retries →
>    surface a typed, catchable error up to the caller (don't silently
>    return a broken kit).
> 2. Update `POST /kits` to accept `{ jd, companyUrl, days }`, run
>    `generateKit`, validate, persist, and return the kit — replacing the
>    Phase 3 stub-accepting behavior. Handle "generation takes 90 seconds"
>    by making this genuinely async: return a `202` with a job/kit id in
>    `status: "generating"` immediately, run generation in the background,
>    and expose `GET /kits/:id/status` (or push via polling/SSE — your
>    call, document it) so the frontend (next phase) can show progress
>    without a 90-second blocking HTTP call.
> 3. Idempotency: submitting the same `jd` + `companyUrl` twice should not
>    silently create duplicate generation runs charging your free-tier
>    rate limit twice — dedupe by a hash of (jd, companyUrl, days) within
>    some short window, or expose the existing kit instead; document your
>    choice.
> 4. Add an integration test (can hit your mock LLM + the Phase 4 fixture
>    server, no real network) that runs `generateKit` end-to-end for: a
>    normal JD + a site with a hiring page, a thin 2-line JD, and a
>    company URL that 404s — asserting the output shape is valid and
>    honest in each case (no fabricated content when research came up
>    empty).
>
> Do NOT build the frontend generation-progress UI or the batch CLI in
> this phase — that's next. This phase is orchestration + the API route
> + its tests only.
>
> When done: run tests, tell me what's deferred, propose a commit message.

## Acceptance criteria
- [ ] End-to-end `generateKit` test passes for happy path, thin JD, and
      unreachable company
- [ ] `POST /kits` returns immediately with a generating status rather
      than blocking for the full pipeline duration
- [ ] Duplicate submission is handled without double-billing your LLM
      rate limit

## Suggested commit message
`feat(pipeline): orchestrate full generation pipeline behind async kit-creation route`
