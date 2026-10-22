import React from "react";

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 md:flex-row md:items-center md:px-6 md:py-20">
      <section className="flex-1 space-y-6">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-dark">JetReset</p>
        <h1 className="text-3xl font-semibold tracking-tight text-surface-strong sm:text-4xl md:text-5xl">
          Recover from jet lag with calm, practical guidance.
        </h1>
        <p className="max-w-xl text-base text-slate-600 sm:text-lg">
          JetReset helps travellers recover from jet lag with practical, time-aware recovery
          guidance. We focus on clear daily steps, gentle routines, and realistic expectations so
          you can arrive feeling more present and rested.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <a
            href="/trips"
            className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-soft hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted"
          >
            Manage trips
          </a>
          <p className="text-xs text-slate-500 max-w-xs">
            Start by adding your upcoming journeys. JetReset will use trip details in future
            releases to provide personalised recovery guidance.
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
              Trips, flight planning, recovery plans, and a daily dashboard are available. Account
              features will be introduced in future releases.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
