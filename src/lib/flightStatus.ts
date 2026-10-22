export const FLIGHT_STATUS_CODES = [
  "unknown",
  "scheduled",
  "delayed",
  "departed",
  "arrived",
  "cancelled",
  "possibly_cancelled",
  "diverted",
] as const;

export type FlightStatusCode = (typeof FLIGHT_STATUS_CODES)[number];

/** Differences smaller than this are treated as normal schedule noise. */
export const MATERIAL_CHANGE_MINUTES = 15;
/** Status lookups are only made close to the flight, where live data is meaningful. */
export const STATUS_CHECK_DAYS_BEFORE_DEPARTURE = 7;
export const STATUS_CHECK_DAYS_AFTER_ARRIVAL = 3;
/** A stored status younger than this is reused instead of calling the provider. */
export const STATUS_CACHE_MINUTES = 10;

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** Statuses that cannot be applied to a recovery plan automatically. */
export const BLOCKING_STATUSES: readonly FlightStatusCode[] = [
  "cancelled",
  "possibly_cancelled",
  "diverted",
];

export interface FlightStatusSegmentInput {
  id: number;
  flightNumber: string | null;
  departureAirportCode: string;
  arrivalAirportCode: string;
  departureTimeZone: string;
  arrivalTimeZone: string;
  scheduledDepartureAt: Date;
  scheduledArrivalAt: Date;
  updatedAt: Date;
}

export interface FlightStatusSnapshotInput {
  sourceSegmentUpdatedAt: Date;
  lookupResult: "found" | "not_found";
  status: FlightStatusCode;
  providerScheduledDepartureAt: Date | null;
  estimatedDepartureAt: Date | null;
  actualDepartureAt: Date | null;
  providerScheduledArrivalAt: Date | null;
  estimatedArrivalAt: Date | null;
  actualArrivalAt: Date | null;
}

export type FlightStatusChange =
  | { kind: "cancelled" | "possibly_cancelled" | "diverted" }
  | {
      kind: "later" | "earlier";
      point: "departure" | "arrival";
      minutes: number;
      time: Date;
      basis: "actual" | "estimated" | "schedule";
    };

export type StatusCheckEligibility =
  | { eligible: true; flightNumber: string }
  | {
      eligible: false;
      reason: "no_flight_number" | "invalid_flight_number" | "too_early" | "too_late";
    };

/** Normalizes an IATA (e.g. "BA 117") or ICAO (e.g. "BAW117") flight number. */
export function normalizeFlightNumber(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.toUpperCase().replace(/[\s-]/g, "");
  // Airline designators: 3-letter ICAO, or 2-character IATA with at least one letter (e.g. U2, 9W).
  return /^(?:[A-Z]{3}|[A-Z][A-Z0-9]|[0-9][A-Z])\d{1,4}[A-Z]?$/.test(value) ? value : null;
}

export function getStatusCheckEligibility(
  segment: Pick<
    FlightStatusSegmentInput,
    "flightNumber" | "scheduledDepartureAt" | "scheduledArrivalAt"
  >,
  now: Date,
): StatusCheckEligibility {
  if (!segment.flightNumber?.trim()) return { eligible: false, reason: "no_flight_number" };
  const flightNumber = normalizeFlightNumber(segment.flightNumber);
  if (!flightNumber) return { eligible: false, reason: "invalid_flight_number" };
  if (
    segment.scheduledDepartureAt.getTime() - now.getTime() >
    STATUS_CHECK_DAYS_BEFORE_DEPARTURE * DAY_MS
  ) {
    return { eligible: false, reason: "too_early" };
  }
  if (
    now.getTime() - segment.scheduledArrivalAt.getTime() >
    STATUS_CHECK_DAYS_AFTER_ARRIVAL * DAY_MS
  ) {
    return { eligible: false, reason: "too_late" };
  }
  return { eligible: true, flightNumber };
}

/** A snapshot only describes the segment as it was when the lookup was made. */
export function isSnapshotCurrent(
  segment: Pick<FlightStatusSegmentInput, "updatedAt">,
  snapshot: Pick<FlightStatusSnapshotInput, "sourceSegmentUpdatedAt">,
): boolean {
  return snapshot.sourceSegmentUpdatedAt.getTime() === segment.updatedAt.getTime();
}

