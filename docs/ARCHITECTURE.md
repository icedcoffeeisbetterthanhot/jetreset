# JetReset Architecture

## Overview

JetReset currently implements the application foundation only, using a **modular monolith** approach:

- Next.js App Router for routing and server-side rendering.
- Strict TypeScript for safety and maintainability.
- Tailwind CSS for a consistent, token-based design system.
- PostgreSQL + Prisma for data persistence.
- Shared tooling for linting, formatting, type checking, and testing.

## Directory Structure

```text
src/
  app/          # Next.js App Router routes, layouts, and global styles
    layout.tsx
    page.tsx
    globals.css
  components/   # Shared UI components and layout primitives
    ui/
    layout/
  features/     # Feature-specific modules (empty for Feature 1)
  lib/          # Shared utilities, env validation, non-secret configuration
    env.ts
  server/       # Server-only services and data-access code (Prisma client)
    db.ts
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
- **Configuration**:
  - Environment variables validated via `src/lib/env.ts`
  - Next.js configuration via `next.config.mjs`
- **Tests**: `tests` for behavior verification

## Server-Only Boundaries

- Database access (`PrismaClient`) is defined in `src/server/db.ts`.
- Client components must not import `src/server/*`.
- Environment validation (`getServerEnv`) is intended for server-side modules only.

## Future Modules (Not Yet Implemented)

The architecture is compatible with future modules such as:

- Trips and flights
- Airports and time zones
- Recovery planning and daily activities
- Reminders and calendar integrations
- User accounts and preferences
- Travel statistics and reporting

These modules will live under `src/features/` and related directories when explicitly approved, but are intentionally not scaffolded in Feature 1.

## Design Decisions (Key Points)

- **Modular monolith**: Easier for a small team to reason about, with clear boundaries within a single app.
- **Prisma + PostgreSQL**: Structured, typed access and migrations, appropriate for long-term data integrity.
- **Tailwind tokens**: Semantic color and spacing tokens enable a consistent look across independently developed features.
- **Strict TypeScript**: Reduces runtime errors and improves API clarity between modules.
