import { z } from "zod";
import type { FlightStatusCode } from "@lib/flightStatus";
import { getLocalDate } from "@lib/recoveryDashboard";
import { toZonedInstant } from "@lib/timezone";
import {
  FlightStatusProviderError,
  type FlightStatusLookupRequest,
  type FlightStatusLookupResponse,
  type FlightStatusProvider,
  type ProviderFlightStatus,
} from "@server/flightStatus/provider";

/**
 * Aviationstack real-time flights endpoint (APILayer).
 * GET https://api.aviationstack.com/v1/flights?access_key=…&flight_iata=…
 * HTTPS only: the key is a query parameter, so the app never falls back to HTTP.
 */
export const AVIATIONSTACK_ENDPOINT = "https://api.aviationstack.com/v1/flights";
const DEFAULT_TIMEOUT_MS = 8_000;

const nullableString = z.string().nullish();
const movementSchema = z
  .object({
    iata: nullableString,
    timezone: nullableString,
    scheduled: nullableString,
    estimated: nullableString,
    actual: nullableString,
  })
  .passthrough();
const flightSchema = z
  .object({
    flight_date: nullableString,
    flight_status: nullableString,
    departure: movementSchema,
    arrival: movementSchema,
  })
  .passthrough();
const successSchema = z.object({ data: z.array(flightSchema) }).passthrough();
const errorSchema = z.object({
  error: z.object({ code: z.union([z.string(), z.number()]).optional() }).passthrough(),
});

type AviationstackFlight = z.infer<typeof flightSchema>;
type AviationstackMovement = z.infer<typeof movementSchema>;

const STATUS_MAP: Record<string, FlightStatusCode> = {
  scheduled: "scheduled",
  active: "departed",
  landed: "arrived",
  cancelled: "cancelled",
  diverted: "diverted",
};

const WALL_CLOCK = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Reads an Aviationstack timestamp. The service labels airport-local wall-clock
 * times with "+00:00" (verified against live data on 2026-10-22: active
 * flights' actual departures from Tokyo, Manila, and Baghdad were only in the
 * past when read as local time). A zero offset is therefore read as local time
 * in the airport's zone; any other explicit offset is trusted as stated.
 */
export function parseProviderTime(value: string | null | undefined, timeZone: string): Date | null {
  if (!value) return null;
  const match = WALL_CLOCK.exec(value.trim());
  if (!match) return null;
  const offset = match[3];
  if (offset && !/^(Z|[+-]00:?00)$/.test(offset)) {
    const stated = new Date(value.trim());
    return Number.isFinite(stated.getTime()) ? stated : null;
  }
  try {
    return toZonedInstant({ localDateTime: `${match[1]}T${match[2]}`, timeZone });
  } catch {
    // Unknown zone, or a nonexistent/ambiguous local time around a DST change.
    return null;
  }
}

function interpretMovement(movement: AviationstackMovement, fallbackZone: string) {
  const timeZone = movement.timezone || fallbackZone;
  return {
    scheduled: parseProviderTime(movement.scheduled, timeZone),
    estimated: parseProviderTime(movement.estimated, timeZone),
    actual: parseProviderTime(movement.actual, timeZone),
  };
}

export function mapAviationstackFlight(
  flight: AviationstackFlight,
  request: FlightStatusLookupRequest,
): ProviderFlightStatus {
  const status = STATUS_MAP[flight.flight_status ?? ""] ?? "unknown";
  const departure = interpretMovement(flight.departure, request.departureTimeZone);
  const arrival = interpretMovement(flight.arrival, request.arrivalTimeZone);
  return {
    status,
    providerScheduledDepartureAt: departure.scheduled,
    estimatedDepartureAt: departure.estimated,
    actualDepartureAt: departure.actual,
    providerScheduledArrivalAt: arrival.scheduled,
    estimatedArrivalAt: arrival.estimated,
    actualArrivalAt: arrival.actual,
    // Aviationstack does not report when the flight record was last updated.
    providerUpdatedAt: null,
  };
}

