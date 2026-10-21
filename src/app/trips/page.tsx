import { computeDurationMinutes, formatDuration } from "@lib/timezone";
import { listTrips } from "@server/tripService";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatTripTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

function TripList({ trips }: { trips: Awaited<ReturnType<typeof listTrips>> }) {
  if (trips.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-surface p-6 text-sm text-slate-600">
        No trips in this section.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {trips.map((trip) => (
        <li
          key={trip.id}
          className="rounded-lg border border-slate-200 bg-surface p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
        >
          <div className="space-y-1">
            <p className="text-sm font-semibold text-surface-strong">{trip.name}</p>
            <p className="text-xs text-slate-600">
              {trip.origin} ({trip.originTimeZone}) → {trip.destination} ({trip.destinationTimeZone}
              )
            </p>
            <p className="text-xs text-slate-500">
              Depart: {formatTripTime(trip.departureAt, trip.originTimeZone)} ({trip.originTimeZone}
              )
            </p>
            <p className="text-xs text-slate-500">
              Arrive: {formatTripTime(trip.arrivalAt, trip.destinationTimeZone)} (
              {trip.destinationTimeZone})
            </p>
            <p className="text-xs text-slate-500">
              Duration: {formatDuration(computeDurationMinutes(trip.departureAt, trip.arrivalAt))}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link
              href={`/trips/${trip.id}`}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-surface px-3 py-2 text-xs font-medium text-slate-700 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand"
            >
              View details
            </Link>
            <Link
              href={`/trips/${trip.id}/edit`}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-surface px-3 py-2 text-xs font-medium text-slate-700 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand"
            >
              Edit
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function TripsPage() {
  const trips = await listTrips();
  const now = Date.now();
  const upcomingTrips = trips
    .filter((trip) => trip.arrivalAt.getTime() >= now)
    .sort((a, b) => a.departureAt.getTime() - b.departureAt.getTime());
  const pastTrips = trips
    .filter((trip) => trip.arrivalAt.getTime() < now)
    .sort((a, b) => b.departureAt.getTime() - a.departureAt.getTime());

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-surface-strong">Trips</h1>
        <p className="text-sm text-slate-600 max-w-xl">
          Create and manage your upcoming and past journeys. JetReset uses these trips to understand
          your travel pattern and support future recovery guidance.
        </p>
        <div className="mt-4">
          <Link
            href="/trips/new"
            className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-soft hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted"
          >
            Create trip
          </Link>
        </div>
      </header>

      {trips.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-surface p-6 text-sm text-slate-600">
          <p className="font-medium text-surface-strong mb-1">No trips yet</p>
          <p>Create a trip to keep its locations, local times, and journey duration together.</p>
        </div>
      ) : (
        <div className="space-y-10">
          <section aria-labelledby="upcoming-trips-heading" className="space-y-3">
            <h2 id="upcoming-trips-heading" className="text-lg font-semibold text-surface-strong">
              Upcoming and in progress
            </h2>
            <TripList trips={upcomingTrips} />
          </section>
          <section aria-labelledby="past-trips-heading" className="space-y-3">
            <h2 id="past-trips-heading" className="text-lg font-semibold text-surface-strong">
              Past trips
            </h2>
            <TripList trips={pastTrips} />
          </section>
        </div>
      )}
    </div>
  );
}
