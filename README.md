# Trao — AI Interview Preparation Kit

> An intelligent, multi-stage engineering pipeline and web application that converts any raw job description and company URL into an interview preparation kit — complete with company cultural intelligence, atomic requirement extraction, targeted question bank, spaced-repetition flashcards, deterministic study schedules, and an interactive practice sandbox.

---

## 🌟 Architecture & System Overview

```
                      ┌────────────────────────────┐
                      │    User Input / Batch      │
                      │  (JD Text + Company URL)   │
                      └─────────────┬──────────────┘
                                    │
                                    ▼
                      ┌────────────────────────────┐
                      │   Stage 1: Web Crawler     │
                      │  (Cheerio + SSRF Barrier)  │
                      └──────┬──────────────┬──────┘
                             │              │
                    About / Culture    Hiring Signals
                             │              │
                             ▼              ▼
                      ┌────────────────────────────┐
                      │  Stage 2: LLM Extraction   │
                      │ (Requirements + Briefing)  │
                      └─────────────┬──────────────┘
                                    │ Atomic Requirements (r1, r2...)
                                    ▼
                      ┌────────────────────────────┐
                      │ Stage 3: Question Engine   │
                      │  (Technical, System-Design │
                      │   STAR Behavioural, Fit)   │
                      └─────────────┬──────────────┘
                                    │
                                    ▼
                      ┌────────────────────────────┐
                      │  Stage 4: Coverage Loop    │
                      │ (Pure TS Set Gap Analysis) │
                      └─────────────┬──────────────┘
                                    │ 100% Must-Haves Mapped
                                    ▼
                      ┌────────────────────────────┐
                      │ Stage 5: Flashcard Engine  │
                      │ (Spaced Repetition f1, f2) │
                      └─────────────┬──────────────┘
                                    │
                                    ▼
                      ┌────────────────────────────┐
                      │ Stage 6: Schedule Engine   │
                      │ (Pure Arithmetic Day Slots)│
                      └─────────────┬──────────────┘
                                    │
                                    ▼
                      ┌────────────────────────────┐
                      │  Stage 7: Kit Validator    │
                      │ (Strict Appendix A Schema) │
                      └─────────────┬──────────────┘
                                    │
                                    ▼
                      ┌────────────────────────────┐
                      │  Web Builder & Practice    │
                      │ (Inline Edits, Pinning,    │
                      │  AI Bar Raiser Scoring)    │
                      └────────────────────────────┘
```

---

## 🚀 Quickstart & Setup

### Prerequisites
- Node.js >= 18.x
- npm >= 9.x
- MongoDB (local `mongodb://localhost:27017` or MongoDB Atlas URI)
- OpenRouter API Key (or Google Gemini API Key)

### 1. Installation
```powershell
git clone <repo-url>
cd trao
npm install
```

### 2. Environment Variables Configuration

#### Backend (`apps/api/.env`)
```bash
PORT=4000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/trao
SESSION_SECRET=super_secret_session_key_min_32_characters_long!
CLIENT_URL=http://localhost:3000

# LLM Provider Configuration
OPENROUTER_API_KEY=your_openrouter_api_key_here
LLM_PROVIDER=openrouter
OPENROUTER_MODEL=openrouter/free
# Fallback or alternative: google/gemini-2.5-flash

# Security Flags
ALLOW_LOCAL_FETCH=false # Set to true only in automated testing/grading environments
```

#### Frontend (`apps/web/.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Running Locally
```powershell
# Run both Next.js frontend (port 3000) and Express API (port 4000) concurrently:
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the interactive web application.

---

## 🧪 Exact Batch Evaluation Command (Appendix B)

As mandated by Appendix B, Trao includes a standalone command-line evaluation entry point that executes the exact production pipeline without going through HTTP or UI layers:

```powershell
npm run evaluate -- --input <cases.json> --output <kits.json>
```

### Example:
```powershell
npm run evaluate -- --input docs/appendix-b-input.json --output docs/appendix-b-output.json
```

**Guarantees:**
- **Zero Parallel Drift**: Invokes `generateKit()` in `apps/api/src/pipeline/orchestrate.ts` directly.
- **SSRF Test Harness Compatibility**: Supports local test fixture servers (`http://localhost:PORT/...`) when `ALLOW_LOCAL_FETCH=true`.
- **Fault Isolation**: If one test case experiences an unreachable domain or invalid input, it records an honest empty/error state and continues processing remaining cases.

---

## 📦 Tech Stack & Justifications

| Component | Technology | Justification |
|-----------|------------|---------------|
| **Frontend** | Next.js 14 (App Router) + React | Fast server-side rendering, instant client-side transitions, and clean nested route layouts (`/kits/[id]/practice`). |
| **Styling** | Tailwind CSS + Framer Motion | Bespoke design system with Obsidian Dark and Alabaster Light modes, 3D CSS transforms, and fluid micro-animations. |
| **Backend** | Node.js + Express + TypeScript | Lightweight, strictly typed event-driven server with clean separation of pipeline modules. |
| **Database** | MongoDB + Mongoose | Flexible document storage for deeply nested kits, custom user notes, and historical practice session attempts. |
| **LLM Engine** | OpenRouter (`openrouter/free` or `google/gemini-2.5-flash`) | Rapid instruction following with schema-enforced JSON outputs and zero client-side exposure. |
| **Scraper** | Cheerio + Undici | Fast in-memory HTML parsing with strict timeout bounds (4,000ms) and SSRF IP safety filters. |

