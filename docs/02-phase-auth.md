# Phase 2 — Authentication

**Goal:** register/login/logout with sessions, protected routes on both
API and frontend. No kit-related code yet.

**Prerequisites:** Phase 1 merged.

---

## Prompt to paste into your AI IDE

> Implement minimal authentication per the brief: users can register, log
> in, log out, and a signed-out visitor cannot reach protected pages or
> endpoints. No email verification, no password reset, no roles — those
> are explicitly out of scope.
>
> Requirements:
> 1. `User` Mongoose schema: email (unique, lowercased), hashed password
>    (bcrypt), createdAt. Nothing else yet.
> 2. Session handling: use `express-session` with a MongoDB session store
>    (`connect-mongo`), httpOnly + secure (in prod) cookies. Do not use raw
>    JWTs unless you tell me why you'd prefer that instead — session
>    cookies are the simpler default for this scope.
> 3. API routes: `POST /auth/register`, `POST /auth/login`,
>    `POST /auth/logout`, `GET /auth/me`. Validate input (email format,
>    password minimum length) and return structured error responses, not
>    raw stack traces.
> 4. Middleware `requireAuth` that 401s any request without a valid
>    session, and a note on how expired/invalid sessions are handled
>    (e.g. session store TTL + clear cookie on failed lookup) — add this to
>    `docs/decisions.md`.
> 5. Frontend: a login page and a register page (plain forms, no design
>    polish needed yet — that comes in the frontend-focused phase), a
>    minimal auth context/hook, and route protection so that visiting any
>    `/kits/*` page while signed out redirects to `/login`. Since kits
>    don't exist yet, a placeholder `/kits` page that just says "kits go
>    here" behind the auth guard is enough to prove the guard works.
> 6. Add a couple of automated tests: register succeeds, duplicate email
>    is rejected, login with wrong password is rejected, protected route
>    401s when signed out.
>
> Do NOT build kit creation, the builder, or scraping in this phase.
>
> When done: run the tests, tell me what's deferred, propose a commit
> message.

## Acceptance criteria
- [ ] Can register, log in, log out via the UI
- [ ] `/kits` redirects to `/login` when signed out
- [ ] Direct API calls to a protected route 401 without a session cookie
- [ ] Tests for the above pass

## Suggested commit message
`feat(auth): add session-based registration, login, and route protection`
