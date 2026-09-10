# Phase 14 — Deployment & README (Final Phase)

**Goal:** publicly reachable app, complete README, ready to submit. If you
have slack time left, the optional creative feature (see note at the end)
happens before this phase, as its own separate phase.

**Prerequisites:** Phase 13 merged (and the creative-feature phase, if you
did one).

---

## Prompt to paste into your AI IDE

> Prepare the project for deployment and finish the README.
>
> Requirements:
> 1. Deploy `apps/web` and `apps/api` to free-tier hosts of your choice
>    (e.g. Vercel for the Next.js app, Render/Railway/Fly.io for the
>    Express API, MongoDB Atlas free tier for the DB) — pick platforms you
>    can actually get working within the timebox, document them in the
>    README, and make sure environment variables are set securely on the
>    host (never committed).
> 2. CORS configured correctly between the deployed frontend and API
>    origins.
> 3. Confirm the deployed app supports the full flow: register → create a
>    kit against a real company URL → builder edits persist → practice
>    mode works — from the actual public URL, not just localhost.
> 4. Write the final `README.md` covering exactly what the brief requires:
>    - Project overview and chosen tech stack, with justification if
>      different from the preferred stack
>    - Setup instructions, local and deployed, and the exact commands to
>      install and run the batch entry point
>    - Which LLM provider and model was used
>    - High-level architecture (a simple diagram or clearly structured
>      text is fine)
>    - Retrieval approach and which sources were used
>    - How the research/generation steps are sequenced and what each is
>      responsible for
>    - How generated/edited/pinned state is represented
>    - How the schedule is allocated
>    - Explanation of the creative feature, if one was built
>    - Key design decisions and trade-offs, and known limitations — pull
>      this largely from the accumulated `docs/decisions.md`
> 5. Double check `.env.example` in both apps is complete and every var
>    has a one-line comment on what it's for.
> 6. Confirm `npm run evaluate -- --input <cases.json> --output <kits.json>`
>    still works from a genuinely clean clone (clone into a fresh temp
>    directory and run it, don't just trust it works because it worked
>    once mid-development).
>
> When done: give me the deployment URL, confirm the clean-clone batch
> command output, and the final README content for review before I record
> the walkthrough video and submit.

## Acceptance criteria
- [ ] Deployed frontend and backend both publicly reachable
- [ ] Full user flow works on the deployed URL
- [ ] `npm run evaluate` works from a genuinely fresh clone
- [ ] README covers every bullet point required by the brief

## Suggested commit message
`docs: finalize README and deployment configuration`

---

## Optional: Creative Feature (only if you have slack time)
If you build one, treat it as its own phase between Phase 13 and this
one, with its own prompt, e.g.:

> Add [a "weak spots" report that aggregates low-confidence practice
> attempts by requirement / a printable one-page export / a
> compare-two-postings overlap view — pick one]. Explain in
> `docs/decisions.md` what real problem this solves for someone actually
> preparing for an interview, not just that it's a nice addition. Test the
> core logic (not just the UI). Do not let this delay the deployment
> phase — this is explicitly optional and worth fewer points than the
> core builder/practice work already done.

Suggested commit message: `feat: add [feature name] as optional creative addition`
