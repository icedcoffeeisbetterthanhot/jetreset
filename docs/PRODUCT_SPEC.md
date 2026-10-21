# JetReset Product Specification (Foundation Scope)

## Product Identity

- **Name**: JetReset
- **Description**: JetReset helps travellers recover from jet lag with practical, time-aware recovery guidance.

## Current Release: Feature 1 (Foundation Only)

This release focuses **only** on foundational architecture and infrastructure:

- Working Next.js application with App Router.
- Strict TypeScript configuration.
- Tailwind-based design foundation.
- Minimal, polished landing page establishing JetReset's identity.
- PostgreSQL + Prisma configuration.
- Environment variable validation.
- Baseline security and testing.

No user-facing product features (trips, recovery plans, dashboards, etc.) are implemented yet.

## Landing Page Requirements (Implemented)

- JetReset branding and headline.
- Concise explanation of the product.
- Responsive layout (desktop, tablet, mobile).
- Accessible structure (semantic HTML, keyboard navigation, visible focus).
- No misleading controls suggesting non-existent functionality.
- Clear indication that core features are "coming soon".

## Future Features (Not Yet Implemented)

Potential future modules (subject to separate approval):

- Trip management and itinerary planning.
- Jet lag recovery plans and daily activity guidance.
- Daily recovery dashboard.
- Reminders and calendar integrations.
- Flight-status integrations.
- User accounts, preferences, and privacy controls.
- Travel statistics and reporting.

These must be scoped and accepted individually before implementation.

## Non-Goals for Feature 1

Feature 1 explicitly does **not**:

- Store any user-specific or trip data.
- Implement authentication or account management.
- Provide actual recovery steps or algorithms.
- Offer flight search or time zone planning tools.
- Implement offline capabilities or PWA features.
