# How to use this folder

This is a phase-by-phase build plan for the Trao "AI Interview Prep Kit"
assessment, designed to run through an AI IDE agent (Claude Code, Cursor,
Windsurf, etc.) one phase at a time, producing a genuine incremental
commit history.

## Setup (do this once)
1. Create the repo, copy `reference-docs/*.json` into `docs/` in the repo,
   and paste the original assessment brief text into `docs/brief.md`.
2. Load `00-RULES.md` into your AI IDE's persistent rules/system-prompt
   file (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, or your tool's
   equivalent). Fill in the two `[FILL IN]` placeholders (LLM provider,
   scraping library) once you've decided.
3. Create `docs/decisions.md` as an empty file with just a heading — the
   agent will append to it throughout.

## Running each phase
For each numbered file below, in order:
1. Open a fresh chat/session with your agent (don't let context bleed
   across phases — it's part of why the phases are scoped this tightly).
2. Paste the "Prompt to paste into your AI IDE" block from that file.
3. Let the agent work, review its output against that file's
   "Acceptance criteria."
4. If it passes, accept the proposed commit message (edit if needed) and
   commit. If it doesn't pass, tell the agent what's missing and let it
   fix within the same phase before moving on — don't let scope leak into
   the next phase's file.
5. Move to the next numbered file.

## Phase order
| # | File | What it produces |
|---|------|-------------------|
| 1 | `01-phase-project-setup.md` | Empty monorepo skeleton, both apps boot |
| 2 | `02-phase-auth.md` | Register/login/logout, protected routes |
| 3 | `03-phase-data-models-schema.md` | Appendix A schema + validator + CRUD |
| 4 | `04-phase-scraping-crawler.md` | Company crawler, hiring-page finder |
| 5 | `05-phase-llm-extraction.md` | LLM requirement + brief extraction |
| 6 | `06-phase-question-generation.md` | Per-requirement question/flashcard generation |
| 7 | `07-phase-coverage-schedule.md` | Deterministic coverage loop + schedule allocation |
| 8 | `08-phase-pipeline-orchestration.md` | Full pipeline wired into async `POST /kits` |
| 9 | `09-phase-batch-cli.md` | Mandatory `npm run evaluate` command |
| 10 | `10-phase-frontend-creation-ui.md` | Creation flow, progress states, read-only view |
| 11 | `11-phase-builder-editing.md` | Edit/reorder/regenerate-without-clobbering |
| 12 | `12-phase-practice-mode.md` | Flashcard practice mode |
| 13 | `13-phase-edge-cases-robustness.md` | Brief's 8 edge cases, verified + closed |
| — | *(optional)* creative feature | See note at end of Phase 14 file |
| 14 | `14-phase-deployment-readme.md` | Deployment + final README |

## Why this order
- Auth/schema/CLI-shape come before anything LLM-related, since the two
  "exact" pieces (Appendix A/B) need to be locked in early — everything
  downstream is built to match them, not the other way around.
- Retrieval → extraction → generation → coverage/schedule mirrors the
  brief's own required sequencing (Section 3), so the commit history
  itself demonstrates that the steps are genuinely staged, not a single
  prompt dressed up as a pipeline.
- The batch CLI (Phase 9) comes right after orchestration (Phase 8) and
  before any further frontend work, since it's mandatory and exercises
  the exact same pipeline code the frontend will use — catching pipeline
  bugs here is cheaper than catching them after building UI on top.
- Builder (Phase 11) is deliberately its own phase, after the read-only
  view exists, because it's flagged as the hardest state problem and the
  single biggest human-review line item — it deserves an isolated,
  reviewable commit rather than being folded into general frontend work.
- Edge-case hardening (Phase 13) comes after every feature exists, since
  most of those cases are cross-cutting failure modes you can only fully
  verify once retrieval, generation, and the CLI are all in place.

## A note on the 4-day timebox
Realistically: Phases 1-3 in a few hours, 4-9 (the pipeline core) is the
bulk of day 1-2, 10-12 (frontend + builder + practice) is day 2-3, 13-14
(hardening + deploy + README + video) is day 3, with day 4 as slack for
whatever ran over — per the brief's own guidance that day 4 is slack, not
scope.