function bestTime(
  actual: Date | null,
  estimated: Date | null,
  providerScheduled: Date | null,
): { time: Date; basis: "actual" | "estimated" | "schedule" } | null {
  if (actual) return { time: actual, basis: "actual" };
  if (estimated) return { time: estimated, basis: "estimated" };
  if (providerScheduled) return { time: providerScheduled, basis: "schedule" };
  return null;
}

/** Lists material differences between the saved itinerary and the provider status. */
export function getFlightStatusChanges(
  segment: FlightStatusSegmentInput,
  snapshot: FlightStatusSnapshotInput | null,
): FlightStatusChange[] {
  if (!snapshot || snapshot.lookupResult !== "found" || !isSnapshotCurrent(segment, snapshot)) {
    return [];
  }
  if (
    snapshot.status === "cancelled" ||
    snapshot.status === "possibly_cancelled" ||
    snapshot.status === "diverted"
  ) {
    return [{ kind: snapshot.status }];
  }

  const changes: FlightStatusChange[] = [];
  const points = [
    {
      point: "departure" as const,
      saved: segment.scheduledDepartureAt,
      best: bestTime(
        snapshot.actualDepartureAt,
        snapshot.estimatedDepartureAt,
        snapshot.providerScheduledDepartureAt,
      ),
    },
    {
      point: "arrival" as const,
      saved: segment.scheduledArrivalAt,
      best: bestTime(
        snapshot.actualArrivalAt,
        snapshot.estimatedArrivalAt,
        snapshot.providerScheduledArrivalAt,
      ),
    },
  ];
  for (const { point, saved, best } of points) {
    if (!best) continue;
    const difference = Math.round((best.time.getTime() - saved.getTime()) / MINUTE_MS);
    if (Math.abs(difference) >= MATERIAL_CHANGE_MINUTES) {
      changes.push({
        kind: difference > 0 ? "later" : "earlier",
        point,
        minutes: Math.abs(difference),
        time: best.time,
        basis: best.basis,
      });
    }
  }
  return changes;
}

/**
 * Returns the departure and arrival instants a recovery plan should use for a
 * segment: provider times when they differ materially from the saved
 * schedule, otherwise the saved schedule. Blocking statuses (cancellation,
 * diversion) never change the times; they require an itinerary update instead.
 */
export function getEffectiveSegmentTimes(
  segment: FlightStatusSegmentInput,
  snapshot: FlightStatusSnapshotInput | null,
): { departureAt: Date; arrivalAt: Date; adjusted: boolean } {
  if (!snapshot) {
    return {
      departureAt: segment.scheduledDepartureAt,
      arrivalAt: segment.scheduledArrivalAt,
      adjusted: false,
    };
  }
  let departureAt = segment.scheduledDepartureAt;
  let arrivalAt = segment.scheduledArrivalAt;
  for (const change of getFlightStatusChanges(segment, snapshot)) {
    if (change.kind !== "later" && change.kind !== "earlier") continue;
    if (change.point === "departure") departureAt = change.time;
    else arrivalAt = change.time;
  }
  if (arrivalAt.getTime() <= departureAt.getTime()) {
    return {
      departureAt: segment.scheduledDepartureAt,
      arrivalAt: segment.scheduledArrivalAt,
      adjusted: false,
    };
  }
  return {
    departureAt,
    arrivalAt,
    adjusted:
      departureAt.getTime() !== segment.scheduledDepartureAt.getTime() ||
      arrivalAt.getTime() !== segment.scheduledArrivalAt.getTime(),
  };
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function formatLocal(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}

/** Plain-language description of one change, used in the UI and plan notes. */
export function describeFlightStatusChange(
  segment: Pick<FlightStatusSegmentInput, "departureTimeZone" | "arrivalTimeZone">,
  change: FlightStatusChange,
): string {
  switch (change.kind) {
    case "cancelled":
      return "Cancelled by the operator";
    case "possibly_cancelled":
      return "Status uncertain; the flight may be cancelled";
    case "diverted":
      return "Diverted to another destination";
    default: {
      const timeZone =
        change.point === "departure" ? segment.departureTimeZone : segment.arrivalTimeZone;
      const basis =
        change.basis === "actual"
          ? "actual"
          : change.basis === "estimated"
            ? "estimated"
            : "revised schedule";
      return `${change.point === "departure" ? "Departure" : "Arrival"} ${formatMinutes(
        change.minutes,
      )} ${change.kind} than planned (${basis} ${formatLocal(change.time, timeZone)})`;
    }
  }
}
