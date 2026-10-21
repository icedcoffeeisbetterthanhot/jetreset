import { listTrips } from "@server/tripService";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const trips = await listTrips();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-surface-strong">
          Trips
        </h1>
        <p className="text-sm text-slate-600 max-w-xl">
          Create and manage your upcoming and past journeys. JetReset uses these
          trips to understand your travel pattern and support future recovery
          guidance.
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
          <p>
            When you create a trip, it will appear here with its origin, destination,
            and planned times. This helps JetReset understand your travel pattern and
            support future recovery guidance.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {trips.map((trip) => (
            <li
              key={trip.id}
              className="rounded-lg border border-slate-200 bg-surface p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold text-surface-strong">
                  {trip.name}
                </p>
                <p className="text-xs text-slate-600">
                  {trip.origin} ({trip.originTimeZone}) → {trip.destination} (
                  {trip.destinationTimeZone})
                </p>
                <p className="text-xs text-slate-500">
                  Depart: {trip.departureAt.toLocaleString("en-US", { timeZone: trip.originTimeZone })}
                </p>
                <p className="text-xs text-slate-500">
                  Arrive: {trip.arrivalAt.toLocaleString("en-US", { timeZone: trip.destinationTimeZone })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Link
                  href={`/trips/${trip.id}`}
                  className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-surface px-3 py-1 text-xs font-medium text-slate-700 hover:bg-surface-muted"
                >
                  View
                </Link>
                <Link
                  href={`/trips/${trip.id}/edit`}
                  className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-surface px-3 py-1 text-xs font-medium text-slate-700 hover:bg-surface-muted"
                >
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
