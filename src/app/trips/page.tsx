import { TripCard } from "@components/trips/TripCard";
import { getTripTimeline } from "@lib/tripTimeline";
import { listTripsWithFlights, type TripWithFlights } from "@server/tripService";
import Link from "next/link";

export const dynamic = "force-dynamic";

function TripList({ trips, now }: { trips: TripWithFlights[]; now: Date }) {
  if (trips.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-surface p-6 text-sm text-slate-600">
        No trips in this section.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} now={now} />
      ))}
    </ul>
  );
}

export default async function TripsPage() {
  const trips = await listTripsWithFlights();
  const now = new Date();
  // A trip stays current until its return flights land, not just until the outbound arrival.
  const timelines = new Map(trips.map((trip) => [trip.id, getTripTimeline(trip, now)]));
  const startOf = (trip: TripWithFlights) => timelines.get(trip.id)!.startsAt.getTime();
  const upcomingTrips = trips
    .filter((trip) => timelines.get(trip.id)!.status !== "past")
    .sort((a, b) => startOf(a) - startOf(b));
  const pastTrips = trips
    .filter((trip) => timelines.get(trip.id)!.status === "past")
    .sort((a, b) => startOf(b) - startOf(a));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-surface-strong">Trips</h1>
        <p className="text-sm text-slate-600 max-w-xl">
          Your journeys at a glance: outbound and return flights in local airport times. Open a trip
          to add flights, check their status, or plan your recovery.
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
            <TripList trips={upcomingTrips} now={now} />
          </section>
          <section aria-labelledby="past-trips-heading" className="space-y-3">
            <h2 id="past-trips-heading" className="text-lg font-semibold text-surface-strong">
              Past trips
            </h2>
            <TripList trips={pastTrips} now={now} />
          </section>
        </div>
      )}
    </div>
  );
}
