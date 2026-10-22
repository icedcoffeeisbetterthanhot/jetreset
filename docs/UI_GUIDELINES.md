# UI Guidelines

JetReset aims to feel like a premium travel and wellbeing product: modern, calm, reassuring, and professional.

## Design Foundations

### Colors (Semantic Tokens)

Defined in `tailwind.config.cjs`:

- `brand`: primary brand blue
  - `brand.DEFAULT`: main accent
  - `brand.soft`: subtle backgrounds
  - `brand.dark`: stronger emphasis
- `surface`:
  - `surface.DEFAULT`: base surfaces (cards)
  - `surface.muted`: page background
  - `surface.strong`: primary text
- `accent`:
  - `accent.DEFAULT`, `accent.soft`, `accent.dark`
- `danger`:
  - `danger.DEFAULT`, `danger.soft`, `danger.dark`
- `warning` (e.g. out-of-date plan notices):
  - `warning.DEFAULT`, `warning.soft`, `warning.dark`
- `success` (e.g. completed activities):
  - `success.DEFAULT`, `success.soft`, `success.dark`

Use semantic tokens (e.g. `text-surface-strong`, `bg-brand-soft`) instead of arbitrary hex values.

### Typography

- Base font: `font-sans` (system UI stack).
- Heading hierarchy:
  - Page titles: `text-3xl`/`text-4xl` with `font-semibold`.
  - Section titles: `text-lg` with `font-semibold`.
  - Body: `text-base` or `text-sm` for secondary text.
- Use `tracking-tight` for headings to keep them clean and modern.

### Spacing & Layout

- Prefer tailwind spacing scale (`px-4`, `py-6`, `gap-4`, etc.).
- Page content typically constrained to `max-w-6xl` and centered (`mx-auto`).
- Use `space-y-*` for vertical rhythm within sections.

### Border & Radius

- Use provided radius tokens:
  - `rounded-md` for most controls.
  - `rounded-lg` or `rounded-xl` for cards and panels.
- Avoid inconsistent custom radii.

### Focus & Interaction States

- Use focus-visible ring pattern from `globals.css` (ring-brand + offset).
- Ensure all interactive elements are keyboard-focusable and have visible focus states.
- Buttons:
  - Primary actions: `bg-brand text-white`.
  - Secondary: `bg-surface`, `border border-slate-200`.
  - Disabled state: lower opacity and `disabled:cursor-not-allowed`.

### Responsive Layout

- Start with a mobile-first layout.
- Use breakpoints:
  - `sm`: small screens
  - `md`: standard tablet/desktop
- The landing page uses:
  - Column layout on mobile.
  - Two-column layout (`md:flex-row`) on larger screens.

## Component Conventions

- Shared UI components live under `src/components/ui` and `src/components/layout`.
- Components should:
  - Be accessible by default (labels, roles, keyboard support).
  - Use semantic HTML elements (`button`, `section`, `header`, `main`, `footer`).
  - Avoid inline styles if Tailwind classes are available.

## Dark Mode

- Currently, we only support a polished light theme.
- Dark mode may be introduced later; design tokens and semantic usage will make this easier.
