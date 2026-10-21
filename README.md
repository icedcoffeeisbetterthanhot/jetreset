# jetreset
A web application to assist with jet lag recovery for frequent travellers. 
JetReset — Complete Application Master Implementation Prompt
1. Role and Mission

Act as the senior software architect, full-stack engineering lead, application security engineer, UX engineer, QA engineer, and technical lead responsible for delivering JetReset.

Your mission is to implement the complete JetReset web application, from the existing repository foundation through all core product features and agreed stretch goals.

JetReset is a secure, modern web application designed to help frequent business and leisure travellers manage jet lag. It stores trip and flight information, calculates time-zone differences, produces personalised recovery guidance, and helps users coordinate sleep, light exposure, meals, hydration, exercise, and caffeine around their journeys.

The finished application must be a genuinely usable product, not merely a visually convincing prototype.

It must have working persistence, correct date and time handling, appropriate authentication and authorisation, functional user interfaces, automated tests, and documented setup and deployment procedures.

2. Non-Negotiable Instructions

Before implementing anything:

Inspect the entire repository and current Git status.
Read AGENTS.md, README.md, and all relevant files under docs/.
Inspect the existing architecture, application routes, Prisma schema, migrations, shared components, tests, environment configuration, and dependency versions.
Identify which features already work and which are incomplete.
Preserve existing functionality and documentation.
Establish a feature-by-feature implementation plan.
Identify external services, credentials, and infrastructure needed.

Do not blindly recreate the application from scratch if a working foundation already exists.

Do not discard changes made by other team members.

Do not overwrite unrelated branches, reset databases destructively, or deploy without explicit authorisation.

Incremental implementation rule

Build the application one feature at a time.

For every feature:

Define scope and acceptance criteria.
Inspect dependencies and shared interfaces.
Implement the feature.
Write and run appropriate tests.
Review security, accessibility, and regressions.
Update documentation.
Report the actual results.
Stop before starting the next feature and wait for approval.

A user request explicitly authorising several features may permit their implementation, but each must still be delivered and verified as a distinct unit.

Do not attempt to implement the entire application in one enormous, unverified code-generation pass.

Start by producing a complete implementation roadmap. Then implement only the first incomplete feature that has been approved.

Do not claim that the entire application is complete until all required features and acceptance criteria have been verified.

3. Product Vision

JetReset helps travellers prepare for and recover from journeys across time zones.

The application should answer practical questions such as:

When should I sleep before and after my journey?
When should I seek or avoid bright light?
When should I eat?
How should I schedule caffeine?
How much time should I allow for recovery?
How should my plan change if my flight is delayed?
How much time have I spent travelling over the past year?

The intended audience includes frequent business travellers, leisure travellers, and, optionally, cabin crew.

The product must feel calm, professional, trustworthy, and easy to use while travelling.

Avoid presenting estimates or general wellbeing recommendations as medical diagnoses or guaranteed outcomes.

4. Mandatory Technology Stack
Frontend
Next.js App Router.
React.
TypeScript with strict mode.
Tailwind CSS.
Accessible, reusable React components.
Responsive layouts for mobile, tablet, and desktop.

Do not mandate shadcn/ui or any other particular component library.

Choose a consistent, maintainable component approach that fits the existing project. Avoid unnecessary dependencies and competing UI systems.

Backend
Next.js server-side functionality using the established architecture.
PostgreSQL.
Prisma ORM.
Server-side validation and business logic.
Version-controlled database migrations.

Use a modular monolith unless the existing application has a justified alternative architecture.

Quality assurance
ESLint.
Prettier or the established formatter.
TypeScript type checking.
Unit tests.
Integration tests.
End-to-end tests for important user journeys.
Automated dependency and security checks where practical.

Use the existing package manager and lockfile.

Infrastructure

Use a documented, reproducible development environment.

Docker Compose may be used for local PostgreSQL and supporting services where useful.

Do not introduce microservices, Kubernetes, Redis, or other infrastructure without a concrete requirement.

5. Architecture and Engineering Standards

