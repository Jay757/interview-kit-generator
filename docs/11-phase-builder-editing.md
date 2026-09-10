# Phase 11 — The Builder: Edit, Reorder, Regenerate Without Clobbering

**Goal:** the single highest-weighted human-review item (15 pts) and the
piece the brief calls "the hardest state problem." Take this phase slowly.

**Prerequisites:** Phase 10 merged. Re-read the `state:
generated|edited|pinned` scaffolding from Phase 3 before starting.

---

## Prompt to paste into your AI IDE

> Turn the read-only `/kits/:id` view from Phase 10 into a genuinely
> editable builder. Design the state model on paper first (write it into
> `docs/decisions.md` before writing code) and confirm it with me in your
> response before implementing if anything is ambiguous.
>
> Requirements:
> 1. Inline editing: any question prompt/answer_outline, flashcard front/
>    back, or company_brief field can be edited in place (no separate
>    edit-mode page navigation). On save, mark that item's `state` as
>    `"edited"` (or `"pinned"` if you distinguish manually-added-and-
>    protected items — document the distinction if you make one).
> 2. Reordering: drag-and-drop (or up/down controls if you'd rather skip a
>    DnD library — either is fine, document the choice) to reorder
>    questions within a category, and to move a question from one
>    category to another.
> 3. Add/delete: manually add a new question or flashcard (marked
>    `"pinned"` immediately since the user authored it directly), delete
>    any question or flashcard. Deleting a question that's referenced in
>    the schedule needs a defined behavior — either cascade-remove it from
>    `schedule.days[].question_ids` or block deletion with a clear message;
>    document and test whichever you pick.
> 4. Regenerate one section (`company_brief`, one question category, or
>    the whole `schedule`) via a "Regenerate" action per section, without
>    touching anything else in the kit.
>    - The core rule: an item still in state `"generated"` may be replaced
>      by regeneration. An item marked `"edited"` or `"pinned"` MUST
>      survive regeneration of its category untouched.
>    - Implement this server-side (not just client-side) — the API route
>      for "regenerate category X" must fetch current items, split into
>      keep-as-is (edited/pinned) vs replaceable (generated), only
>      generate replacements for the replaceable set, merge, re-validate
>      against Appendix A shape, and re-run the coverage check afterward
>      (a regeneration could newly uncover or newly cover a requirement).
> 5. Persist edits with reasonably immediate feel — debounced
>    autosave or explicit save-per-field, not a full-page save button that
>    round-trips on every keystroke (the brief calls this out directly).
>    Show a save-state indicator (saved/saving/error).
> 6. Tests (this phase needs strong coverage given its weight):
>    - Editing a question, then regenerating its category, leaves the
>      edited question unchanged and only replaces still-generated ones.
>    - A manually-added (pinned) question survives a full-category
>      regeneration.
>    - Regenerating the schedule after editing a question's category
>      still respects `daysAvailable` and must-coverage.
>    - Concurrent-edit safety: two rapid edits to the same field don't
>      silently lose one (last-write-wins is fine if documented, but state
>      it explicitly rather than leaving it undefined behavior).
>
> Do NOT build practice mode in this phase.
>
> When done: run tests, walk me through the state model as implemented,
> tell me what's deferred, propose a commit message.

## Acceptance criteria
- [ ] Edited/pinned items provably survive a category regeneration (test,
      not just manual click-through)
- [ ] Reordering and category-moves persist correctly
- [ ] Deleting a scheduled question is handled by a defined, tested rule
- [ ] Editing feels immediate (no full round-trip per keystroke)

## Suggested commit message
`feat(builder): add editable kit state with edit/reorder/regenerate-safe merging`
