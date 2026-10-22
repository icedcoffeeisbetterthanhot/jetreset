# JetReset Architecture

## Overview

JetReset uses a **modular monolith** approach. The repository contains the
application foundation, trip management, and local flight-planning features:

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
    dashboard/  # Daily recovery dashboard for one selected trip
    trips/      # Trip list, details, create, and edit pages
    layout.tsx
    page.tsx
    globals.css
  components/   # Shared UI components and feature components
    ui/
    layout/
    dashboard/  # Daily dashboard client component
    trips/      # Trip, flight, and recovery-plan components; recoveryApi.ts client helpers
  lib/          # Shared utilities, env validation, non-secret configuration
    env.ts
    itinerary.ts
    recoveryPlan.ts
    recoveryDashboard.ts # Daily stage/progress derivation and trip selection
    timezone.ts
  server/       # Server-only services and data-access code (Prisma client)
    airportService.ts
    db.ts
    flightService.ts
    recoveryErrors.ts
    recoveryService.ts
    tripService.ts
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

### Daily Dashboard Page (`/dashboard`)

The standalone daily dashboard presents one trip's plan as a calendar: summary
tiles (next sleep/wake targets, next activity, today's progress), a strip of
plan days (preparation day and recovery days, defaulting to the current one),
and an hourly schedule for the selected day. Each activity shows its exact
local time, a category icon and colour (sleep, light exposure, meal, hydration,
exercise, caffeine), its guidance, and a planned/completed state; a "Now" line
marks the current time on today's schedule. Icons are inline SVG in
`components/dashboard/ActivityIcon.tsx` (no icon dependency). Calendar grouping
(`getPlanCalendarDays`, `getCalendarHourSlots`) uses each activity's own
stored time zone, so the preparation day is shown in origin-local time.

- `src/lib/recoveryDashboard.ts` is the single, pure source of the stage,
  recovery-day, today's-activity, and progress derivation. Both the trip-page
  `RecoveryDashboard` and the `/dashboard` page use it, so they cannot disagree.
  Day boundaries use the destination-local calendar (origin-local for the
  pre-departure day).
- Trip selection: `?trip=<id>` selects a trip explicitly; an invalid or unknown
  ID returns 404. Without it, `selectDashboardTrip` picks a trip that is in
  transit or within its plan period (latest departure first), otherwise the
  next upcoming trip, otherwise the most recently completed trip. A plan's
  period ends at its last scheduled activity. Trips are never mixed.
- `listDashboardTrips` in `recoveryService.ts` returns only trip summary fields
  plus plan presence and the last activity time; the selected plan is loaded
  with the existing `getRecoveryPlan`.
- Completion uses the existing trip-scoped `PATCH` activity endpoint through
  `src/components/trips/recoveryApi.ts`. No new API routes or schema changes.
- The server passes its render time to the client so hydration is consistent;
  the client then refreshes "now" every minute so the day, next activity, and
  sleep targets advance without a reload.
- Plan generation and preference changes stay on the trip page. The dashboard
  links there when no plan exists or when the plan is out of date.

## Future Modules (Not Yet Implemented)

The architecture is compatible with future modules such as:

- Reminders and calendar integrations
- User accounts and preferences
- Travel statistics and reporting

The remaining roadmap is documented in `README.md`. Keep new modules behind
the existing server-side service boundary and deliver them one milestone at a
time.

## Current Data-Access Limitation

Trip routes currently have no authentication or ownership checks. They are
appropriate only for trusted local development; do not expose this application
or its trip data to untrusted users until server-side authorization is added.

## Design Decisions (Key Points)

- **Modular monolith**: Easier for a small team to reason about, with clear boundaries within a single app.
- **Prisma + PostgreSQL**: Structured, typed access and migrations, appropriate for long-term data integrity.
- **Airport snapshots**: Airport names and IANA zones are copied onto segments to keep saved itineraries stable across airport-directory updates; deleting a trip cascades to its flight segments.
- **Recovery-plan snapshots**: Plans are explicitly regenerated from the current trip and flight schedule; completed activities are retained only for identical activity schedules. Recovery records cascade with their parent trip.
- **Tailwind tokens**: Semantic color and spacing tokens enable a consistent look across independently developed features.
- **Strict TypeScript**: Reduces runtime errors and improves API clarity between modules.
