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

   ```powershell
   Copy-Item .env.example .env
   ```

   Edit `DATABASE_URL` in `.env` to match a local PostgreSQL database and user.
   The `.env` file contains local credentials and is ignored by Git. Never commit
   it or paste its contents into issue reports.

4. **Start PostgreSQL**

   Docker is optional. If Docker Compose is available, start the included
   PostgreSQL service:

   ```bash
   docker compose up -d
   ```

   Otherwise start the PostgreSQL Windows service installed on your machine.
   Ensure the database and role in `DATABASE_URL` exist and PostgreSQL listens
   on the configured port (the example uses `localhost:5432`).

5. **Generate Prisma Client and apply migrations**

   ```powershell
   npm run db:generate
   npx prisma migrate deploy
   npm run db:check
   ```

   If the application reports that a Prisma model delegate is undefined, stop
   the dev server, run `npm run db:generate`, and restart the server. On Windows,
   the running server can lock the Prisma query engine and prevent regeneration.

   `migrate deploy` applies the migrations already in this repository and does
   not create a shadow database. To create a new migration during development,
   use `npm run db:migrate -- --name <migration_name>`; Prisma's development
   migration workflow needs a database role allowed to create databases for its
   temporary shadow database. Do not use `--name` just to apply existing
   migrations.

   Refresh the bundled airport directory when needed with
   `npm run airports:update`. This downloads the scheduled-service airport
   dataset from OurAirports and derives airport time zones from coordinates.
   Apply the latest recovery-plan schema along with the other committed
   migrations using `npx prisma migrate deploy`.

6. **Start the application**

   ```bash
   npm run dev
   ```

Open `http://localhost:3000` to view JetReset.

## Quality Gates

Before opening a pull request, run:

```bash
npm run lint
npm run format:check
npm run typecheck
npm test -- --run
npm run build
```

If PostgreSQL is available, apply committed migrations and check connectivity:

```bash
npx prisma migrate deploy
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

## Feature Roadmap and Data Safety

Trip management, flight planning, recovery plans, and activity progress are
present in the current codebase, but they have no authentication or
user-ownership boundary. Keep this application on a trusted local development
environment until authentication and authorization have been implemented and
verified. Recovery suggestions are general educational guidance rather than
medical advice.

The remaining product roadmap is documented in `README.md`. Implement and
verify one approved milestone at a time. Do not expose private trip data to
other users before server-side ownership checks are in place.