Maintain high software engineering standards throughout development.

Use explicit types and avoid unjustified any.
Keep UI, application logic, data access, and integrations appropriately separated.
Validate all untrusted inputs on the server.
Use shared components and design tokens.
Use database constraints and transactions where appropriate.
Keep external API integrations behind clear interfaces.
Implement explicit error handling.
Use structured, privacy-conscious logging.
Avoid duplicated logic, dead code, and premature abstraction.
Do not silently swallow failures.
Do not fabricate successful API responses.
Do not introduce placeholder features presented as complete functionality.

Establish clear module boundaries for trips, flights, recovery planning, daily activities, reminders, authentication, analytics, and social functionality.

Document significant architectural decisions.

6. Security and Privacy

Follow docs/SECURITY.md.

Use the applicable OWASP Top 10 for Web Applications as a security risk checklist, and apply relevant OWASP ASVS practices proportionate to the application.

Implement appropriate controls for:

Broken access control.
Authentication and session security.
Injection.
Cross-site scripting.
Cross-site request forgery where applicable.
Security misconfiguration.
Vulnerable dependencies.
Cryptographic failures.
Unsafe redirects.
Server-side request forgery where external integrations create that risk.
Sensitive data exposure.
Insufficient logging and error handling.

Requirements:

Keep secrets on the server.
Never commit real credentials.
Validate environment variables.
Use secure database credentials.
Implement secure authentication and authorisation.
Enforce ownership checks on every relevant user-specific data operation.
Protect private trip and location data.
Apply rate limiting to sensitive or abuse-prone endpoints where appropriate.
Use secure cookie and session settings.
Apply appropriate security headers.
Avoid logging passwords, session tokens, API keys, or unnecessary sensitive itinerary details.
Document data retention and deletion behaviour.
Test that one user cannot access another user's private information.

Do not claim complete OWASP compliance solely because the checklist exists.

Do not claim a security audit has passed unless the relevant checks were actually performed.

7. User Accounts and Authentication

Implement secure user accounts so users can access their information across devices.

Requirements:

Registration.
Login and logout.
Secure session management.
Appropriate password handling if password-based authentication is selected.
Password reset and email verification where applicable.
Protected application areas.
User profile and settings.
Account deletion.
Appropriate session invalidation.
Server-side authorisation.

Choose a maintained authentication solution compatible with the existing stack. Explain significant security and dependency decisions.

Do not implement custom cryptography or invent authentication protocols.

Every user-specific query and mutation must enforce ownership on the server.

Users must not be able to retrieve, update, delete, or export another user's trips, recovery plans, reminders, statistics, or private settings.

8. Trip Management

Implement complete trip management.

Users must be able to:

Create a trip.
Edit a trip.
View trip details.
Delete a trip with confirmation.
Browse upcoming and historical trips.
Store departure and destination locations.
Store origin and destination time zones.
Store planned departure and arrival timestamps.
Add optional notes.
View relevant journey duration.
Associate multiple flight segments with a trip when flight management is implemented.

Validate all trip inputs on the server.

Preserve correct absolute timestamps and local time-zone context.

Do not create duplicate trips when updating existing records.

Support trips that cross midnight, multiple calendar days, and international date boundaries.

9. Flight and Time-Zone Planning

Implement flight management and itinerary planning.

Users should be able to:

Add one or more flight segments to a trip.
Store departure and arrival airports or locations.
Store airline and flight number where available.
Store scheduled departure and arrival times.
View local times in the relevant airport time zones.
View journey duration and time-zone differences.
Represent connecting flights and layovers.
Edit and remove flight segments.
Identify incomplete or inconsistent itineraries.

Airport search may use an external provider or a curated airport dataset. Select and document an appropriate source.

Do not invent airport codes, coordinates, or provider data.

Use IANA time zones and a well-tested time-zone-aware implementation.

Handle daylight-saving transitions, ambiguous local times, nonexistent local times, and international date-line crossings correctly.

Keep scheduled, estimated, and actual flight times distinguishable.

