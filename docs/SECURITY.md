# Security Overview

Security is considered from the foundation, guided by OWASP Top 10 and ASVS-inspired practices.

## Current Scope

The current implementation includes:

- Secure configuration and environment handling.
- Server-only database access.
- Baseline security headers.
- Server-validated trip creation, listing, detail, update, and delete routes.
- Server-validated flight-segment management and bounded airport search over
  a bundled public dataset.
- Server-validated, trip-scoped recovery-plan generation and activity
  completion.
- Optional username/password accounts with revocable opaque sessions.
- Browser-scoped guest identities with a user-confirmed guest-trip transfer.
- Server-side owner checks for trip, flight, and recovery operations.
- Consent-based friend requests and a username-only public leaderboard.
- Server-replayed Cloud Dodger runs with server-calculated scores.

## Key Controls

### Environment & Secrets

- Environment variables are validated via `src/lib/env.ts` using `zod`.
- Core variables:
  - `NODE_ENV` (`development`, `test`, `production`)
  - `DATABASE_URL` (PostgreSQL connection string)
- `.env.example` provides safe placeholders only.
- `.env` and local environment overrides are ignored by Git.
- Real secrets must not be committed.
- Modules read configuration via `getServerEnv()` rather than `process.env` scatter.

### Database Access and Ownership

- Prisma client is defined in `src/server/db.ts`.
- Only server-side modules may import the Prisma client.
- Prisma stores trip data in addition to the health-check model.
- Passwords are stored as salted scrypt hashes. Session tokens are random and
  stored only as SHA-256 hashes.
- User sessions expire after 30 days, use HTTP-only SameSite cookies, and are
  revoked on sign-out. Login attempts are throttled per normalized username.
- Every trip query and mutation filters by the current account or guest
  session. Flight and recovery access is constrained through the owned trip.
- The migration marks existing trips with an isolated legacy guest identifier.
  The development-only legacy claim lets the first local guest session claim
  them; production never auto-assigns them to a visitor.
- Airport search operates on bundled data. The airport refresh script fetches
  its source only when a developer runs it; the application makes no live
  airport or flight-status provider requests.
- Database connectivity can be tested via `npm run db:check`.

### Web Security Headers

Configured in `next.config.mjs`:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-XSS-Protection: 0` (deprecated header, explicitly disabled; real XSS protection handled in code and framework).
- Auth mutation endpoints compare the browser `Origin` with the request
  origin; cookies use SameSite protection.

Additional headers (e.g. CSP, HSTS) should be refined per deployment environment and HTTPS/TLS configuration.

### OWASP Considerations

Relevant current risks:

- **A01: Broken Access Control**: Trip, flight, and recovery services scope reads and mutations to the current user or guest identity. Friendship does not provide trip access.
- **A02: Cryptographic Failures**: Passwords use scrypt; bearer tokens are random and stored as SHA-256 hashes. TLS is required for production.
- **A03: Injection**: DB access uses parameterized Prisma APIs; no raw string SQL is used.
- **A04: Insecure Design**: Credentials remain server-side; consent-based friend acceptance is required. There is no email-based password recovery, so users must retain their passwords.
- **A05: Security Misconfiguration**: Baseline headers and env validation reduce misconfig risk.
- **A06: Vulnerable and Outdated Components**: `npm audit --omit=dev` reports
  no production dependency vulnerabilities; development dependency advisories
  should still be reviewed.
- **A08: Software and Data Integrity Failures**: Prisma migrations manage schema evolution; destructive reset is discouraged.
- **A09: Security Logging and Monitoring Failures**: No centralized logging
  or intrusion detection is configured.
- **A10: Server-Side Request Forgery (SSRF)**: No runtime external requests are
  made. The airport refresh script downloads from a fixed OurAirports source URL
  only when explicitly run by a developer.

## Verification Performed

- Environment validation tested via unit tests (`tests/unit/env.test.ts`).
- Account registration, password hashing, friend-request behavior, and game-run
  replay verification have focused unit-test coverage.
- Basic layout and landing page rendering tested via Vitest + Testing Library.
- Trip input validation and persistence behavior tested with mocked Prisma.
- Flight-segment time conversion, airport validation, connection calculations,
  and airport search covered by unit tests.
- Recovery planning, time-zone handling, preference validation, persistence,
  stale-plan detection, and dashboard progress covered by unit tests.
- Browser smoke test verified with Playwright.
- Production build (`npm run build`) validates configuration.
- Prisma connectivity can be tested with `npm run db:check` when PostgreSQL is available.

## Known Gaps

- Production dependency audit was clean after the latest framework and PostCSS
  updates. Development dependencies still have outstanding audit advisories;
  review them before relying on development tooling in sensitive environments.
- Airport metadata is sourced from the published OurAirports dataset and
  airport time zones are derived from coordinates. Verify critical airport
  details independently; the bundled directory is not a live provider.
- Accounts do not collect or verify email addresses. Password recovery is not
  available; losing a password means the account cannot be recovered.
- Leaderboard replay validation prevents client-submitted score values from
  being trusted, but does not prevent bots from generating valid input logs.
- Global leaderboard usernames and scores are public. Trip data is not
  returned by leaderboard or friend APIs; the app does not collect email
  addresses.
- Recovery suggestions are general travel-routine guidance, not a medical
  recommendation, diagnosis, or individualized circadian calculation. The
  dashboard presents this limitation and advises professional input when
  health circumstances could change what is appropriate.
- Login throttling is per normalized username; other API endpoints do not yet have
  general rate limits.
- No CSP or HSTS fully defined; needs per-deployment tuning.
- No automated dependency vulnerability scanning configured.

These gaps should be addressed before a broader production deployment.
