import type { FlightStatusCode } from "@lib/flightStatus";

export interface FlightStatusLookupRequest {
  /** Normalized flight number, e.g. "BA117". */
  flightNumber: string;
  /** Scheduled departure date in the departure airport's local time (YYYY-MM-DD). */
  departureDateLocal: string;
  departureAirportCode: string;
  arrivalAirportCode: string;
  /** Saved schedule and airport zones, used to match and interpret provider times. */
  scheduledDepartureAt: Date;
  scheduledArrivalAt: Date;
  departureTimeZone: string;
  arrivalTimeZone: string;
}

/** Provider data mapped to JetReset's vocabulary. Times are absolute instants. */
export interface ProviderFlightStatus {
  status: FlightStatusCode;
  providerScheduledDepartureAt: Date | null;
  estimatedDepartureAt: Date | null;
  actualDepartureAt: Date | null;
  providerScheduledArrivalAt: Date | null;
  estimatedArrivalAt: Date | null;
  actualArrivalAt: Date | null;
  providerUpdatedAt: Date | null;
}

export type FlightStatusLookupResponse =
  { result: "found"; flight: ProviderFlightStatus } | { result: "not_found" };

export interface FlightStatusProvider {
  /** Stable identifier stored with each snapshot. */
  readonly name: string;
  lookup(request: FlightStatusLookupRequest): Promise<FlightStatusLookupResponse>;
}

export type FlightStatusProviderErrorKind =
  "unauthorized" | "rate_limited" | "rejected" | "unavailable" | "invalid_response";

export class FlightStatusProviderError extends Error {
  constructor(
    readonly kind: FlightStatusProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "FlightStatusProviderError";
  }
}
