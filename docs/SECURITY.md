# Security Overview

Security is considered from the foundation, guided by OWASP Top 10 and ASVS-inspired practices.

## Current Scope

The foundation includes:

- Secure configuration and environment handling.
- Server-only database access.
- Baseline security headers.
- Server-validated trip creation, listing, detail, update, and delete routes.

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
- **A10: Server-Side Request Forgery (SSRF)**: No external calls implemented yet.

## Verification Performed

- Environment validation tested via unit tests (`tests/unit/env.test.ts`).
- Basic layout and landing page rendering tested via Vitest + Testing Library.
- Trip input validation and persistence behavior tested with mocked Prisma.
- Browser smoke test verified with Playwright.
- Production build (`npm run build`) validates configuration.
- Prisma connectivity can be tested with `npm run db:check` when PostgreSQL is available.

## Known Gaps

- No authentication/authorization or trip ownership checks; do not expose trip data publicly.
- Production dependency audit was clean after the latest framework and PostCSS
  updates. Development dependencies still have outstanding audit advisories;
  review them before relying on development tooling in sensitive environments.
- No audit logging or intrusion detection.
- No application-level rate limiting.
- No CSP or HSTS fully defined; needs per-deployment tuning.
- No automated dependency vulnerability scanning configured.

These will be addressed when later features introduce user data, external integrations, and higher security requirements.