---

## 🔬 Core Architectural Principles

### 1. Separation of Concerns
Every capability is isolated into its own independent, unit-testable module:
- `apps/api/src/pipeline/retrieval/`: SSRF validation, robots.txt compliance, and link heuristics.
- `apps/api/src/pipeline/generation/`: Atomic requirement extraction, company briefing synthesis, category-specific question authoring, and flashcard distillation.
- `apps/api/src/pipeline/coverage/`: Pure TypeScript set logic verifying 100% of must-have requirements are mapped to questions.
- `apps/api/src/pipeline/schedule/`: Pure arithmetic allocating study load across N days without night-before cramming.
- `apps/api/src/validation/`: Strict runtime schema validation against Appendix A.

### 2. State Preservation (`generated | edited | pinned`)
A prep kit is a living document. Every requirement, question, and flashcard carries a state tag:
- `generated`: Created automatically by the AI pipeline.
- `edited`: Modified by the candidate (e.g. customized notes, refined answers).
- `pinned`: Explicitly locked by the user.

**Regeneration Guarantee**: When a user regenerates questions, flashcards, or the company brief, Trao's merging engine **strictly preserves all `edited` and `pinned` items**, only replacing items tagged as `generated`.

### 3. Deterministic Arithmetic Scheduling
The brief mandates that schedule allocation must **never be delegated to an LLM**:
- Harder (difficulty 3) and must-have requirements are scheduled early in the preparation timeline.
- Review and practice iterations are clustered on the final days.
- **Edge cases**:
  - `days = 1`: Cram mode condenses all must-have topics into Day 1 with exact integer minute allocations.
  - `days = 60`: Expands review and spaced rehearsal intervals so no days are left blank.

### 4. Honest Handling of Edge Cases
Trao strictly follows **Rule 4: Never invent facts**:
- **Thin Job Descriptions**: When given a 2-line stub, Trao extracts only what is explicitly mentioned. It never hallucinates unmentioned frameworks.
- **Missing Hiring Pages**: If a company website lacks a careers or culture page, Trao honestly reports `sources: []` and notes `"No public hiring information found."` rather than fabricating culture perks.
- **SSRF Defense**: Validates hostname resolution; automatically blocks private (10.x, 192.168.x), loopback (127.x), and link-local addresses unless `ALLOW_LOCAL_FETCH=true`.

---

## 💡 Creative Feature: Interactive Practice & AI Bar Raiser Scoring

Beyond passive reading, Trao provides an **Interactive Practice Studio** (`/kits/:id/practice`):

1. **AI Bar Raiser Scoring Engine (`POST /kits/:id/practice/evaluate-answer`)**:
   - Candidates can type their real interview answer for any scenario.
   - Evaluates response against principal benchmarks:
     - Numerical score (0–100)
     - Bar Raiser Verdict (`Strong Hire`, `Hire`, `Leaning Hire`, `Needs Improvement`)
     - Executive summary
     - Specific strengths observed
     - Actionable areas to elevate (missing metrics, failure modes, SLA definitions)
2. **On-Demand Staff-Level Exemplar Synthesis (`POST /kits/:id/practice/generate-answer`)**:
   - Instead of bloating initial generation, candidates can click **"⚡ Generate Full AI Answer"** to synthesize an elite Staff/Principal response on demand.
3. **SM-2 Adaptive Spaced Repetition**:
   - Flip 3D flashcards with keyboard shortcuts (`Space`/`Enter` to flip, arrows to navigate).
   - Rate confidence on a 4-point scale (`Again`, `Hard`, `Good`, `Easy`).
   - Adaptive scheduling automatically prioritizes unseen and low-confidence cards in subsequent sessions.

---

## 📊 Test Suite & Verification Results

Run the full automated test suite:
```powershell
npm test -w apps/api
```

- **Total Test Files**: 13
- **Total Tests**: **103 passed | 1 skipped** (100% passing)
- **Coverage Highlights**:
  - `test/crawler.test.ts`: SSRF protection, redirect handling, and robot barriers.
  - `test/extraction.test.ts`: Thin JD handling, must/nice classification.
  - `test/questions.test.ts`: Category prompt divergence and candidate schema validation.
  - `test/coverage.test.ts`: Gap detection set logic and second-pass closing.
  - `test/schedule.test.ts`: Exact day counting across 1, 5, and 60 days.
  - `test/evaluate.test.ts`: Exact Appendix B batch CLI runner conformance.
  - `test/robustness.test.ts`: 404 URLs, rate limits, malformed JSON, and state preservation.
  - `test/practice.test.ts`: SM-2 spaced repetition ordering and attempt history persistence.

---

## 📜 Key Design Decisions (from `docs/decisions.md`)

- **Concurrency Pooling**: Bounded question generation to 3 concurrent tasks to maximize throughput on free-tier rate limits without triggering 429 throttling.
- **Fail-Fast on Quota**: When providers return HTTP 402 or quota depletion, Trao aborts immediately with a user-friendly toast instead of performing redundant exponential retries.
- **Progressive Synthesis UI**: The web app displays live crawled intelligence and company summaries as soon as Step 1 finishes, eliminating skeleton flicker and providing immediate user value.

---

## 📄 License
MIT License. Built for the Trao Assessment.
