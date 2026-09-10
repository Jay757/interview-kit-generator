# Phase 5 — LLM Extraction: Requirements from the Job Description

**Goal:** the first LLM-touching step — extracting structured requirements
(and role/company_brief basics) from raw JD text + retrieved pages. This
is graded most heavily (20 pts for extraction accuracy), so get this one
right and well-tested before moving on.

**Prerequisites:** Phase 4 merged.

---

## Prompt to paste into your AI IDE

> Build `apps/api/src/pipeline/generation/extractRequirements.ts` (and a
> sibling for the company brief), isolated from retrieval and from any
> other generation step.
>
> Requirements:
> 1. LLM client wrapper in `apps/api/src/pipeline/llm/client.ts`: wraps
>    calls to [YOUR CHOSEN PROVIDER]'s chat completion endpoint, with
>    retry + exponential backoff on 429/5xx, a request timeout, and a
>    typed `callLLM(systemPrompt, userPrompt, { jsonMode? })` function.
>    Read the API key from env; document it in `.env.example`.
> 2. `extractRequirements(jdText)`: prompts the model to return ONLY a
>    JSON array of `{ text, kind: technical|behavioural|domain, priority:
>    must|nice }` objects, derived strictly from what the JD actually
>    says. The prompt must explicitly instruct the model not to invent
>    requirements beyond the text, and must instruct it to tell "required/
>    must have" language apart from "nice to have/bonus points" language
>    when assigning priority — per the brief, these are graded as
>    distinct signals, not synonyms.
> 3. After the LLM call: parse the JSON defensively (strip markdown
>    fences if present), validate it against a Zod/Ajv schema for this
>    step's expected shape, and on invalid/unparseable output, retry once
>    with a corrective follow-up prompt before giving up and surfacing a
>    typed error (`LLM_INVALID_OUTPUT`) rather than crashing.
> 4. Assign stable ids (`r1`, `r2`, ...) to each requirement in code after
>    the LLM call — do not ask the model to generate ids.
> 5. `extractCompanyBrief(aboutText, hiringText)`: similar shape, produces
>    `{ summary, what_they_do }`; if both inputs are empty/null (crawler
>    found nothing), do not call the LLM to hallucinate a brief — return
>    an honest "no public information found" summary directly in code.
> 6. Handle the thin-JD edge case explicitly: a 2-line JD should still
>    produce a short, honest requirements list (even if it's just 1-2
>    items) rather than the model padding it out — test this with a
>    fixture 2-line JD and assert the output stays small and grounded in
>    the actual text.
> 7. Tests: mock the LLM client (don't hit a real API in CI) for — happy
>    path with a realistic JD fixture, malformed-JSON-then-recovers-on-
>    retry, persistent-invalid-output-surfaces-typed-error, empty
>    about/hiring text produces the honest no-info brief without an LLM
>    call, thin JD produces a small grounded list. Also include ONE
>    integration-style test that hits the real provider if an API key is
>    present in the test env (skip gracefully if not), so you have proof
>    it works against the live model, not just mocks.
>
> Do NOT build question generation, scheduling, or coverage checking yet
> — this phase is extraction only, wired to nothing beyond its own tests.
>
> When done: run tests, tell me what's deferred (including which real
> LLM provider/model you used, for the README later), propose a commit
> message.

## Acceptance criteria
- [ ] Real-JD fixture produces requirements with correct must/nice split
- [ ] Malformed LLM output is retried, not fatal
- [ ] Empty crawl input never triggers a fabricated brief
- [ ] Thin JD produces a proportionally thin, honest requirement list

## Suggested commit message
`feat(generation): add LLM-backed requirement extraction with validation and retry`
