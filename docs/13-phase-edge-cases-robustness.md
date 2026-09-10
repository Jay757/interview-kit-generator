# Phase 13 — Edge Cases, Robustness Pass, and Remaining Tests

**Goal:** deliberately attack the app with every failure case the brief
lists in Section 10, and close whatever breaks. This phase is about
finding gaps, not adding features.

**Prerequisites:** Phase 12 merged.

---

## Prompt to paste into your AI IDE

> Go through this exact list from the brief and, for each one, write a
> test that reproduces it (if one doesn't already exist from earlier
> phases) and fix any behavior that doesn't degrade gracefully:
>
> 1. Company URL is invalid, returns 404, or times out
> 2. Company site has no discoverable hiring or about page
> 3. Job description is a two-line stub with almost nothing to extract
> 4. Public discussion of the company turns up nothing at all
> 5. The model returns invalid JSON or an incomplete kit
> 6. LLM provider rate-limits or briefly fails
> 7. Same description and company submitted twice
> 8. User asks for a 1-day schedule, or a 60-day one
>
> For each, confirm and note in `docs/decisions.md`:
> - What the actual behavior is now (should already mostly be handled from
>   earlier phases — this is a verification + gap-closing pass, not a
>   from-scratch build)
> - Whether it's classified as `status: "ok"` (partial, honest result) or
>   `status: "failed"` (nothing producible at all) in the batch CLI
>   context, matching the brief's rule: "a case you could only partially
>   research is still ok... reserve failed for a case you could not
>   produce a kit for at all"
>
> Also do a general robustness sweep:
> - Every external call (LLM, fetch) has a timeout and won't hang the
>   request/job indefinitely
> - Errors returned to the frontend are structured (`{ code, message }`),
>   never raw stack traces
> - Add/complete automated tests for the three areas the brief calls out
>   as "most worth protecting" if any gaps remain: schedule allocation,
>   coverage checking, structure validation (these should mostly exist
>   from Phases 3 and 7 — this is a coverage audit, add what's missing)
>
> Do NOT add new user-facing features in this phase (no creative feature
> yet — that's optional and separate, do it only if you have slack time
> after this).
>
> When done: give me a short table of the 8 edge cases and how each is
> currently handled, run the full test suite, propose a commit message.

## Acceptance criteria
- [ ] All 8 listed edge cases have a passing test
- [ ] No edge case crashes the app or the batch CLI
- [ ] Full test suite passes

## Suggested commit message
`test: verify and harden edge-case handling across pipeline and batch CLI`