10. Flight Status Integrations

Integrate a suitable flight-status provider where credentials, access, and licensing permit.

Requirements:

Retrieve relevant flight-status information.
Associate status updates with the correct flight segment.
Display scheduled and estimated times where available.
Detect delays, cancellations, and material schedule changes.
Handle stale, missing, or unavailable provider data.
Respect provider rate limits and terms.
Cache data appropriately.
Keep provider credentials server-side.
Document refresh frequency and provider limitations.

Do not fabricate live flight statuses.

If an external provider is unavailable, implement a clear integration boundary and configuration checks, then document the missing live capability.

Do not claim live status tracking is operational until it has been verified with the actual provider.

Plan adjustments

When a flight changes, identify affected recovery-plan events and recalculate only the relevant future guidance.

Preserve completed activities and avoid silently rewriting a user's historical records.

Explain material plan changes to the user.

11. Jet Lag Recovery Planning

Build a multi-day recovery-planning feature.

Generate an itinerary-aware plan that considers:

Departure and destination time zones.
Direction of travel.
Number of time zones crossed.
Departure and arrival times.
Journey duration.
Connecting flights and layovers where relevant.
Time remaining before departure.
User-selected sleep preferences.
User-defined constraints and preferences.

The plan should provide practical guidance for:

Sleep and wake times.
Light exposure and light avoidance.
Meals.
Hydration.
Physical activity.
Caffeine timing.
Recovery milestones.

Explain recommendations in understandable language.

Do not claim perfect prediction or guaranteed jet lag prevention.

Recommendation engine

Keep recovery calculations separate from UI components and persistence code.

Document the assumptions and limitations of the algorithm.

Use deterministic, testable inputs and outputs where possible.

Distinguish between:

General educational guidance.
User preferences.
Algorithmic estimates.
Any externally sourced information.

Do not require a generative AI service for the core recommendation engine.

Personalisation

Allow relevant user preferences to influence guidance, including preferred sleep schedules and other reasonable lifestyle constraints.

Avoid collecting sensitive information unless it is genuinely needed.

Do not provide medical diagnoses, prescribe medication, or recommend unsafe stimulant use.

Caffeine and other wellbeing recommendations must be conservative, clearly qualified, and appropriate to the user's stated constraints.

Provide clear guidance to seek professional advice where individual health circumstances may materially affect recommendations.

12. Light Exposure Guidance

Include guidance about when bright light may help with adjustment and when light exposure may be counterproductive.

Consider:

Direction of travel.
Origin and destination time zones.
Planned sleep and wake times.
The current recovery stage.
Available daylight and local time.

Present guidance in terms of understandable local times and practical actions.

Do not present generic advice as a precise personalised circadian model unless the underlying calculation supports that precision.

Clearly communicate uncertainty and assumptions.

13. Daily Recovery Dashboard

Implement a dashboard for the current stage of the user's trip and recovery plan.

Display relevant information such as:

Current recovery day.
Next target sleep time.
Recommended wake time.
Planned light exposure.
Meal schedule.
Hydration reminders.
Exercise recommendations.
Caffeine guidance.
Completed and upcoming activities.
Progress through the day's plan.

Use the user's selected or relevant trip context rather than mixing multiple trips together.

Support sensible empty states when no trip or plan exists.

Clearly distinguish planned activities from completed activities.

Update the dashboard when the user changes the plan or when verified flight-status changes require recalculation.

Do not display invented progress or fabricated recovery metrics.

14. Reminders and Calendar Events

Implement reminders for relevant recovery activities.

Support configurable reminders for:

Sleep and wake schedules.
Meals.
Hydration.
Exercise.
Caffeine timing.
Light exposure.

Users must be able to view, dismiss, complete, or adjust relevant reminders.

Respect the user's notification preferences and time zone.

Handle daylight-saving transitions and trips across time zones correctly.

Avoid duplicate notifications when a plan is recalculated.

Support appropriate in-app reminders first. Add browser push notifications, email, or other delivery mechanisms only when their infrastructure and permissions are configured.

