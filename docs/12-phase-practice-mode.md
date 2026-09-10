# Phase 12 — Practice Mode

**Goal:** turn the flashcards into something the user works through, not
just reads.

**Prerequisites:** Phase 11 merged.

---

## Prompt to paste into your AI IDE

> Build a practice mode at `/kits/:id/practice`.
>
> Requirements:
> 1. Step through flashcards one at a time: show the front, a "reveal"
>    action shows the back. Keyboard-navigable (space/enter to reveal,
>    arrow keys to move next/previous).
> 2. After reveal, record a confidence rating per card per attempt (e.g. a
>    3-5 point scale — your call). Persist attempts with a timestamp so
>    history accumulates across sessions, not just the current one.
> 3. Coverage view: show which flashcards (and by extension which
>    requirements, via `requirement_ids`) have been practiced at least
>    once vs never touched.
> 4. Ordering for the next session: pick and implement ONE concrete
>    approach — either a simple confidence-weighted sort (lowest-rated/
>    never-seen cards first) or a real spaced-repetition interval (e.g.
>    a simplified SM-2). Either is acceptable per the brief; document your
>    choice and the reasoning in `docs/decisions.md`, including why you
>    didn't pick the other option.
> 5. A small session summary at the end of a practice run (cards
>    reviewed, average confidence, cards still never-attempted).
> 6. Tests: the ordering function reorders correctly given a set of mock
>    attempt histories (this is the one piece of practice mode worth unit
>    testing directly — the rest is mostly UI).
>
> When done: run tests, tell me what's deferred, propose a commit message.

## Acceptance criteria
- [ ] Can step through, reveal, and rate every flashcard in a kit
- [ ] Coverage (practiced vs never-touched) is visible and accurate
- [ ] Next-session ordering visibly reflects the chosen algorithm, and
      it's tested

## Suggested commit message
`feat(practice): add flashcard practice mode with confidence tracking and adaptive ordering`
