import React from "react";
import Link from "next/link";

const features = [
  {
    number: "01",
    title: "Plan your journey",
    description:
      "Keep your trip dates, local departure and arrival times, and time zones together.",
  },
  {
    number: "02",
    title: "Organise your flights",
    description:
      "Add flight segments and review airport-local times, layovers, and journey duration.",
  },
  {
    number: "03",
    title: "Ease into local time",
    description: "Follow a flexible recovery plan with sleep targets and gentle daily activities.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
      <section className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">
          Welcome to JetReset
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-surface-strong sm:text-5xl">
          Make your next time-zone change a little easier.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
          Organise your trip, see your flights in local time, and get practical guidance for
          settling into your destination.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/trips/new"
            className="inline-flex min-h-14 items-center justify-center rounded-md bg-brand px-8 py-4 text-base font-semibold text-white shadow-soft transition-colors hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted"
          >
            Plan your first trip
          </Link>
          <Link
            href="/trips"
            className="inline-flex min-h-14 items-center justify-center rounded-md border border-slate-300 bg-surface px-8 py-4 text-base font-semibold text-surface-strong transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted"
          >
            View my trips
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          No account needed to plan trips. Sign in when you want to add friends and save game
          scores.
        </p>
      </section>

      <section aria-label="What JetReset helps you do" className="mt-14 md:mt-16">
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.number}
              className="rounded-lg border border-slate-200 bg-surface p-6 shadow-sm sm:p-7"
            >
              <p className="text-sm font-semibold tracking-wide text-accent-dark">
                {feature.number}
              </p>
              <h2 className="mt-3 text-lg font-semibold text-surface-strong">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-slate-500">
        Recovery guidance is general wellbeing information, not medical advice. Live flight tracking
        and user accounts are not available.
      </p>
    </div>
  );
}