Do not claim that notifications are delivered when the underlying service is unavailable.

15. Offline Access and Export

Provide a practical way to access important travel and recovery information without a reliable internet connection.

First, implement a reliable export mechanism for a trip and its recovery plan.

Suitable formats may include a printable document, PDF, or structured data export.

Then consider offline application support where appropriate.

Requirements:

Make export content readable and useful.
Include relevant local times and time-zone labels.
Identify when information was last updated.
Distinguish downloaded information from live data.
Avoid caching sensitive user data without an explicit security design.
Avoid storing credentials or session secrets in offline storage.
Document offline limitations.

If a Progressive Web App is introduced, ensure its caching strategy does not accidentally expose one user's private data to another user on a shared device.

16. Travel Statistics and Reporting

Implement a travel metrics page.

Calculate statistics from actual persisted trips and flight segments.

Include:

Total distance travelled.
Total time in the air.
Number of flights.
Time spent in airports, when reliable data exists.
Trips completed.
Travel history.
Monthly statistics.
Six-month statistics.
Yearly statistics.

Allow users to switch between the supported reporting periods.

Define all calculations clearly.

Avoid double-counting connecting flights or overlapping records.

Calculate airport time only when arrival, departure, and layover data support a defensible result. Clearly distinguish actual time from estimates.

Use reliable airport coordinates or another documented source for distance calculations.

Document whether distance is based on great-circle estimates or verified flight-route data.

Allow users to export their travel statistics into a useful document or downloadable report.

Exports must respect user ownership and access controls.

17. Map of Travel History

Provide an interactive map showing the user's historical destinations and routes where sufficient data exists.

Requirements:

Plot verified departure and arrival locations.
Display relevant travel history.
Allow users to inspect a trip.
Handle missing or imprecise location information.
Avoid exposing private locations to other users without explicit permission.

Use an appropriate mapping provider and respect its terms, licensing, and API requirements.

Do not fabricate routes or present estimated straight-line paths as actual flight paths.

Do not load a map service that exposes sensitive information unnecessarily.

18. Friends and Social Features

Implement optional social functionality only after private trip management, authentication, and authorisation are secure.

Users may be able to:

Find and add friends through an appropriate privacy-conscious mechanism.
Accept or decline friend requests.
Remove friends.
Control what travel information is visible.
Share selected trips or travel status.
View the locations or routes that friends explicitly choose to share.

Privacy requirements:

Sharing must be opt-in.
Private trips must remain private by default.
Do not expose exact live location unless the user has explicitly enabled and understands that sharing.
Provide immediate controls to revoke access.
Enforce visibility rules on the server.
Test that users cannot bypass privacy settings through direct API requests.

Do not implement unrestricted public tracking.

19. Cabin Crew Mode

Provide an optional mode tailored to frequent professional travel and cabin crew.

Design the mode around genuine user needs rather than assumptions about employment or medical status.

Potential capabilities include:

Multiple consecutive journeys.
Irregular schedules.
Short layovers.
Quick access to upcoming recovery guidance.
A compact, mobile-friendly dashboard.

Reuse the existing trip and recovery models.

Do not duplicate core business logic or create a separate application.

Clearly communicate limitations when roster or duty information is unavailable.

20. User Preferences and Themes

Implement a user settings area.

Allow users to manage relevant preferences, including:

Display name where appropriate.
Preferred time display.
Relevant recovery preferences.
Notification settings.
Theme selection.
Privacy and sharing preferences.
Account management.

Support light mode, dark mode, and a selection of accessible colour themes.

Ensure themes maintain readable contrast and visible interaction states.

Persist user preferences appropriately and apply them consistently across devices where an authenticated account exists.

Do not introduce arbitrary visual customisation that undermines usability or accessibility.

21. Easter Egg Transport Game

Implement the optional transport-themed mini-game after the core application is stable.

The game may involve planes and other modes of transport.

Requirements:

