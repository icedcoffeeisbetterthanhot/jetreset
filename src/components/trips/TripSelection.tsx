import React, { type ReactNode } from "react";
import { notFound } from "next/navigation";
import { selectDashboardTrip, type DashboardTripCandidate } from "@lib/recoveryDashboard";

export const secondaryLinkClass =
  "inline-flex items-center justify-center rounded-md border border-slate-200 bg-surface px-3 py-2 text-sm font-medium text-slate-700 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand";

/**
 * Resolves the `?trip=` search parameter for single-trip pages. An invalid or
 * unknown ID is a 404; without one, the most relevant trip is chosen.
 */
export function selectTripFromSearchParam<T extends DashboardTripCandidate>(
  rawTripId: string | string[] | undefined,
  trips: T[],
  now: Date,
): T | undefined {
  if (rawTripId === undefined) return selectDashboardTrip(trips, now);
  const tripId = Number(rawTripId);
  if (!Number.isSafeInteger(tripId) || tripId < 1) notFound();
  const trip = trips.find((candidate) => candidate.id === tripId);
  if (!trip) notFound();
  return trip;
}

function formatTripDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone }).format(date);
}

/** A no-JavaScript GET form for switching the trip shown on a page. */
export function TripSelectForm<
  T extends { id: number; name: string; departureAt: Date; originTimeZone: string },
>({
  action,
  inputId,
  trips,
  selectedTripId,
  optionSuffix,
}: {
  action: string;
  inputId: string;
  trips: T[];
  selectedTripId: number;
  optionSuffix?: (trip: T) => string;
}) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label htmlFor={inputId} className="text-sm font-medium text-surface-strong">
          Trip
        </label>
        <select
          id={inputId}
          name="trip"
          defaultValue={selectedTripId}
          className="block w-full max-w-xs rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm"
        >
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.name} · {formatTripDate(trip.departureAt, trip.originTimeZone)}
              {optionSuffix?.(trip) ?? ""}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className={secondaryLinkClass}>
        Show
      </button>
    </form>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-surface p-6 text-sm text-slate-600">
      <p className="mb-1 font-medium text-surface-strong">{title}</p>
      {children}
    </div>
  );
}

export function TripSummaryCard({
  trip,
  children,
}: {
  trip: { name: string; origin: string; destination: string };
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-base font-semibold text-surface-strong">{trip.name}</p>
        <p className="text-xs text-slate-600">
          {trip.origin} → {trip.destination}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