function errorForCode(code: string | number | undefined, httpStatus: number) {
  const value = String(code ?? "");
  if (value === "invalid_access_key" || value === "missing_access_key" || httpStatus === 401) {
    return new FlightStatusProviderError(
      "unauthorized",
      "The flight-status provider rejected the configured credentials.",
    );
  }
  if (value === "usage_limit_reached") {
    return new FlightStatusProviderError(
      "rate_limited",
      "The flight-status provider's monthly request allowance has been used up.",
    );
  }
  if (value === "rate_limit_reached" || httpStatus === 429) {
    return new FlightStatusProviderError(
      "rate_limited",
      "The flight-status provider's rate limit was reached. Try again later.",
    );
  }
  if (value === "https_access_restricted") {
    return new FlightStatusProviderError(
      "unauthorized",
      "The flight-status plan does not allow encrypted (HTTPS) requests. JetReset will not send the key unencrypted.",
    );
  }
  if (value === "function_access_restricted" || httpStatus === 403) {
    return new FlightStatusProviderError(
      "rejected",
      "The flight-status plan does not include this lookup.",
    );
  }
  if (httpStatus >= 400 && httpStatus < 500) {
    return new FlightStatusProviderError(
      "rejected",
      "The flight-status provider could not answer this request.",
    );
  }
  return new FlightStatusProviderError(
    "unavailable",
    "The flight-status provider is currently unavailable.",
  );
}

export function createAviationstackProvider(options: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): FlightStatusProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    name: "aviationstack",
    async lookup(request: FlightStatusLookupRequest): Promise<FlightStatusLookupResponse> {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(request.departureDateLocal)) {
        throw new FlightStatusProviderError("rejected", "Invalid flight date.");
      }
      const url = new URL(AVIATIONSTACK_ENDPOINT);
      url.searchParams.set("access_key", options.apiKey);
      // Flight numbers with a three-letter designator are ICAO (e.g. BAW117).
      url.searchParams.set(
        /^[A-Z]{3}\d/.test(request.flightNumber) ? "flight_icao" : "flight_iata",
        request.flightNumber,
      );
      url.searchParams.set("dep_iata", request.departureAirportCode);
      url.searchParams.set("arr_iata", request.arrivalAirportCode);

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        // The underlying error can contain the request URL, which includes the key.
        throw new FlightStatusProviderError(
          "unavailable",
          "The flight-status provider did not respond in time.",
        );
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        if (!response.ok) throw errorForCode(undefined, response.status);
        throw new FlightStatusProviderError(
          "invalid_response",
          "The flight-status provider returned an unreadable response.",
        );
      }

      // APILayer can report errors in the body with a 200 status.
      const error = errorSchema.safeParse(body);
      if (error.success) throw errorForCode(error.data.error.code, response.status);
      if (!response.ok) throw errorForCode(undefined, response.status);

      const parsed = successSchema.safeParse(body);
      if (!parsed.success) {
        throw new FlightStatusProviderError(
          "invalid_response",
          "The flight-status provider returned an unexpected response.",
        );
      }

      // Keep the saved route's flight that departs on the saved local date.
      const candidates = parsed.data.data
        .filter(
          (flight) =>
            flight.departure.iata?.toUpperCase() === request.departureAirportCode &&
            flight.arrival.iata?.toUpperCase() === request.arrivalAirportCode,
        )
        .map((flight) => mapAviationstackFlight(flight, request))
        .filter(
          (flight) =>
            flight.providerScheduledDepartureAt &&
            getLocalDate(flight.providerScheduledDepartureAt, request.departureTimeZone) ===
              request.departureDateLocal,
        )
        .sort(
          (first, second) =>
            Math.abs(
              (first.providerScheduledDepartureAt as Date).getTime() -
                request.scheduledDepartureAt.getTime(),
            ) -
            Math.abs(
              (second.providerScheduledDepartureAt as Date).getTime() -
                request.scheduledDepartureAt.getTime(),
            ),
        );
      return candidates[0] ? { result: "found", flight: candidates[0] } : { result: "not_found" };
    },
  };
}