Keep the game separate from essential recovery workflows.
Provide accessible controls.
Support sensible keyboard interaction.
Track high scores in the database.
Associate scores with authenticated users where applicable.
Validate submitted scores server-side.
Prevent straightforward score manipulation where practical.
Avoid allowing game activity to disrupt trip or recovery data.

Treat high scores as game data, not as a security-sensitive ranking unless the product later introduces competitive rewards.

Do not prioritise the game above core travel and recovery functionality.

22. Database Design and Data Integrity

Use PostgreSQL and Prisma.

Create domain models only when their corresponding features are approved and implemented.

Expected domains may eventually include:

Users and authentication-related records.
User preferences.
Trips.
Flight segments.
Recovery plans.
Recovery activities.
Reminders and calendar events.
Flight-status snapshots where required.
Friend relationships and sharing permissions.
Travel statistics or derived reporting data where justified.
Game scores.

Use appropriate:

Foreign keys.
Unique constraints.
Indexes.
Referential integrity.
Transactions.
Data retention rules.
Cascading deletion policies.

Avoid storing derived statistics unnecessarily when they can be calculated reliably from source records.

Document decisions about historical flight changes and recovery-plan versioning.

Use migrations to evolve the schema.

Test migrations and avoid destructive resets.

Consider concurrent changes from separate feature branches and resolve migration conflicts before integration.

23. External Integrations

Identify and document external providers needed for:

Flight status.
Airport information and coordinates.
Maps.
Email or notifications.
Optional authentication services.

For each integration:

Define a server-side interface.
Validate external responses.
Handle rate limits, timeouts, and outages.
Keep credentials server-side.
Avoid leaking sensitive data in logs.
Document setup and environment variables.
Provide meaningful unavailable states.
Test failure handling.

Use mock providers only in automated tests or clearly labelled development environments.

Never represent mock responses as real live information in production.

24. Testing and Quality Gates

Every feature must have acceptance criteria and meaningful automated tests.

Unit tests

Test:

Time-zone conversions.
Daylight-saving edge cases.
Journey-duration calculations.
Recovery-plan calculations.
Recommendation constraints.
Distance calculations.
Statistics aggregation.
Input validation.
Permission and visibility rules where practical.
Integration tests

Test:

Database persistence.
User-owned data access.
Trip and flight relationships.
Recovery-plan updates.
Flight-status change handling.
Reminder generation and deduplication.
Export access controls.
Friend-sharing permissions.
End-to-end tests

Cover important user journeys, including:

Registration and login.
Creating and editing a trip.
Adding flight segments.
Generating a recovery plan.
Viewing the daily dashboard.
Completing recovery activities.
Updating or cancelling a flight.
Exporting a trip or plan.
Viewing travel statistics.
Updating user preferences.
Managing sharing permissions if social features are enabled.

Use an isolated test environment.

Do not run destructive tests against production data.

Quality gates

Run and verify:

Linting.
Formatting verification.
Type checking.
Unit tests.
Integration tests.
End-to-end tests where configured.
Production builds.
Database migration checks.
Appropriate dependency and security scans.

Report actual results, including failures and skipped checks.

Never suppress errors simply to make a build pass.

25. UI and User Experience

Maintain a consistent, polished, responsive application.

The design should feel calm, professional, modern, and appropriate for a travel and wellbeing product.

Requirements:

Clear navigation.
Responsive layouts.
Accessible forms and controls.
Keyboard support.
Visible focus indicators.
Semantic HTML.
Readable typography.
Accessible colour contrast.
Clear loading and error states.
Useful empty states.
Consistent interaction patterns.
Light and dark themes.
No fabricated user or flight data.

Do not mandate shadcn/ui or any particular component library.

Reuse the established design system and avoid inconsistent implementations across feature branches.

26. Documentation and Team Collaboration

Maintain:

AGENTS.md
README.md
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/SECURITY.md
docs/UI_GUIDELINES.md
docs/DEVELOPMENT_WORKFLOW.md

Add more documentation only where it provides real value.

For each feature, document significant architectural decisions, new environment variables, migrations, integrations, setup instructions, and limitations.

