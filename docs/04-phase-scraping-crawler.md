# Phase 4 — Retrieval: Company Crawler & Page Fetcher

**Goal:** given a company URL, find and clean the pages worth using
(homepage, hiring page if it exists, public interview-process discussion)
— pure retrieval, no LLM involvement, no kit creation wiring yet.

**Prerequisites:** Phase 3 merged.

---

## Prompt to paste into your AI IDE

> Build the retrieval layer in `apps/api/src/pipeline/retrieval/`, fully
> decoupled from the kit/LLM code — it should be testable by itself with
> a fake local HTTP server.
>
> Requirements:
> 1. `fetchPage(url)`: fetches a URL with a timeout, restricts to
>    `text/html`-like content types, caps response size, and validates the
>    URL first — reject private/loopback/link-local addresses unless
>    `ALLOW_LOCAL_FETCH=true` is set (needed later for the batch harness
>    which serves company sites from localhost). Returns cleaned text
>    (strip nav/script/style boilerplate — Readability-style extraction or
>    a simple heuristic; your call, note it in decisions.md) plus the raw
>    list of links found on the page (resolved to absolute URLs, following
>    relative links correctly).
> 2. `crawlCompanySite(baseUrl)`: fetches the homepage, extracts links,
>    ranks them by likely relevance to "what the company does" and "how
>    they hire" (keyword/anchor-text heuristics against things like
>    careers/jobs/hiring/culture/engineering-blog/about — no hardcoded
>    path list, since the brief explicitly says a fixed path list isn't
>    sufficient), fetches the top N ranked candidates (retrying with
>    backoff on transient failures, skipping and recording anything that
>    404s/times out rather than aborting), and returns a structured result:
>    `{ pagesUsed: string[], pagesSkipped: {url, reason}[], aboutText,
>    hiringText | null }`.
> 3. `searchPublicInterviewDiscussion(companyName)`: your choice of
>    approach for finding public discussion of the company's interview
>    process (a search API with a free tier, or a documented fallback if
>    you don't wire up a real search — be honest in decisions.md about
>    what this actually does; do not fabricate results if nothing is
>    found, just return an empty result cleanly).
> 4. Respect `robots.txt` before crawling a domain — fetch and parse it,
>    skip disallowed paths, and note in decisions.md which crawling rules
>    you follow.
> 5. Rate limiting: a simple per-domain delay/concurrency cap between
>    requests during a single crawl.
> 6. Tests using a local fixture server (spin up a tiny Express/http
>    server serving fixture HTML pages in the test, no network calls) for:
>    homepage-only site (no hiring page found → returns `hiringText: null`
>    cleanly, not an error), site with a hiring page reachable via a
>    non-obvious path, a 404 company URL (whole crawl reports the failure
>    without throwing), and relative-link following.
>
> Do NOT wire this into kit creation or call any LLM yet — this phase is
> retrieval only, verified via its own tests and maybe a scratch script.
>
> When done: run tests, tell me what's deferred, propose a commit message.

## Acceptance criteria
- [ ] Crawler finds a hiring page at a non-guessable path in the fixture
      test (not just `/careers`)
- [ ] A site with no hiring page returns a clean "not found" result, no
      thrown error
- [ ] robots.txt is honored in at least one test
- [ ] Invalid/private URLs are rejected outside of `ALLOW_LOCAL_FETCH` mode

## Suggested commit message
`feat(retrieval): add company crawler, page fetcher, and robots/rate-limit handling`
