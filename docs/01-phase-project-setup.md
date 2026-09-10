# Phase 1 — Project Setup & Scaffolding

**Goal:** a running, empty skeleton — no features yet — with the full repo
shape, tooling, and docs folder in place. Nothing in this phase touches
business logic.

**Prerequisites:** `00-RULES.md` loaded into the agent's context/rules file.
Copy `reference-docs/appendix-a-kit-structure.json`,
`appendix-b-input.json`, and `appendix-b-output.json` into `docs/` in the
new repo first, plus the full original assessment brief text into
`docs/brief.md`, before running this prompt.

---

## Prompt to paste into your AI IDE

> Set up a monorepo for this project with two apps: `apps/web` (Next.js
> App Router, TypeScript, Tailwind CSS) and `apps/api` (Node.js + Express,
> TypeScript). Use npm workspaces at the root (no need for Turborepo/Nx —
> keep tooling minimal). Also create `apps/api/src/pipeline/` as an empty
> folder with a `.gitkeep` — this is where retrieval/extraction/generation/
> scheduling modules will live starting in later phases, so scaffold the
> folder now but do not implement anything inside it yet.
>
> Requirements for this phase only:
> 1. Root `package.json` with workspaces, and a root `README.md` stub with
>    just a title and a "Setup instructions" heading (to be filled in the
>    final phase).
> 2. `apps/api`: Express app with a single `GET /health` route returning
>    `{ status: "ok" }`. TypeScript configured with strict mode. ESLint +
>    Prettier configured for both apps, consistent rules.
> 3. `apps/web`: default Next.js app-router starter page, Tailwind
>    configured, calls `apps/api`'s `/health` endpoint from a server
>    component or a simple client fetch and displays the result — this is
>    just to prove the two apps can talk to each other locally.
> 4. MongoDB connection module in `apps/api/src/db/connection.ts` using
>    Mongoose, reading `MONGODB_URI` from env, with a clear error if the
>    var is missing. Do not define any schemas yet.
> 5. `.env.example` files in both apps documenting every var used so far
>    (`MONGODB_URI`, `PORT`, `NEXT_PUBLIC_API_URL`, etc.), each with a
>    one-line comment.
> 6. `.gitignore` covering node_modules, `.env`, `dist`/`.next`, etc.
> 7. Root `npm run dev` script that runs both apps concurrently
>    (`concurrently` package is fine).
> 8. Do NOT add authentication, database schemas, scraping, or LLM code —
>    that's later phases. Do NOT add the `npm run evaluate` batch command
>    yet either; just leave `docs/` with the three reference JSON files
>    and `docs/brief.md` committed as-is.
>
> When done: confirm `npm run dev` boots both apps and the web page shows
> the health check succeeding. List what you built, then propose a commit
> message.

## Acceptance criteria
- [ ] `npm install && npm run dev` from a clean clone brings up both apps
- [ ] Web page visibly confirms it reached the API's `/health` route
- [ ] `docs/brief.md`, `docs/appendix-a-kit-structure.json`,
      `docs/appendix-b-input.json`, `docs/appendix-b-output.json` are
      committed
- [ ] No auth, schema, scraping, or LLM code exists yet

## Suggested commit message
`chore: scaffold Next.js + Express monorepo with health check`