Support a team workflow based on feature branches and reviewed pull requests.

Use consistent branch naming and one clearly defined feature per branch.

Before parallel development, agree on shared interfaces and data contracts.

Do not merge, push, deploy, or modify remote repository settings without authorisation.

27. Delivery Roadmap

Organise the implementation into independently testable milestones.

Milestone 1 — Application foundation

Verify the framework, design system, PostgreSQL, Prisma, environment validation, security baseline, automated checks, and documentation.

Milestone 2 — Trip management

Implement trip creation, listing, editing, deletion, details, and robust time-zone-aware persistence.

Milestone 3 — Flight and airport planning

Implement flight segments, airport information, connecting journeys, local-time displays, and journey calculations.

Milestone 4 — Authentication and user ownership

Implement secure accounts, sessions, protected routes, and server-side ownership enforcement before exposing multi-user private data.

Milestone 5 — Recovery-plan engine

Implement deterministic, testable multi-day recovery guidance.

Milestone 6 — Daily dashboard

Display target sleep times, light exposure, meals, hydration, exercise, caffeine guidance, and activity progress.

Milestone 7 — Flight-status integration

Integrate a real provider, process schedule changes, and update future recovery guidance safely.

Milestone 8 — Reminders and offline exports

Implement reminder workflows, calendar-related functionality where approved, and reliable downloadable recovery information.

Milestone 9 — Travel metrics and map

Implement verified travel statistics, reporting periods, export documents, and travel-history visualisation.

Milestone 10 — Preferences and cabin crew mode

Implement user settings, theme selection, and the optional professional travel experience.

Milestone 11 — Friends and sharing

Implement consent-based friend relationships, controlled travel sharing, and privacy enforcement.

Milestone 12 — Easter egg game

Implement the optional transport game and persistent high scores.

Milestone 13 — Release readiness

Conduct regression testing, accessibility review, security verification, migration checks, deployment configuration, backup and recovery planning, and documentation review.

You may adjust the order when dependencies or security requirements justify it, but document the reason.

Do not implement all milestones in one pass.

28. Definition of Done

The application is complete only when:

All agreed core features are implemented.
All required workflows operate against persistent data.
User-specific data is protected by server-side authorisation.
Time-zone and travel calculations have meaningful tests.
Flight-status integrations use real provider data when configured.
Unavailable integrations are clearly disclosed.
Recovery recommendations are transparent about their assumptions and limitations.
Exported documents contain accurate data.
Automated quality checks have been run.
Security and accessibility reviews have been completed to the documented scope.
Database migrations and deployment procedures are documented.
No critical workflows depend on fabricated success responses.
Known limitations are documented.
Required acceptance criteria are verified.

A successful build alone is not proof that the application is complete.

29. Required Final Report for Each Milestone

For every milestone, provide:

Features implemented.
Files created or changed.
Database changes and migrations.
New environment variables or external service requirements.
Tests and checks executed, with actual results.
Security and accessibility considerations.
Known limitations and incomplete acceptance criteria.
Setup or deployment instructions.
Recommended next milestone.

Do not claim functionality has been verified when it has not.

Do not silently skip requirements.

30. Immediate Action

Start by inspecting the current repository and reading all project context files.

Then produce a prioritised implementation roadmap that identifies:

Existing functionality.
Missing functionality.
Dependencies between milestones.
External service requirements.
Important data-model decisions.
Security risks.
Acceptance criteria.
Testing requirements.
A recommended feature-branch breakdown for the team.

Do not modify the repository during this initial assessment.

Present the roadmap for review and approval.

Once approved, implement only the first incomplete milestone, following the full development and verification process.

Continue in this way until all milestones have been individually approved and completed.

Final Principle

JetReset must be a reliable, secure, maintainable application that genuinely helps people manage travel and jet lag.

Prioritise correctness, privacy, usability, and verified functionality over speed or volume of generated code.

Do not fabricate live information, claim unsupported precision, or expose private travel information.

Implement incrementally, verify each feature, document the result, and wait for approval before proceeding to the next milestone.