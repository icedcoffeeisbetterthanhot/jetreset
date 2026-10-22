# JetReset Architecture

## Overview

JetReset uses a **modular monolith** approach. The repository contains the
application foundation, trip management, flight planning, recovery features,
optional account ownership, community features, and the Cloud Dodger game:

- Next.js App Router for routing and server-side rendering.
- Strict TypeScript for safety and maintainability.
- Tailwind CSS for a consistent, token-based design system.
- PostgreSQL + Prisma for data persistence.
- Shared tooling for linting, formatting, type checking, and testing.

## Directory Structure

```text
src/
  app/          # Next.js App Router routes, layouts, and global styles
    api/
      airports/ # Airport search over the bundled directory
      trips/
        route.ts
        [id]/
          route.ts
          flights/
            route.ts
            [flightId]/ # Update and delete one flight segment
          recovery/
            route.ts
            activities/[activityId]/ # Persist activity completion
      auth/                           # Username/password registration and sessions
      friends/                        # Consent-based friend requests
      game-runs/                      # Server-validated game runs
      leaderboard/                    # Public username-only high scores
    account/    # Signed-in account information and settings
    trips/      # Trip list, details, create, and edit pages
    layout.tsx
    page.tsx
    globals.css
  components/   # Shared UI components and feature components
    ui/
    layout/
    trips/
  lib/          # Shared utilities, env validation, non-secret configuration
    env.ts
    itinerary.ts
    recoveryPlan.ts
    timezone.ts
  server/       # Server-only services and data-access code (Prisma client)
    authService.ts
    communityService.ts
    airportService.ts
    db.ts
    flightService.ts
    recoveryErrors.ts
    recoveryService.ts
    tripService.ts
    gameService.ts
  data/
    airports.json # Bundled airport directory
scripts/
  update-airports.mjs
prisma/
  schema.prisma # Prisma schema and migrations
  migrations/   # Version-controlled migrations
tests/
  unit/         # Vitest unit tests
  e2e/          # Playwright end-to-end tests
  setup/        # Test environment setup
docs/
  PRODUCT_SPEC.md
  ARCHITECTURE.md
  SECURITY.md
  UI_GUIDELINES.md
  DEVELOPMENT_WORKFLOW.md
```

## Separation of Concerns

- **Presentation (UI)**: `src/app`, `src/components`
- **Shared utilities**: `src/lib` (e.g. environment validation)
- **Data access**: `src/server/db.ts` using Prisma
- **Trip business logic**: `src/server/tripService.ts`
- **Flight-segment business logic**: `src/server/flightService.ts`
- **Airport search**: `src/server/airportService.ts`
- **Account, identity, and community logic**: `src/server/authService.ts` and
  `src/server/communityService.ts`
- **Time-zone utilities**: `src/lib/timezone.ts`
- **Itinerary calculations**: `src/lib/itinerary.ts`
- **Configuration**:
  - Environment variables validated via `src/lib/env.ts`
  - Next.js configuration via `next.config.mjs`
- **Tests**: `tests` for behavior verification

## Server-Only Boundaries

- Database access (`PrismaClient`) is defined in `src/server/db.ts`.
- Client components must not import `src/server/*`.
- Environment validation (`getServerEnv`) is intended for server-side modules only.

## Accounts, Guest Sessions, and Ownership

Username/password credentials are normalized and validated server-side.
Passwords use Node's scrypt KDF with unique random salts. Persistent session
cookies are HTTP-only, use SameSite=Lax, and carry opaque random tokens whose
hashes are stored in `UserSession`. Login attempts are throttled per normalized
username. Email is not collected; password recovery is unavailable, so users
must keep their passwords safe.
Signed-in users can view their username and sign-in method in account settings;
guest users are redirected to sign-in when opening that page.

Middleware assigns an opaque random guest identifier in an HTTP-only cookie.
Every trip query and mutation is constrained to exactly one owner: either the
signed-in user ID or the current guest ID. Flight segments and recovery records
are reachable only through an owned trip. On sign-in, the user is offered an
explicit choice to transfer the current guest session's trips; declining keeps
those records in the guest session.

