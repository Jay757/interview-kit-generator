# Phase 3 — Kit Data Model & Structure Validation

**Goal:** the exact Appendix A shape exists as a Mongoose schema + a
runtime validator, persistence works, but there is still no scraping or
LLM content yet — kits are created with empty/stub content via a
dev-only route so persistence can be proven.

**Prerequisites:** Phase 2 merged.

---

## Prompt to paste into your AI IDE

> Define the Kit data model matching `docs/appendix-a-kit-structure.json`
> exactly (field names and nesting must match; you may add extra fields
> such as internal state tags, ownership, and timestamps).
>
> Requirements:
> 1. TypeScript types/interfaces for the full kit shape in a shared
>    location both `apps/api` (and later the pipeline) can import from —
>    put them in `apps/api/src/types/kit.ts` (or a shared package if you
>    prefer a workspace package; explain the choice in
>    `docs/decisions.md` either way).
> 2. A runtime validator (e.g. Zod or Ajv — your call, note it in
>    decisions.md) that checks a candidate object against the Appendix A
>    shape: required fields present, priority is `must`/`nice`, category
>    and kind enums are respected, difficulty is an integer 1-3, minutes
>    are integers, every `question_ids` reference in the schedule points
>    to a question id that exists in that kit. This validator will be
>    reused later to validate LLM output before saving — build it now as
>    a standalone, independently testable function.
> 3. Mongoose schema for `Kit`, with an `ownerId` reference to `User`, plus
>    per-item state tags: each requirement/question/flashcard needs a
>    `state: "generated" | "edited" | "pinned"` field even though nothing
>    sets it to anything but `"generated"` yet — this is scaffolding for
>    the builder phase later, don't build the editing logic itself now.
> 4. CRUD routes, all behind `requireAuth`, scoped to the owner: `POST
>    /kits` (accepts a stub/minimal body for now — real generation comes
>    later — just persists whatever valid-shaped kit it's given, running
>    it through the validator first and rejecting invalid shapes),
>    `GET /kits` (list the current user's kits only), `GET /kits/:id`
>    (owner-only, 404/403 appropriately for others' kits), `DELETE
>    /kits/:id`.
> 5. Unit tests for the validator: valid kit passes; missing required
>    field fails; a `question_ids` entry pointing to a non-existent
>    question fails; wrong enum value fails; non-integer `minutes` or
>    `difficulty` fails.
> 6. Unit tests for kit ownership: user A cannot read or delete user B's
>    kit via the API.
>
> Do NOT implement scraping, LLM calls, the frontend builder, or the
> batch CLI in this phase — `POST /kits` just accepts and stores a
> pre-built valid kit object as a stand-in.
>
> When done: run tests, tell me what's deferred, propose a commit message.

## Acceptance criteria
- [ ] Validator has passing tests for valid + several invalid shapes
- [ ] `POST /kits` with a hand-crafted valid kit object persists and
      round-trips via `GET /kits/:id`
- [ ] Cross-user access to another user's kit is blocked and tested

## Suggested commit message
`feat(kits): add kit schema, structure validator, and owner-scoped CRUD`
