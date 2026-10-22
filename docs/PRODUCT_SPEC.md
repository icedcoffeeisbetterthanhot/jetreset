# JetReset Product Specification

## Product Identity

- **Name**: JetReset
- **Description**: JetReset helps travellers recover from jet lag with practical, time-aware recovery guidance.

## Current Implementation Status

The repository contains the application foundation and trip-management
features:

- Working Next.js application with App Router.
- Strict TypeScript configuration.
- Tailwind-based design foundation.
- Landing page establishing JetReset's identity.
- PostgreSQL + Prisma configuration.
- Environment variable validation.
- Trip creation, listing, detail views, editing, and deletion.
- Time-zone-aware trip times, daylight-saving validation, and journey duration.
- Flight-segment creation, editing, and removal for a trip.
- Search across the bundled scheduled-service airport directory, with airport
  local-time display, connection/overlap warnings, and flight/layover/elapsed
  journey calculations.
- A deterministic multi-day recovery-plan estimate with destination-local
  sleep, daylight, meal, hydration, gentle-movement, and conservative caffeine
  guidance.
- A trip-specific dashboard with trip stage, next target bedtime, flexible
  wake/bedtime preferences, and persisted activity completion.
- A standalone Daily dashboard (`/dashboard`, linked from the primary
  navigation and each trip) showing, for one selected or automatically chosen
  trip: the recovery stage and day, next target sleep and wake times, the next
  activity, today's progress, and a day-by-day plan calendar. Each day is an
  hourly schedule of sleep, light-exposure, meal, hydration, exercise, and
  caffeine guidance with category icons, exact local times, a current-time
  marker, and planned and completed activities clearly distinguished. Empty states cover no trips,
  no plan, pre-departure, in-transit, and a finished plan period.
- A Flight status page (`/flight-status`, linked from the primary navigation,
  each trip, and the daily dashboard) with on-demand checks per trip using Aviationstack (when
  `AVIATIONSTACK_API_KEY` is configured), showing your saved schedule, the
  provider schedule, and estimated and actual times separately, with delays,
  early times, cancellations, and diversions highlighted. Verified changes can
  be applied to the recovery plan, recalculating future guidance only.

Authentication and ownership enforcement are not yet available. Trip records
are not protected multi-user data; use this implementation only for trusted
local development until access control is implemented.

## Landing Page Requirements (Implemented)

- JetReset branding and headline.
- Concise explanation of the product.
- Responsive layout (desktop, tablet, mobile).
- Accessible structure (semantic HTML, keyboard navigation, visible focus).
- Navigation reflects available features.
- Controls do not claim that incomplete features are available.

## Remaining Features (Not Yet Implemented)

- Reminders and calendar integrations.
- User accounts, preferences, and privacy controls.
- Travel statistics and reporting.

Implement the approved roadmap in independently verified milestones. Features
that require external services must not claim live functionality until those
services are configured and verified.

## Current Limitations

- No authentication or account management.
- No server-side trip ownership or authorization.
- Live flight status requires an Aviationstack key (verified against the live
  service on 2026-10-22). The free plan is non-commercial, allows
  100 requests per month, and covers flights operating now (not future dates),
  so checks are most useful on the day of travel. Estimated and actual times
  appear only when the provider reports them. Statuses are checked on request,
  not pushed or polled in the background.
- Recovery guidance is general and not a clinical circadian model or medical
  advice; it does not use personal health data or live daylight information.
  Flight-status changes affect it only when the user applies them.
- No reminders or external notification delivery.
- No reminders, exports, maps, social features, or offline capabilities.
