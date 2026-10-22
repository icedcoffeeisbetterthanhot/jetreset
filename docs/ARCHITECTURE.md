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
          flight-status/ # GET stored statuses; POST check with the provider
          recovery/
            route.ts
            activities/[activityId]/ # Persist activity completion
            flight-status/ # POST apply verified status changes to the plan
    dashboard/  # Daily recovery dashboard for one selected trip
    flight-status/ # Flight Status page for one selected trip
    trips/      # Trip list, details, create, and edit pages
    layout.tsx
    page.tsx
    globals.css
  components/   # Shared UI components and feature components
    ui/
    layout/
    dashboard/  # Daily Dashboard client component
    trips/      # Trip, flight, and recovery-plan components; recoveryApi.ts client helpers
  lib/          # Shared utilities, env validation, non-secret configuration
    env.ts
    flightStatus.ts # Flight-status change detection and effective times (pure)
    itinerary.ts
    recoveryPlan.ts
    recoveryDashboard.ts # Daily stage/progress derivation and trip selection
    timezone.ts
  server/       # Server-only services and data-access code (Prisma client)
    airportService.ts
    db.ts
    flightService.ts
    flightStatus/  # Provider interface and Aviationstack adapter
    flightStatusErrors.ts
    flightStatusService.ts # Cache, call budget, snapshots, plan signatures
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
- **Flight status**: `src/server/flightStatusService.ts` behind the provider interface in `src/server/flightStatus/`
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
overlapping flights and mismatched transfer airports.

## Flight-Status Integration

- **Provider boundary**: `src/server/flightStatus/provider.ts` defines
  `FlightStatusProvider` (lookup by flight number, departure-local date, and
  route) and typed `FlightStatusProviderError` kinds. `aviationstack.ts` is
  the only implementation: Aviationstack (APILayer) real-time flights,
  `GET https://api.aviationstack.com/v1/flights?access_key=…&flight_iata=…&dep_iata=…&arr_iata=…`
  (`flight_icao` for three-letter designators). `flight_date` is not sent
  because historical/future lookups are paid features; results are filtered to
  the saved route and departure-local date instead. Responses are validated
  with `zod`; APILayer error bodies (which can arrive with HTTP 200) are mapped
  to typed errors, including `usage_limit_reached` (monthly allowance) and
  `https_access_restricted` (the app never falls back to HTTP).
- **Time semantics**: Aviationstack returns `scheduled`, `estimated`, and
  `actual` per movement as ISO strings with an offset (typically `+00:00`)
  plus an airport `timezone`. Its documentation does not say whether the
  wall-clock part is UTC or airport-local; live data checked on 2026-10-22
  showed it is airport-local (active flights' actual departures from Tokyo,
  Manila, and Baghdad were only in the past when read as local time). The
  adapter therefore reads zero-offset (`+00:00`/`Z`) times as local time in the
  movement's `timezone` (falling back to the saved airport zone) and trusts any
  explicit non-zero offset. Times that are nonexistent or ambiguous around a
  DST change, or in an unknown zone, are discarded. Runway times are not used,
  and Aviationstack does not report a last-updated time. Status mapping: `scheduled`→scheduled,
  `active`→departed, `landed`→arrived, `cancelled`, `diverted`; anything
  else (including `incident`) is stored as unknown.
- **Storage**: `FlightStatusSnapshot` holds the latest lookup per segment
  (cascade-deleted with it). Segment schedules are never rewritten. Each
  snapshot records the segment's `updatedAt`; editing the segment makes the
  snapshot non-current, so it is ignored until checked again.
- **Page**: `/flight-status` shows one trip at a time (`?trip=<id>`, or the
  same automatic choice as the Daily Dashboard) using `FlightStatusPanel`. The
  trip page links to it and shows a notice when changes are pending or a flight
  is cancelled or diverted. The trip picker, empty state, and `?trip=`
  resolution are shared with `/dashboard` via `components/trips/TripSelection.tsx`.
- **Refresh policy** (`src/server/flightStatusService.ts`): on demand only,
  for segments with a valid flight number from 7 days before departure to 3
  days after arrival; 10-minute per-segment cache; 10 provider calls per hour
  per process; credential and rate-limit errors stop the remaining lookups.
- **Change detection** (`src/lib/flightStatus.ts`, pure): a change is material
  at 15 minutes or more against the saved schedule, preferring actual, then
  estimated, then provider-scheduled times. Cancelled, possibly cancelled, and
  diverted flights are _blocking_: they never change plan times.
- **Plan adjustment**: plan generation always uses effective segment times
  (material provider changes, else the saved schedule) and stores a signature
  of them plus the route endpoints. When the current signature differs, the
  trip page and dashboard report a pending change.
  `applyFlightStatusToRecoveryPlan` then regenerates with the plan's stored
  preferences and original reference date, and in one transaction removes only
  uncompleted activities scheduled at or after now that the new schedule no
  longer contains, inserts new future activities, and records a plain-language
  `adjustmentNote`. Past and completed activities are never modified. It refuses
  blocking statuses and plans whose itinerary changed (those need full
  regeneration). Known limitation: if a delay moves arrival across a local
  midnight after some of that day's activities have passed, kept and new
  activities on that day can carry different day numbers.

## Round Trips (Outbound and Return Legs)

A trip can hold both halves of a round trip. `FlightSegment.leg` and
`RecoveryPlan.leg` use the `JourneyLeg` enum (`outbound`, the default, or
`return`), and plans are unique per `(tripId, leg)`, so a trip has at most one
arrival plan and one back-home plan. Shared helpers live in
`src/lib/journeyLeg.ts`.

- **Planning**: the outbound plan uses the trip's own times, or its outbound
  flights when present. The back-home plan requires return flights and is
  built from the first return departure to the last return arrival, so it
  adjusts to home time. Return flights never affect the outbound plan, and
  vice versa.
- **Staleness and flight status**: each plan's itinerary hash, flight-status
  signature, pending-change detection, blocking alerts, and
  `applyFlightStatusToRecoveryPlan` consider only that leg's flights. APIs take
  `leg` as a query parameter (`GET /api/trips/[id]/recovery?leg=`,
  `POST /api/trips/[id]/recovery/flight-status?leg=`) or a body field (plan
  generation, flight segments), defaulting to `outbound`.
- **UI**: the flight editor and Flight Status page group flights by leg, with
  totals, layovers, and warnings calculated within each leg so the stay is not
  shown as a layover. The trip page shows an "Arrival recovery plan" and, once
  return flights exist, a "Back-home recovery plan". The Daily Dashboard
  defaults to the back-home plan once its route departure time has passed
  (`?leg=` overrides) and offers a switch when both plans are available.
- **Migration**: `20261022140000_add_journey_legs` adds the enum and columns
  with an `outbound` default, so existing flights and plans are unchanged.

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

The standalone Daily Dashboard presents one trip's plan as a calendar: summary
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
