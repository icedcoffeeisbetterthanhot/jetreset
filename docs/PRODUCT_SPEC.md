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
  guidance. Each activity has a start and end time (e.g. lunch 12:30–13:15,
  sleep 22:00–07:00 next day), and an optional short nap is offered on the
  first two recovery days.
- A trip-specific dashboard with trip stage, next target bedtime, flexible
  wake/bedtime preferences, and persisted activity completion.
- A standalone Daily Dashboard (`/dashboard`, linked from the primary
  navigation and each trip) showing, for one selected or automatically chosen
  trip: the recovery stage and day, next target sleep and wake times, the next
  activity, today's progress, and a day-by-day plan calendar. Each day is an
  hourly schedule of sleep, light-exposure, meal, hydration, exercise, and
  caffeine guidance with category icons, exact local times, a current-time
  marker, and planned and completed activities clearly distinguished. Empty states cover no trips,
  no plan, pre-departure, in-transit, and a finished plan period.
- A Flight Status page (`/flight-status`, linked from the primary navigation,
  each trip, and the Daily Dashboard) with on-demand checks per trip using Aviationstack (when
  `AVIATIONSTACK_API_KEY` is configured), showing your saved schedule, the
  provider schedule, and estimated and actual times separately, with delays,
  early times, cancellations, and diversions highlighted. Verified changes can
  be applied to the recovery plan, recalculating future guidance only.
- Personal activities: users can add, edit, and delete their own activities
  (e.g. meetings or dinners) with start and end times on any day of the plan
  calendar. Overlaps with plan guidance are pointed out, and these activities
  are kept when a plan is regenerated.
- Round trips: flights are marked Outbound or Return. Each trip can have an
  arrival recovery plan and a back-home recovery plan built from the return
  flights; Flight Status, the trip page, and the Daily Dashboard show and
  update each leg separately.
- Optional username/password accounts with persistent sessions and server-side
  account ownership for trip data. Email is not collected; password recovery is
  unavailable.
- Browser-scoped guest trips with an explicit option to transfer them into an
  account after sign-in.
- Consent-based friend requests and a global Cloud Dodger leaderboard showing
  only user-chosen usernames and server-replayed high scores.

Guest data is scoped to its browser session and signed-in trip data to its
account. Production use still requires HTTPS, database backups, and operational
controls.

## Landing Page Requirements (Implemented)

- JetReset branding and headline.
- Concise explanation of the product.
- Responsive layout (desktop, tablet, mobile).
- Accessible structure (semantic HTML, keyboard navigation, visible focus).
- Navigation reflects available features.
- Controls do not claim that incomplete features are available.

## Remaining Features (Not Yet Implemented)

- Reminders and calendar integrations.
- Broader user preferences and privacy controls.
- Travel sharing with friends (friend relationships do not grant trip access).
- Travel statistics and reporting.

Implement the approved roadmap in independently verified milestones. Features
that require external services must not claim live functionality until those
services are configured and verified.

## Current Limitations

- No trip sharing between friends.
- Live flight status requires an Aviationstack key (verified against the live
  service on 2026-10-22). The free plan is non-commercial, allows
  100 requests per month, and covers flights operating now (not future dates),
  so checks are most useful on the day of travel. Estimated and actual times
  appear only when the provider reports them. Statuses are checked on request,
  not pushed or polled in the background.
- Recovery guidance is general and not a clinical circadian model or medical
  advice; it does not use personal health data or live daylight information.
  Flight-status changes affect it only when the user applies them.
- No reminders, exports, maps, or offline capabilities.
