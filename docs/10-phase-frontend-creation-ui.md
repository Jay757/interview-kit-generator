# Phase 10 — Frontend: Kit Creation & Multi-Role Input

**Goal:** the actual user-facing creation flow — paste JD + company URL +
days, watch generation progress, land on the read-only kit view. Also the
multi-role batch-upload-via-UI feature (distinct from the CLI in Phase 9).

**Prerequisites:** Phase 9 merged.

---

## Prompt to paste into your AI IDE

> Build the kit-creation frontend in `apps/web`.
>
> Requirements:
> 1. `/kits/new` page: textarea for the JD, text field for company URL,
>    numeric input for days-until-interview, submit button. Client-side
>    validation (non-empty JD, valid-looking URL, days as a positive
>    integer) before hitting the API.
> 2. "Prepare for more than one role" support: either a way to paste
>    another JD+company pair and repeat, or a file upload of
>    description-and-company pairs (your call — the brief allows either;
>    document which you picked and why in decisions.md). If file upload,
>    define a simple format (CSV or JSON) and validate it client-side
>    with clear error messages for malformed rows.
> 3. On submit: call `POST /kits`, get back the generating-status kit id,
>    redirect to `/kits/:id` which polls `GET /kits/:id/status` (from
>    Phase 8) and shows a real progress UI — not just a spinner: show
>    which pipeline stage is active if your status endpoint exposes that
>    granularity (crawling → extracting → generating questions →
>    checking coverage → done), or a simpler indeterminate state if you
>    didn't build stage-level status — be honest about what you actually
>    built.
> 4. Clear failure states: company totally unreachable, LLM failure after
>    retries, invalid JD — each shown as a distinct, actionable message,
>    not a generic "something went wrong."
> 5. `/kits` list page: the signed-in user's kits, each showing company/
>    role/status, linking to the detail view.
> 6. `/kits/:id` read-only view (once generation completes): company
>    brief, role breakdown with requirements (must/nice badges), question
>    bank grouped by category, flashcards, schedule by day. No editing
>    yet — that's next phase.
> 7. Responsive layout usable on a phone, keyboard-navigable (tab order,
>    focus states, no keyboard traps).
>
> Do NOT build the editing/reordering/regeneration builder yet, and do
> NOT build practice mode yet — this phase is creation + read-only display
> only.
>
> When done: walk me through the flow (or describe it if I can't see it
> live), tell me what's deferred, propose a commit message.

## Acceptance criteria
- [ ] Full flow works end-to-end from the UI: paste JD → see progress →
      land on a populated read-only kit page
- [ ] A deliberately-broken input (bad URL, empty JD) shows a clear error
      before or after submission, not a crash
- [ ] Usable on a narrow viewport and via keyboard only

## Suggested commit message
`feat(web): add kit creation flow with progress states and read-only kit view`
