import React from "react";
import Link from "next/link";
import { computeDurationMinutes, formatDuration } from "@lib/timezone";
import { JOURNEY_LEG_LABELS, type JourneyLeg } from "@lib/journeyLeg";
import { arrivalDayOffset, getTripTimeline, type TripStatus } from "@lib/tripTimeline";
import type { TripWithFlights } from "@server/tripService";

type TripFlight = TripWithFlights["flightSegments"][number];

const STATUS_STYLES: Record<TripStatus, { label: string; tone: string }> = {
  upcoming: { label: "Upcoming", tone: "bg-brand-soft text-brand-dark" },
  "in-progress": { label: "In progress", tone: "bg-accent-soft text-accent-dark" },
  past: { label: "Past", tone: "bg-surface-muted text-slate-600" },
};

const actionClass =
  "inline-flex items-center justify-center rounded-md border border-slate-200 bg-surface px-3 py-2 text-xs font-medium text-slate-700 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand";

function formatClock(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}

function formatDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date);
}

export function TripCard({ trip, now }: { trip: TripWithFlights; now: Date }) {
  const timeline = getTripTimeline(trip, now);
  const status = STATUS_STYLES[timeline.status];
  const isRoundTrip = timeline.returnFlights.length > 0;
  const headingId = `trip-${trip.id}-heading`;

  return (
    <li>
      <article
        aria-labelledby={headingId}
        className="space-y-4 rounded-lg border border-slate-200 bg-surface p-5"
      >
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h3 id={headingId} className="text-base font-semibold text-surface-strong">
              <Link
                href={`/trips/${trip.id}`}
                className="underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand"
              >
                {trip.name}
              </Link>
            </h3>
            <p className="text-sm text-slate-600">
              {trip.origin} {isRoundTrip ? "⇄" : "→"} {trip.destination}
              <span className="sr-only">{isRoundTrip ? " (round trip)" : " (one way)"}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className={`rounded-full px-2.5 py-0.5 ${status.tone}`}>{status.label}</span>
            {timeline.stayNights !== null && (
              <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-slate-600">
                {timeline.stayNights === 1 ? "1 night" : `${timeline.stayNights} nights`} in{" "}
                {trip.destination}
              </span>
            )}
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-2">
          <JourneyPanel
            leg="outbound"
            flights={timeline.outboundFlights}
            fallback={{
              from: trip.origin,
              to: trip.destination,
              departureAt: trip.departureAt,
              arrivalAt: trip.arrivalAt,
              departureTimeZone: trip.originTimeZone,
              arrivalTimeZone: trip.destinationTimeZone,
            }}
            addFlightsHref={`/trips/${trip.id}#flight-itinerary-heading`}
          />
          <JourneyPanel
            leg="return"
            flights={timeline.returnFlights}
            addFlightsHref={`/trips/${trip.id}#flight-itinerary-heading`}
          />
        </div>

        <footer className="flex flex-wrap gap-2">
          <Link href={`/trips/${trip.id}`} className={actionClass}>
            View details
          </Link>
          <Link href={`/flight-status?trip=${trip.id}`} className={actionClass}>
            Flight Status
          </Link>
          <Link href={`/trips/${trip.id}/edit`} className={actionClass}>
            Edit
          </Link>
        </footer>
      </article>
    </li>
  );
}

function JourneyPanel({
  leg,
  flights,
  fallback,
  addFlightsHref,
}: {
  leg: JourneyLeg;
  flights: TripFlight[];
  /** Trip-level times shown when an outbound journey has no flights yet. */
  fallback?: {
    from: string;
    to: string;
    departureAt: Date;
    arrivalAt: Date;
    departureTimeZone: string;
    arrivalTimeZone: string;
  };
  addFlightsHref: string;
}) {
  const first = flights[0];
  const last = flights[flights.length - 1];
  const label = JOURNEY_LEG_LABELS[leg];

  return (
    <section
      aria-label={`${label} journey`}
      className="space-y-2 rounded-md border border-slate-200 p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h4>
        {first ? (
          <p className="text-xs text-slate-500">
            {formatDay(first.scheduledDepartureAt, first.departureTimeZone)}
          </p>
        ) : (
          fallback && (
            <p className="text-xs text-slate-500">
              {formatDay(fallback.departureAt, fallback.departureTimeZone)}
            </p>
          )
        )}
      </div>

      {first && last ? (
        <>
          <ol className="space-y-2">
            {flights.map((flight) => {
              const offset = arrivalDayOffset(flight);
              return (
                <li key={flight.id} className="space-y-0.5">
                  <p className="text-xs text-slate-500">
                    {flight.flightNumber ?? "Flight"}
                    {flight.airline ? ` · ${flight.airline}` : ""}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-surface-strong">
                    {flight.departureAirportCode}{" "}
                    {formatClock(flight.scheduledDepartureAt, flight.departureTimeZone)}
                    <span className="mx-1.5 font-normal text-slate-400" aria-hidden="true">
                      →
                    </span>
                    <span className="sr-only"> to </span>
                    {flight.arrivalAirportCode}{" "}
                    {formatClock(flight.scheduledArrivalAt, flight.arrivalTimeZone)}
                    {offset !== 0 && (
                      <span
                        className="ml-1 align-super text-[10px] font-medium text-slate-500"
                        title={`Arrives ${offset > 0 ? `${offset} day(s) later` : `${-offset} day(s) earlier`} (local time)`}
                      >
                        {offset > 0 ? `+${offset}` : offset}
                      </span>
                    )}
                  </p>
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-slate-500">
            {flights.length === 1 ? "Direct" : `${flights.length} flights`} · Total{" "}
            {formatDuration(
              computeDurationMinutes(first.scheduledDepartureAt, last.scheduledArrivalAt),
            )}{" "}
            · Local times
          </p>
        </>
      ) : fallback ? (
        <>
          <p className="text-sm font-semibold tabular-nums text-surface-strong">
            {fallback.from} {formatClock(fallback.departureAt, fallback.departureTimeZone)}
            <span className="mx-1.5 font-normal text-slate-400" aria-hidden="true">
              →
            </span>
            <span className="sr-only"> to </span>
            {fallback.to} {formatClock(fallback.arrivalAt, fallback.arrivalTimeZone)}
          </p>
          <p className="text-xs text-slate-500">
            Planned trip times ·{" "}
            <Link
              href={addFlightsHref}
              className="font-medium text-brand-dark underline-offset-4 hover:underline"
            >
              Add flights
            </Link>
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-500">
          No return flights yet.{" "}
          <Link
            href={addFlightsHref}
            className="font-medium text-brand-dark underline-offset-4 hover:underline"
          >
            Add return flights
          </Link>
        </p>
      )}
    </section>
  );
}