For existing local databases, the migration marks previously unowned trips as
legacy guest data. In development only, the first guest session claims these
records once; production never auto-assigns legacy records to a visitor.

## Friends and Cloud Dodger Scores

Friend requests are initiated by exact username and require recipient
acceptance. Friend relationships do not grant trip access. The public
leaderboard exposes only usernames and each account's best completed score.
Guest play remains available but is not persisted.

Authenticated game runs receive a server-generated seed. The server replays
the submitted steering log, checks the deterministic game simulation and
minimum elapsed time, and stores only the resulting server-calculated score.
This prevents arbitrary score values and replay mismatches; it is not a
complete bot or automation defense.

## Airport Data and Flight Planning

`src/data/airports.json` is a generated snapshot of scheduled-service airports
with IATA codes from [OurAirports](https://github.com/davidmegginson/ourairports-data),
which publishes the data under the Unlicense/public-domain dedication. Run
`npm run airports:update` to refresh it. Airport time zones are derived from
coordinates with the `tz-lookup` library when generating the snapshot. The
stored flight segment keeps airport names and IANA zones as a snapshot so
later directory updates do not silently rewrite itinerary history.

Flight segment timestamps are absolute instants converted from local times in
the selected airports' time zones. The planner derives flight duration,
elapsed itinerary time, layovers, and time-zone offset changes. It warns about
overlapping flights and mismatched transfer airports. This is scheduled
itinerary planning only; no flight-status provider is configured.

## Recovery Planning and Daily Dashboard

`src/lib/recoveryPlan.ts` is a deterministic planner that takes trip times,
IANA zones, optional flight segments, a reference date, and limited user
preferences. It estimates the offset change at the itinerary endpoints and
creates a 3–7 day destination-local schedule, with an optional pre-departure
routine reminder when at least one full day remains. It records total elapsed
journey duration from the flight itinerary when available, otherwise from the
trip's planned times. On arrival day, it does not schedule routine activities
before the scheduled arrival instant.

The engine provides flexible routine targets and general educational
suggestions. It does not model an individual's circadian phase, prescribe
light exposure, calculate personal hydration or exercise needs, use medical
data, or promise recovery outcomes. The offset-based east/west estimate is
approximate, especially around daylight-saving transitions. Light guidance
therefore remains conservative and does not change into phase-specific advice
based on direction.

`RecoveryPlan` and `RecoveryActivity` store a trip-specific plan snapshot and
completion timestamps. Re-generation replaces uncompleted activities and uses
stable schedule keys so completed activities remain completed only when their
scheduled task still matches. A changed trip or flight segment marks the plan
out of date until refreshed. Activity completion is scoped to its trip's plan.
The dashboard selects one trip at a time, shows the destination-local stage and
day, and calculates progress only from persisted activity completion.

## Future Modules (Not Yet Implemented)

The architecture is compatible with future modules such as:

- Reminders and calendar integrations
- Broader account preferences
- Travel statistics and reporting

The remaining roadmap is documented in `README.md`. Keep new modules behind
the existing server-side service boundary and deliver them one milestone at a
time.

## Deployment Considerations

Trip data is scoped to a guest session or signed-in account. Production
deployment requires HTTPS, database backups, and operational review. Existing
trips are marked with an isolated legacy guest identifier during migration.
Only development can claim those records for its first guest session;
production does not expose them to visitors. The account migration removes
stored email addresses and email tokens but preserves usernames and password
hashes.

## Design Decisions (Key Points)

- **Modular monolith**: Easier for a small team to reason about, with clear boundaries within a single app.
- **Prisma + PostgreSQL**: Structured, typed access and migrations, appropriate for long-term data integrity.
- **Airport snapshots**: Airport names and IANA zones are copied onto segments to keep saved itineraries stable across airport-directory updates; deleting a trip cascades to its flight segments.
- **Recovery-plan snapshots**: Plans are explicitly regenerated from the current trip and flight schedule; completed activities are retained only for identical activity schedules. Recovery records cascade with their parent trip.
- **Tailwind tokens**: Semantic color and spacing tokens enable a consistent look across independently developed features.
- **Strict TypeScript**: Reduces runtime errors and improves API clarity between modules.
