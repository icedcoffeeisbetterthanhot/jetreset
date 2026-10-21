export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 md:flex-row md:items-center md:px-6 md:py-20">
      <section className="flex-1 space-y-6">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-dark">
          JetReset
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-surface-strong sm:text-4xl md:text-5xl">
          Recover from jet lag with calm, practical guidance.
        </h1>
        <p className="max-w-xl text-base text-slate-600 sm:text-lg">
          JetReset helps travellers recover from jet lag with practical, time-aware
          recovery guidance. We focus on clear daily steps, gentle routines, and
          realistic expectations so you can arrive feeling more present and rested.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-soft hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted"
            aria-label="JetReset preview is not yet available"
            disabled
          >
            Preview coming soon
          </button>
          <p className="text-xs text-slate-500">
            We&apos;re currently building the foundation. Recovery plans, dashboards,
            and account features will be introduced in future releases.
          </p>
        </div>
      </section>

      <section className="flex-1">
        <div className="relative overflow-hidden rounded-lg bg-surface shadow-soft">
          <div className="absolute inset-0 bg-gradient-to-tr from-brand-soft via-white to-accent-soft opacity-80" />
          <div className="relative space-y-4 p-6">
            <h2 className="text-sm font-semibold text-surface-strong">
              Designed for modern travellers
            </h2>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>• Clear, daily guidance instead of overwhelming schedules.</li>
              <li>• Time-aware suggestions aligned with your travel pattern.</li>
              <li>• Calm, reassuring tone focused on wellbeing, not performance.</li>
              <li>• Built with privacy and security principles from day one.</li>
            </ul>
            <p className="text-xs text-slate-500">
              This is a foundation-only release. No trip data, recovery plans, or user
              accounts are stored yet.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
