import { createHash } from "node:crypto";
import { getFlightStatusProviderConfig } from "@lib/env";
import {
  BLOCKING_STATUSES,
  STATUS_CACHE_MINUTES,
  describeFlightStatusChange,
  getEffectiveSegmentTimes,
  getFlightStatusChanges,
  getStatusCheckEligibility,
  isSnapshotCurrent,
  type FlightStatusSegmentInput,
  type FlightStatusSnapshotInput,
} from "@lib/flightStatus";
import { getLocalDate } from "@lib/recoveryDashboard";
import { prisma } from "@server/db";
import { createAviationstackProvider } from "@server/flightStatus/aviationstack";
import {
  FlightStatusProviderError,
  type FlightStatusProvider,
} from "@server/flightStatus/provider";
import { FlightStatusNotConfiguredError } from "@server/flightStatusErrors";
import { TripInputError, TripNotFoundError } from "@server/tripService";

/**
 * Upper bound on provider calls per server process per hour. The Aviationstack
 * free plan allows 100 requests per month, so this is deliberately low.
 */
export const PROVIDER_CALLS_PER_HOUR = 10;
const providerCallTimes: number[] = [];

function takeProviderCall(now: Date): boolean {
  const windowStart = now.getTime() - 3_600_000;
  while (providerCallTimes.length && providerCallTimes[0] <= windowStart) providerCallTimes.shift();
  if (providerCallTimes.length >= PROVIDER_CALLS_PER_HOUR) return false;
  providerCallTimes.push(now.getTime());
  return true;
}

/** Test hook: clears the in-memory provider call budget. */
export function resetProviderCallBudget(): void {
  providerCallTimes.length = 0;
}

export function getConfiguredFlightStatusProvider(): FlightStatusProvider | null {
  const config = getFlightStatusProviderConfig();
  return config ? createAviationstackProvider({ apiKey: config.apiKey }) : null;
}

function isProviderConfigured(): boolean {
  try {
    return getFlightStatusProviderConfig() !== null;
  } catch {
    return false;
  }
}

export type SegmentWithSnapshot = FlightStatusSegmentInput & {
  statusSnapshot:
    | (FlightStatusSnapshotInput & {
        provider: string;
        fetchedAt: Date;
        providerUpdatedAt: Date | null;
      })
    | null;
};

function flightLabel(segment: FlightStatusSegmentInput): string {
  return `${segment.flightNumber ?? "Flight"} ${segment.departureAirportCode}→${segment.arrivalAirportCode}`;
}

export interface FlightStatusSummary {
  /** Hash of material provider times, or null when no segment needs adjusting. */
  signature: string | null;
  effectiveFlights: Array<{
    departureAt: Date;
    arrivalAt: Date;
    departureTimeZone: string;
    arrivalTimeZone: string;
  }>;
  adjustments: string[];
  blockingAlerts: string[];
}

/** Derives effective itinerary times and alerts from the stored snapshots. */
export function summarizeFlightStatus(segments: SegmentWithSnapshot[]): FlightStatusSummary {
  const signatureParts: string[] = [];
  const adjustments: string[] = [];
  const blockingAlerts: string[] = [];
  const effectiveFlights = segments.map((segment) => {
    const snapshot = segment.statusSnapshot;
    const changes = getFlightStatusChanges(segment, snapshot);
    for (const change of changes) {
      const description = `${flightLabel(segment)}: ${describeFlightStatusChange(segment, change)}`;
      if (BLOCKING_STATUSES.includes(change.kind as (typeof BLOCKING_STATUSES)[number])) {
        blockingAlerts.push(description);
      } else {
        adjustments.push(description);
      }
    }
    const effective = getEffectiveSegmentTimes(segment, snapshot);
    if (effective.adjusted) {
      signatureParts.push(
        `${segment.id}:${effective.departureAt.toISOString()}:${effective.arrivalAt.toISOString()}`,
      );
    }
    return {
      departureAt: effective.departureAt,
      arrivalAt: effective.arrivalAt,
      departureTimeZone: segment.departureTimeZone,
      arrivalTimeZone: segment.arrivalTimeZone,
    };
  });

  return {
    signature: signatureParts.length
      ? createHash("sha256").update(signatureParts.sort().join("|")).digest("hex")
      : null,
    effectiveFlights,
    adjustments,
    blockingAlerts,
  };
}

const segmentSelect = {
  id: true,
  flightNumber: true,
  departureAirportCode: true,
  arrivalAirportCode: true,
  departureTimeZone: true,
  arrivalTimeZone: true,
  scheduledDepartureAt: true,
  scheduledArrivalAt: true,
  updatedAt: true,
  statusSnapshot: true,
} as const;

export { segmentSelect as flightStatusSegmentSelect };

function toIso(date: Date | null): string | null {
  return date?.toISOString() ?? null;
}

