# Security Overview

Security is considered from the foundation, guided by OWASP Top 10 and ASVS-inspired practices.

## Current Scope

The foundation includes:

- Secure configuration and environment handling.
- Server-only database access.
- Baseline security headers.
- Server-validated trip creation, listing, detail, update, and delete routes.
- Server-validated flight-segment management and bounded airport search over
  a bundled public dataset.
- Server-validated, trip-scoped recovery-plan generation and activity
  completion.

Trip routes currently have no authentication or ownership enforcement. Run
this version only in a trusted local development environment; do not deploy it
with real itinerary data or expose it to untrusted users until authorization
is implemented and verified.

## Key Controls

### Environment & Secrets

- Environment variables are validated via `src/lib/env.ts` using `zod`.
- Required variables:
  - `NODE_ENV` (`development`, `test`, `production`)
  - `DATABASE_URL` (PostgreSQL connection string)
- Optional variables:
  - `AVIATIONSTACK_API_KEY` (flight-status provider key, validated by
    `getFlightStatusProviderConfig()`; read only by server modules and never
    included in logs, error messages, or client bundles. Aviationstack requires
    it as the `access_key` query parameter, so it is sent only over HTTPS to
    `api.aviationstack.com`, request URLs are never logged, and fetch errors
    (which may contain the URL) are replaced with generic messages.)
- `.env.example` provides safe placeholders only.
- `.env` and local environment overrides are ignored by Git.
- Real secrets must not be committed.
- Modules read configuration via `getServerEnv()` rather than `process.env` scatter.

### Database Access and Ownership

- Prisma client is defined in `src/server/db.ts`.
- Only server-side modules may import the Prisma client.
- Prisma stores trip data in addition to the health-check model.
- Trip inputs and identifiers are validated on the server, but queries and
  mutations do not yet enforce user ownership.
- Flight segments are scoped to their parent trip and cascade when that trip
  is deleted; there are still no user ownership checks.
- Recovery plans and completion updates are scoped to a trip, but that trip
  itself has no authenticated owner. Do not expose recovery activity data
  publicly until Milestone 4 authorization is implemented.
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

Additional headers (e.g. CSP, HSTS) should be refined per deployment environment and HTTPS/TLS configuration.

### OWASP Considerations

Relevant current risks:

- **A01: Broken Access Control**: Trip data is currently accessible without authentication or ownership checks. Local development only; block public deployment until fixed.
- **A02: Cryptographic Failures**: No cryptographic operations implemented yet.
- **A03: Injection**: DB access uses parameterized Prisma APIs; no raw string SQL is used.
- **A04: Insecure Design**: Foundational design avoids client-side access to secrets and keeps DB access server-side.
- **A05: Security Misconfiguration**: Baseline headers and env validation reduce misconfig risk.
- **A06: Vulnerable and Outdated Components**: The production dependency audit is clean; development dependency advisories remain and should be reviewed.
- **A08: Software and Data Integrity Failures**: Prisma migrations manage schema evolution; destructive reset is discouraged.
- **A09: Security Logging and Monitoring Failures**: No centralized logging yet; to be addressed when backend features are introduced.
- **A10: Server-Side Request Forgery (SSRF)**: The only runtime external
  request is the flight-status lookup to the fixed HTTPS endpoint
  `https://api.aviationstack.com/v1/flights`. User input contributes only a
  validated flight number and the saved airport codes, all as encoded query
  parameters; redirects are refused and requests time out after 8 seconds. The airport refresh script
  downloads from a fixed OurAirports source URL only when explicitly run by a
  developer.

### Flight-Status Integration

- Status checks run only when a user presses "Check flight status"; page views
  never call the provider. Results are cached per segment for 10 minutes and
  provider calls are capped at 10 per hour per server process (in-memory; a
  multi-instance deployment would need a shared limiter). The provider's own
  monthly allowance is enforced by Aviationstack and reported to the user.
- Provider responses are schema-validated with `zod`; unexpected shapes are
  rejected rather than partially trusted. Provider times are used only when they can be read
  consistently with the saved schedule (see ARCHITECTURE.md).
- Failed lookups log only an event name, segment ID, and failure category —
  never the key, flight number, or airports.
- Recovery plans are never changed automatically. Applying status changes
  requires an explicit user action, keeps all past and completed activities,
  and refuses cancellations and diversions.
- The status endpoints have the same missing ownership checks as other trip
  routes and, like them, are for trusted local development only.

## Verification Performed

- Environment validation tested via unit tests (`tests/unit/env.test.ts`).
- Basic layout and landing page rendering tested via Vitest + Testing Library.
- Trip input validation and persistence behavior tested with mocked Prisma.
- Flight-segment time conversion, airport validation, connection calculations,
  and airport search covered by unit tests.
- Recovery planning, time-zone handling, preference validation, persistence,
  stale-plan detection, and dashboard progress covered by unit tests.
- Flight-status provider mapping, HTTP error handling, key non-disclosure,
  response validation, caching, call budget, change detection, and safe plan
  adjustment covered by unit tests with a mocked provider. The Aviationstack
  integration was verified against the live service on 2026-10-22 (free plan):
  HTTPS requests with `flight_iata`, `dep_iata`, and `arr_iata` succeed, the
  key is not echoed in responses, and a real active flight was matched and
  mapped end to end. Cancellation, diversion, and limit-exceeded responses
  have only been tested with mocked responses.
- The `/dashboard` page validates the `trip` query parameter as a positive
  integer (404 otherwise), reads only through server services, and adds no new
  API routes. Like the rest of the app, it has no ownership checks yet and
  lists every trip in the database: trusted local development only.
- Browser smoke test verified with Playwright.
- Production build (`npm run build`) validates configuration.
- Prisma connectivity can be tested with `npm run db:check` when PostgreSQL is available.

## Known Gaps

- No authentication/authorization or trip ownership checks; do not expose trip data publicly.
- Production dependency audit was clean after the latest framework and PostCSS
  updates. Development dependencies still have outstanding audit advisories;
  review them before relying on development tooling in sensitive environments.
- Airport metadata is sourced from the published OurAirports dataset and
  airport time zones are derived from coordinates. Verify critical airport
  details independently; the bundled directory is not a live provider.
- Recovery suggestions are general travel-routine guidance, not a medical
  recommendation, diagnosis, or individualized circadian calculation. The
  dashboard presents this limitation and advises professional input when
  health circumstances could change what is appropriate.
- No audit logging or intrusion detection.
- No application-level rate limiting.
- No CSP or HSTS fully defined; needs per-deployment tuning.
- No automated dependency vulnerability scanning configured.

These will be addressed when later features introduce user data, external integrations, and higher security requirements.
