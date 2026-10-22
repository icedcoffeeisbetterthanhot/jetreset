import { FlightStatusPanel } from "@components/trips/FlightStatusPanel";
import {
  EmptyState,
  TripSelectForm,
  TripSummaryCard,
  secondaryLinkClass,
  selectTripFromSearchParam,
} from "@components/trips/TripSelection";
import { getTripFlightStatuses } from "@server/flightStatusService";
import { listDashboardTrips } from "@server/recoveryService";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Flight Status – JetReset",
};

type FlightStatusPageProps = {
  searchParams: Promise<{ trip?: string | string[] }>;
};

export default async function FlightStatusPage({ searchParams }: FlightStatusPageProps) {
  const { trip: rawTripId } = await searchParams;
  const trips = await listDashboardTrips();
  const selectedTrip = selectTripFromSearchParam(rawTripId, trips, new Date());
  const flightStatus = selectedTrip ? await getTripFlightStatuses(selectedTrip.id) : null;
  // Remount the panel when the trip or its flight segments change; it keeps fetched state otherwise.
  const panelKey = flightStatus?.segments
    .map(
      (segment) =>
        `${segment.segmentId}:${segment.scheduledDepartureAt}:${segment.scheduledArrivalAt}:${segment.flightNumber}`,
    )
    .join("|");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-surface-strong">
            Flight Status
          </h1>
          <p className="max-w-xl text-sm text-slate-600">
            Your saved schedule alongside the provider&apos;s scheduled, estimated, and actual times
            for one trip&apos;s flights, shown in each airport&apos;s local time.
          </p>
        </div>
        {trips.length > 1 && selectedTrip && (
          <TripSelectForm
            action="/flight-status"
            inputId="flight-status-trip"
            trips={trips}
            selectedTripId={selectedTrip.id}
          />
        )}
      </header>

      {!selectedTrip || !flightStatus ? (
        <EmptyState title="No trips yet">
          <p>Create a trip and add its flights to check their status here.</p>
          <Link href="/trips/new" className={`mt-4 ${secondaryLinkClass}`}>
            Create trip
          </Link>
        </EmptyState>
      ) : (
        <div className="max-w-4xl space-y-6">
          <TripSummaryCard trip={selectedTrip}>
            <Link href={`/dashboard?trip=${selectedTrip.id}`} className={secondaryLinkClass}>
              Daily Dashboard
            </Link>
            <Link href={`/trips/${selectedTrip.id}`} className={secondaryLinkClass}>
              View trip and flights
            </Link>
          </TripSummaryCard>

          {flightStatus.segments.length === 0 ? (
            <EmptyState title="No flights on this trip">
              <p>Add flight segments with flight numbers on the trip page to check their status.</p>
              <Link href={`/trips/${selectedTrip.id}`} className={`mt-4 ${secondaryLinkClass}`}>
                Add flights
              </Link>
            </EmptyState>
          ) : (
            <FlightStatusPanel
              key={`${selectedTrip.id}-${panelKey}`}
              tripId={selectedTrip.id}
              hasPlan={selectedTrip.hasPlan}
              initialStatus={flightStatus}
            />
          )}
        </div>
      )}
    </div>
  );
}
