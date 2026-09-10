# Phase 6 — Question & Flashcard Generation

**Goal:** turn extracted requirements + hiring-process research into
categorized questions and flashcards. Separate calls per requirement/
category, not one call that returns everything (the brief explicitly
grades this sequencing).

**Prerequisites:** Phase 5 merged.

---

## Prompt to paste into your AI IDE

> Build `apps/api/src/pipeline/generation/generateQuestions.ts` and
> `generateFlashcards.ts`.
>
> Requirements:
> 1. `generateQuestionsForRequirement(requirement, category, hiringProcessContext)`
>    — generates 1-3 questions for ONE requirement in ONE category
>    (`technical | behavioural | system-design | company-fit`) per call.
>    Do not batch all requirements into a single prompt — the brief is
>    explicit that a requirement like "5+ years React" should produce
>    different questions (and via a different call/instructions) than
>    "mentors junior engineers," and that a hiring page mentioning a
>    take-home + system-design round should change what gets generated.
>    Pass `hiringProcessContext` into the prompt so system-design
>    questions only get generated/weighted if the research actually
>    surfaced a system-design round (or default sensibly with a
>    documented fallback if research found nothing — note this in
>    decisions.md).
> 2. Orchestrate in `generateAllQuestions(requirements, hiringProcessContext)`:
>    decide sensible category assignment per requirement (e.g. a technical
>    "must" skill → technical + maybe system-design; a "mentors juniors"
>    requirement → behavioural), call the per-requirement generator, and
>    assemble stable `q1, q2, ...` ids assigned in code, each carrying
>    `requirement_ids` back-references and `state: "generated"`.
> 3. `generateFlashcards(questions)`: derives flashcards from a subset of
>    generated questions (front = prompt or a condensed version, back =
>    the answer outline), with `requirement_ids` carried through, ids
>    assigned in code.
> 4. Reuse the LLM client wrapper and defensive-parsing/retry pattern from
>    Phase 5 — don't duplicate that logic, extract a shared helper if you
>    haven't already.
> 5. Validate the assembled questions/flashcards array against the
>    Appendix A shape (reuse the Phase 3 validator) before returning.
> 6. Tests: mock LLM — different requirements/categories produce
>    distinguishably different question content in the prompts sent (i.e.
>    assert the prompt text sent to the mock differs meaningfully by
>    category and by hiring-process context, not just the fixture output);
>    a requirement generating zero usable questions is handled without
>    crashing the whole batch; ids are unique and stable across a full run.
>
> Do NOT build the coverage-check/gap-fill loop or the schedule yet —
> this phase only produces the first-draft question/flashcard set.
>
> When done: run tests, tell me what's deferred, propose a commit message.

## Acceptance criteria
- [ ] Different requirement categories produce visibly different prompts/
      output style (proof the sequencing is genuine, not one shared call)
- [ ] Hiring-process context changes what's generated when present
- [ ] All output validates against the Appendix A shape

## Suggested commit message
`feat(generation): add per-requirement question and flashcard generation`
