# Development Workflow

This document describes how to set up the project, run checks, and collaborate via Git branches and pull requests.

## Getting Started

1. **Clone the repository**

   ```bash
   git clone <your-repo-url> jetreset
   cd jetreset
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env to match your local PostgreSQL setup.
   ```

4. **Start PostgreSQL (Docker)**

   ```bash
   docker compose up -d
   ```

5. **Run Prisma migrations**

   ```bash
   npm run db:generate
   npm run db:migrate -- --name init_app_healthcheck
   ```

6. **Check database connectivity**

   ```bash
   npm run db:check
   ```

7. **Start the application**

   ```bash
   npm run dev
   ```

Open `http://localhost:3000` to view the JetReset landing page.

## Quality Gates

Before opening a pull request, run:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

If PostgreSQL is available:

```bash
npm run db:migrate
npm run db:check
```

Fix any issues before requesting review.

## Git Branch Conventions

- `main`: Stable, integrated code.
- `feature/<short-description>`: New functionality.
  - Example: `feature/trip-planner`, `feature/recovery-dashboard`.
- `fix/<short-description>`: Bug fixes.
  - Example: `fix/navbar-focus-state`.
- `chore/<short-description>`: Maintenance, tooling, non-feature changes.
  - Example: `chore/update-dependencies`.
- `docs/<short-description>`: Documentation-only changes.
  - Example: `docs/security-hardening-notes`.

## Pull Requests

Each feature branch should:

- Start from an up-to-date base branch (`main`).
- Implement one clearly defined feature.
- Include relevant tests.
- Pass linting, formatting, type checks, unit tests, and build.
- Update documentation where necessary (e.g., architecture or workflow changes).
- Avoid unrelated changes (e.g., not mixing tooling updates with feature implementation).

PRs must be reviewed before merging into `main`. Do not merge unverified code.

## Parallel Feature Development

To support multiple developers working in parallel:

- Clearly define feature scope and acceptance criteria before implementation.
- Agree on shared interfaces and data contracts before independent work depends on them.
- Use Prisma migrations for all schema changes.
- Review migrations from different branches for compatibility before integration.
- Avoid having multiple branches modify the same core files (e.g. `next.config.mjs`, `tailwind.config.cjs`) unless coordinated.
- Feature branches must not independently rewrite shared architecture or conventions.

## Database Migration Collaboration

- Each branch introducing schema changes should:
  - Add migrations via `prisma migrate dev`.
  - Document the change in PR description.
- Before merging:
  - Check migration order and compatibility.
  - Resolve conflicts or competing schema assumptions.
- Avoid destructive resets in shared environments.

## Out-of-Scope Features

The following are **explicitly out of scope** for Feature 1:

- Trips, flights, and itinerary management.
- Flight-status integrations.
- Jet lag recovery algorithms or dashboards.
- Sleep/light/meal/hydration recommendations.
- Reminders, notifications, and calendar integrations.
- Authentication and user accounts.
- Travel statistics and reporting.
- Any game or social features.

These must not be implemented or scaffolded until explicitly approved.