function buildView(
  segments: SegmentWithSnapshot[],
  planSignature: string | null | undefined,
  now: Date,
  errors: Map<number, string>,
) {
  const summary = summarizeFlightStatus(segments);
  return {
    configured: isProviderConfigured(),
    recoveryPlanUpdatePending: planSignature !== undefined && summary.signature !== planSignature,
    blockingAlerts: summary.blockingAlerts,
    segments: segments.map((segment) => {
      const snapshot = segment.statusSnapshot;
      const eligibility = getStatusCheckEligibility(segment, now);
      return {
        segmentId: segment.id,
        flightNumber: segment.flightNumber,
        departureAirportCode: segment.departureAirportCode,
        arrivalAirportCode: segment.arrivalAirportCode,
        departureTimeZone: segment.departureTimeZone,
        arrivalTimeZone: segment.arrivalTimeZone,
        scheduledDepartureAt: segment.scheduledDepartureAt.toISOString(),
        scheduledArrivalAt: segment.scheduledArrivalAt.toISOString(),
        eligibility: eligibility.eligible
          ? ({ eligible: true } as const)
          : ({ eligible: false, reason: eligibility.reason } as const),
        snapshot: snapshot
          ? {
              current: isSnapshotCurrent(segment, snapshot),
              provider: snapshot.provider,
              lookupResult: snapshot.lookupResult,
              status: snapshot.status,
              providerScheduledDepartureAt: toIso(snapshot.providerScheduledDepartureAt),
              estimatedDepartureAt: toIso(snapshot.estimatedDepartureAt),
              actualDepartureAt: toIso(snapshot.actualDepartureAt),
              providerScheduledArrivalAt: toIso(snapshot.providerScheduledArrivalAt),
              estimatedArrivalAt: toIso(snapshot.estimatedArrivalAt),
              actualArrivalAt: toIso(snapshot.actualArrivalAt),
              providerUpdatedAt: toIso(snapshot.providerUpdatedAt),
              fetchedAt: snapshot.fetchedAt.toISOString(),
            }
          : null,
        changes: getFlightStatusChanges(segment, snapshot).map((change) =>
          describeFlightStatusChange(segment, change),
        ),
        error: errors.get(segment.id) ?? null,
      };
    }),
  };
}

export type TripFlightStatusView = ReturnType<typeof buildView>;

function validateTripId(tripId: number): void {
  if (!Number.isSafeInteger(tripId) || tripId < 1) {
    throw new TripInputError("Trip ID must be a positive integer.");
  }
}

async function loadTrip(tripId: number) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      flightSegments: {
        orderBy: [{ scheduledDepartureAt: "asc" }, { id: "asc" }],
        select: segmentSelect,
      },
      recoveryPlan: { select: { flightStatusSignature: true } },
    },
  });
  if (!trip) throw new TripNotFoundError();
  return trip;
}

/** Returns stored statuses without contacting the provider. */
export async function getTripFlightStatuses(tripId: number, now = new Date()) {
  validateTripId(tripId);
  const trip = await loadTrip(tripId);
  return buildView(
    trip.flightSegments,
    trip.recoveryPlan ? trip.recoveryPlan.flightStatusSignature : undefined,
    now,
    new Map(),
  );
}

/**
 * Refreshes eligible segments from the provider. Statuses fetched within the
 * cache window are reused, and calls are capped per process per hour.
 */
export async function refreshTripFlightStatuses(
  tripId: number,
  options: { provider?: FlightStatusProvider | null; now?: Date } = {},
) {
  validateTripId(tripId);
  const now = options.now ?? new Date();
  const provider =
    options.provider === undefined ? getConfiguredFlightStatusProvider() : options.provider;
  if (!provider) throw new FlightStatusNotConfiguredError();

  const trip = await loadTrip(tripId);
  const errors = new Map<number, string>();
  let stopReason: string | null = null;

  for (const segment of trip.flightSegments) {
    const eligibility = getStatusCheckEligibility(segment, now);
    if (!eligibility.eligible) continue;

    const snapshot = segment.statusSnapshot;
    if (
      snapshot &&
      isSnapshotCurrent(segment, snapshot) &&
      now.getTime() - snapshot.fetchedAt.getTime() < STATUS_CACHE_MINUTES * 60_000
    ) {
      continue;
    }
    if (stopReason) {
      errors.set(segment.id, stopReason);
      continue;
    }
    if (!takeProviderCall(now)) {
      errors.set(segment.id, "Status check limit reached. Try again later.");
      continue;
    }

    try {
      const response = await provider.lookup({
        flightNumber: eligibility.flightNumber,
        departureDateLocal: getLocalDate(segment.scheduledDepartureAt, segment.departureTimeZone),
        departureAirportCode: segment.departureAirportCode,
        arrivalAirportCode: segment.arrivalAirportCode,
        scheduledDepartureAt: segment.scheduledDepartureAt,
        scheduledArrivalAt: segment.scheduledArrivalAt,
        departureTimeZone: segment.departureTimeZone,
        arrivalTimeZone: segment.arrivalTimeZone,
      });
      const data =
        response.result === "found"
          ? { lookupResult: "found" as const, ...response.flight }
          : {
              lookupResult: "not_found" as const,
              status: "unknown" as const,
              providerScheduledDepartureAt: null,
              estimatedDepartureAt: null,
              actualDepartureAt: null,
              providerScheduledArrivalAt: null,
              estimatedArrivalAt: null,
              actualArrivalAt: null,
              providerUpdatedAt: null,
            };
      const fields = {
        ...data,
        provider: provider.name,
        sourceSegmentUpdatedAt: segment.updatedAt,
        fetchedAt: now,
      };
      segment.statusSnapshot = await prisma.flightStatusSnapshot.upsert({
        where: { segmentId: segment.id },
        create: { ...fields, segment: { connect: { id: segment.id } } },
        update: fields,
      });
    } catch (error) {
      if (!(error instanceof FlightStatusProviderError)) throw error;
      // Log the failure category only: no credentials or itinerary details.
      console.warn(
        JSON.stringify({
          event: "flight_status_lookup_failed",
          segmentId: segment.id,
          kind: error.kind,
        }),
      );
      errors.set(segment.id, error.message);
      if (error.kind === "unauthorized" || error.kind === "rate_limited")
        stopReason = error.message;
    }
  }

  return buildView(
    trip.flightSegments,
    trip.recoveryPlan ? trip.recoveryPlan.flightStatusSignature : undefined,
    now,
    errors,
  );
}
