import { DailyDashboard } from "@components/dashboard/DailyDashboard";
import { selectDashboardTrip, toRecoveryPlanView } from "@lib/recoveryDashboard";
import { getRecoveryPlan, listDashboardTrips } from "@server/recoveryService";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily dashboard – JetReset",
};

type DashboardPageProps = {
  searchParams: Promise<{ trip?: string | string[] }>;
};

const secondaryLinkClass =
  "inline-flex items-center justify-center rounded-md border border-slate-200 bg-surface px-3 py-2 text-sm font-medium text-slate-700 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand";

function formatTripDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone }).format(date);
}

function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-surface p-6 text-sm text-slate-600">
      <p className="mb-1 font-medium text-surface-strong">{title}</p>
      {children}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { trip: rawTripId } = await searchParams;
  const trips = await listDashboardTrips();
  const now = new Date();

  let selectedTrip: (typeof trips)[number] | undefined;
  if (rawTripId !== undefined) {
    const tripId = Number(rawTripId);
    if (!Number.isSafeInteger(tripId) || tripId < 1) notFound();
    selectedTrip = trips.find((trip) => trip.id === tripId);
    if (!selectedTrip) notFound();
  } else {
    selectedTrip = selectDashboardTrip(trips, now);
  }
  const recovery = selectedTrip?.hasPlan ? await getRecoveryPlan(selectedTrip.id) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-surface-strong">
            Daily dashboard
          </h1>
          <p className="max-w-xl text-sm text-slate-600">
            Today&apos;s sleep targets, light exposure, meals, hydration, movement, and caffeine
            guidance for one trip, shown in destination-local time. This is general guidance, not
            medical advice.
          </p>
        </div>
        {trips.length > 1 && selectedTrip && (
          <form method="get" action="/dashboard" className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label htmlFor="dashboard-trip" className="text-sm font-medium text-surface-strong">
                Trip
              </label>
              <select
                id="dashboard-trip"
                name="trip"
                defaultValue={selectedTrip.id}
                className="block w-full max-w-xs rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm"
              >
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.name} · {formatTripDate(trip.departureAt, trip.originTimeZone)}
                    {trip.hasPlan ? "" : " (no plan)"}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={secondaryLinkClass}>
              Show
            </button>
          </form>
        )}
      </header>

      {!selectedTrip ? (
        <EmptyState title="No trips yet">
          <p>Create a trip, then generate a recovery plan to see daily guidance here.</p>
          <Link href="/trips/new" className={`mt-4 ${secondaryLinkClass}`}>
            Create trip
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-base font-semibold text-surface-strong">{selectedTrip.name}</p>
              <p className="text-xs text-slate-600">
                {selectedTrip.origin} → {selectedTrip.destination}
              </p>
            </div>
            <Link href={`/trips/${selectedTrip.id}`} className={secondaryLinkClass}>
              View trip and plan settings
            </Link>
          </div>

          {recovery?.plan ? (
            <DailyDashboard
              key={selectedTrip.id}
              tripId={selectedTrip.id}
              departureAt={selectedTrip.departureAt.toISOString()}
              arrivalAt={selectedTrip.arrivalAt.toISOString()}
              destinationTimeZone={selectedTrip.destinationTimeZone}
              plan={toRecoveryPlanView(recovery.plan)}
              planIsOutOfDate={recovery.isOutOfDate}
              initialNow={now.toISOString()}
            />
          ) : (
            <EmptyState title="No recovery plan for this trip">
              <p>
                Generate a recovery plan from the trip page to see daily sleep, light, meal,
                hydration, movement, and caffeine guidance.
              </p>
              <Link href={`/trips/${selectedTrip.id}`} className={`mt-4 ${secondaryLinkClass}`}>
                Generate a plan
              </Link>
            </EmptyState>
          )}
        </div>
      )}
    </div>
  );
}
