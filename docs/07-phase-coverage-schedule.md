# Phase 7 — Coverage Loop & Schedule Allocation (Deterministic Logic)

**Goal:** the two pieces the brief says must NOT be handed to the model:
comparing questions against requirements to find gaps (and closing them),
and allocating material across the requested number of days. Pure,
well-tested code — this is worth real points precisely because it's
supposed to be boringly deterministic.

**Prerequisites:** Phase 6 merged.

---

## Prompt to paste into your AI IDE

> Build two independent, pure-function-heavy modules — no LLM calls
> inside either one, except where the coverage loop calls back into
> Phase 6's generator for gap-filling.
>
> ### 1. `apps/api/src/pipeline/coverage/checkCoverage.ts`
> - `findUncoveredRequirements(requirements, questions)`: plain set
>   logic — every requirement id that appears in NO question's
>   `requirement_ids` is uncovered. Return the list of uncovered ids.
> - `runCoverageLoop(requirements, initialQuestions, generateFn,
>   maxPasses)`: after the first draft, checks coverage; if any `must`
>   requirement is uncovered, calls back into question generation
>   (Phase 6) for just those gap requirement ids, merges the new
>   questions in, and re-checks. Stop when either fully covered or
>   `maxPasses` reached (decide a sensible default, e.g. 2-3, and put the
>   reasoning in `docs/decisions.md`). Return the final question list plus
>   `{ uncovered_requirement_ids, passes }` for the `coverage` field of
>   the kit.
> - This must work even if a `nice` requirement stays uncovered — only
>   `must` requirements are required to reach zero gaps; document how you
>   treat lingering `nice` gaps (still recorded honestly in
>   `uncovered_requirement_ids`, per the brief's "report honestly" theme).
>
> ### 2. `apps/api/src/pipeline/schedule/allocateSchedule.ts`
> - `allocateSchedule(requirements, questions, daysAvailable)`: pure
>   arithmetic. Every `must` requirement's questions must land somewhere
>   in the schedule. Harder/higher-priority material goes earlier, not
>   the night before — implement a concrete ordering rule (e.g. sort by
>   priority then difficulty descending, then round-robin or bucket across
>   days) and write it down in decisions.md so you can defend it.
> - Handle the explicit edge cases from the brief: `days_available = 1`
>   (everything must-have gets crammed into day 1, still integer minutes,
>   still complete) and `days_available = 60` (don't leave days empty —
>   either spread lighter review material across the extra days or state
>   your chosen approach; either is fine, just be consistent and
>   documented).
> - Output must exactly match the `schedule` shape in Appendix A: integer
>   `day`, `focus` string, `question_ids` array, integer `minutes`. The
>   number of `days` entries must equal `daysAvailable` exactly.
>
> ### Tests (this phase lives or dies on tests — it's 15 automated points)
> - Coverage: a requirement with no matching question is flagged; after
>   one gap-fill pass with a mock generator, it's covered; a case where a
>   `nice` requirement stays uncovered after max passes is recorded, not
>   treated as failure.
> - Schedule: exact day count matches `daysAvailable` for 1, 5, and 60;
>   every `must` requirement's question(s) appear somewhere in the
>   schedule; a snapshot test verifying harder/must material clusters in
>   earlier days than easier/nice material.
>
> Do NOT wire this into an end-to-end kit-creation route yet, and do NOT
> build the batch CLI yet — next phase does the orchestration wiring.
>
> When done: run tests, tell me what's deferred, propose a commit message.

## Acceptance criteria
- [ ] `findUncoveredRequirements` + gap-fill loop tests pass
- [ ] Schedule tests pass for 1-day, 5-day, and 60-day cases
- [ ] Both modules have zero LLM calls except the documented gap-fill
      callback

## Suggested commit message
`feat(pipeline): add deterministic coverage-gap detection and schedule allocation`
