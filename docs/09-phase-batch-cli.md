# Phase 9 — Batch Entry Point (Mandatory, Exact Spec)

**Goal:** `npm run evaluate -- --input cases.json --output kits.json`,
using the exact same `generateKit` pipeline as the web app.

**Prerequisites:** Phase 8 merged.

---

## Prompt to paste into your AI IDE

> Build the batch CLI in `apps/api/src/cli/evaluate.ts`, wired to an
> `evaluate` npm script at the root (or in `apps/api`, whichever your
> workspace setup makes cleaner — document the exact command in
> decisions.md and README).
>
> Requirements:
> 1. Parse `--input <path>` and `--output <path>` args (a lightweight
>    parser is fine, no need for a heavy CLI framework).
> 2. Read the input file matching `docs/appendix-b-input.json`'s shape:
>    array of `{ id, jd, company_url, days }`.
> 3. For each case, call the SAME `generateKit()` used by `POST /kits` —
>    no parallel/duplicate pipeline implementation. Await it synchronously
>    per case (or with limited concurrency — your call, but stay within
>    the "5 cases within 15 minutes including retries" budget from the
>    brief; document your concurrency choice).
> 4. On a case failing entirely (e.g. company totally unreachable after
>    retries AND JD too thin to extract anything meaningful — decide your
>    own bar and document it), write `{ id, status: "failed", kit: null,
>    error: { code, message } }`. On a case that produced a kit even with
>    partial research gaps, write `{ id, status: "ok", kit: {...},
>    error: null }` — per the brief, a missing hiring page is NOT a
>    failure, only a total inability to produce a kit is.
> 5. Continue processing remaining cases after one fails — never abort the
>    whole batch run.
> 6. Write final output matching `docs/appendix-b-output.json`'s shape
>    exactly: `{ version, generated_at, kits: [...] }`, one entry per
>    input case, in any order, keyed by the given `id`.
> 7. The command must work from a clean clone with only the documented
>    install step and `.env` vars (no manual DB seeding, etc.) —
>    `MONGODB_URI` still needed since `generateKit` may touch persistence;
>    if you'd rather the CLI skip persistence and just run pure
>    generation, that's fine too, just document which behavior you chose.
> 8. Since the grader serves company sites from `localhost:PORT`, verify
>    your Phase 4 retrieval code's relative-link handling actually works
>    against a real local test server, not just mocked fixtures — spin
>    one up in a test.
> 9. Add a test asserting the full command run (against a small fixture
>    `cases.json` with 2-3 cases including one designed to fail) completes
>    and produces valid Appendix B output.
>
> Do NOT build any frontend batch-upload UI in this phase (that's a
> separate frontend feature, if you build it at all — the brief's
> multi-role prep UI upload feature is distinct from this CLI, don't
> conflate them).
>
> When done: run the command against a real fixture, share the output,
> tell me what's deferred, propose a commit message.

## Acceptance criteria
- [ ] `npm run evaluate -- --input <path> --output <path>` works from a
      clean clone with only `npm install` + `.env` set up
- [ ] Output file matches Appendix B shape exactly
- [ ] A failing case doesn't abort the rest of the batch
- [ ] Timing budget (5 cases / 15 min including retries) is realistic —
      measure it, don't just assume

## Suggested commit message
`feat(cli): add mandatory batch evaluate command using shared pipeline`
