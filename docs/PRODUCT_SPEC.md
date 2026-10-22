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
- Flight-status integrations.
- Broader user preferences and privacy controls.
- Travel sharing with friends (friend relationships do not grant trip access).
- Travel statistics and reporting.

Implement the approved roadmap in independently verified milestones. Features
that require external services must not claim live functionality until those
services are configured and verified.

## Current Limitations

- No trip sharing between friends.
- No live flight status, estimates, or actual-time updates.
- Recovery guidance is general and not a clinical circadian model or medical
  advice; it does not use personal health data, verified flight updates, or
  live daylight information.
- No reminders, exports, maps, or offline capabilities.
