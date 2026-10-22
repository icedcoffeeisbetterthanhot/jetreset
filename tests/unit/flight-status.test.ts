import {
  describeFlightStatusChange,
  getEffectiveSegmentTimes,
  getFlightStatusChanges,
  getStatusCheckEligibility,
  normalizeFlightNumber,
  type FlightStatusSegmentInput,
  type FlightStatusSnapshotInput,
} from "@lib/flightStatus";

const updatedAt = new Date("2026-10-01T09:00:00.000Z");
const segment: FlightStatusSegmentInput = {
  id: 7,
  flightNumber: "BA 117",
  departureAirportCode: "LHR",
  arrivalAirportCode: "JFK",
  departureTimeZone: "Europe/London",
  arrivalTimeZone: "America/New_York",
  scheduledDepartureAt: new Date("2026-10-22T11:30:00.000Z"),
  scheduledArrivalAt: new Date("2026-10-22T19:30:00.000Z"),
  updatedAt,
};

function snapshot(overrides: Partial<FlightStatusSnapshotInput> = {}): FlightStatusSnapshotInput {
  return {
    sourceSegmentUpdatedAt: updatedAt,
    lookupResult: "found",
    status: "scheduled",
    providerScheduledDepartureAt: new Date("2026-10-22T11:30:00.000Z"),
    estimatedDepartureAt: null,
    actualDepartureAt: null,
    providerScheduledArrivalAt: new Date("2026-10-22T19:30:00.000Z"),
    estimatedArrivalAt: null,
    actualArrivalAt: null,
    ...overrides,
  };
}

describe("normalizeFlightNumber", () => {
  it("accepts IATA and ICAO formats with spaces or dashes", () => {
    expect(normalizeFlightNumber("ba 117")).toBe("BA117");
    expect(normalizeFlightNumber("BAW-117")).toBe("BAW117");
    expect(normalizeFlightNumber("U2 8123A")).toBe("U28123A");
    expect(normalizeFlightNumber("9W 123")).toBe("9W123");
  });

  it("rejects values that are not flight numbers", () => {
    expect(normalizeFlightNumber("117")).toBeNull();
    expect(normalizeFlightNumber("BA/117")).toBeNull();
    expect(normalizeFlightNumber("")).toBeNull();
    expect(normalizeFlightNumber(null)).toBeNull();
  });
});

describe("getStatusCheckEligibility", () => {
  it("allows checks from 7 days before departure until 3 days after arrival", () => {
    expect(getStatusCheckEligibility(segment, new Date("2026-10-16T12:00:00.000Z"))).toEqual({
      eligible: true,
      flightNumber: "BA117",
    });
    expect(getStatusCheckEligibility(segment, new Date("2026-10-14T00:00:00.000Z"))).toEqual({
      eligible: false,
      reason: "too_early",
    });
    expect(getStatusCheckEligibility(segment, new Date("2026-10-26T00:00:00.000Z"))).toEqual({
      eligible: false,
      reason: "too_late",
    });
  });

  it("requires a recognisable flight number", () => {
    const now = new Date("2026-10-22T08:00:00.000Z");
    expect(getStatusCheckEligibility({ ...segment, flightNumber: null }, now)).toEqual({
      eligible: false,
      reason: "no_flight_number",
    });
    expect(getStatusCheckEligibility({ ...segment, flightNumber: "Speedbird" }, now)).toEqual({
      eligible: false,
      reason: "invalid_flight_number",
    });
  });
});

describe("getFlightStatusChanges", () => {
  it("reports material delays using actual, then estimated, then provider schedule", () => {
    const changes = getFlightStatusChanges(
      segment,
      snapshot({
        status: "departed",
        actualDepartureAt: new Date("2026-10-22T13:05:00.000Z"),
        estimatedArrivalAt: new Date("2026-10-22T20:50:00.000Z"),
      }),
    );

    expect(changes).toEqual([
      {
        kind: "later",
        point: "departure",
        minutes: 95,
        time: new Date("2026-10-22T13:05:00.000Z"),
        basis: "actual",
      },
      {
        kind: "later",
        point: "arrival",
        minutes: 80,
        time: new Date("2026-10-22T20:50:00.000Z"),
        basis: "estimated",
      },
    ]);
    expect(describeFlightStatusChange(segment, changes[0])).toBe(
      "Departure 1 h 35 min later than planned (actual Thu 22 Oct, 14:05)",
    );
  });

  it("ignores differences below 15 minutes and reports early times", () => {
    expect(
      getFlightStatusChanges(
        segment,
        snapshot({ estimatedDepartureAt: new Date("2026-10-22T11:44:00.000Z") }),
      ),
    ).toEqual([]);
    expect(
      getFlightStatusChanges(
        segment,
        snapshot({ estimatedArrivalAt: new Date("2026-10-22T19:00:00.000Z") }),
      ),
    ).toMatchObject([{ kind: "earlier", point: "arrival", minutes: 30 }]);
  });

  it("reports blocking statuses without time changes", () => {
    expect(getFlightStatusChanges(segment, snapshot({ status: "cancelled" }))).toEqual([
      { kind: "cancelled" },
    ]);
    expect(getFlightStatusChanges(segment, snapshot({ status: "diverted" }))).toEqual([
      { kind: "diverted" },
    ]);
  });

  it("ignores snapshots that are missing, unmatched, or from an earlier version of the segment", () => {
    const delayed = { estimatedDepartureAt: new Date("2026-10-22T14:00:00.000Z") };
    expect(getFlightStatusChanges(segment, null)).toEqual([]);
    expect(
      getFlightStatusChanges(segment, snapshot({ ...delayed, lookupResult: "not_found" })),
    ).toEqual([]);
    expect(
      getFlightStatusChanges(
        segment,
        snapshot({ ...delayed, sourceSegmentUpdatedAt: new Date("2026-09-01T00:00:00.000Z") }),
      ),
    ).toEqual([]);
  });
});

describe("getEffectiveSegmentTimes", () => {
  it("uses provider times only for material changes", () => {
    expect(
      getEffectiveSegmentTimes(
        segment,
        snapshot({
          estimatedDepartureAt: new Date("2026-10-22T11:40:00.000Z"),
          estimatedArrivalAt: new Date("2026-10-22T21:00:00.000Z"),
        }),
      ),
    ).toEqual({
      departureAt: segment.scheduledDepartureAt,
      arrivalAt: new Date("2026-10-22T21:00:00.000Z"),
      adjusted: true,
    });
  });

  it("never adjusts for cancellations or inconsistent provider times", () => {
    expect(getEffectiveSegmentTimes(segment, snapshot({ status: "cancelled" }))).toMatchObject({
      departureAt: segment.scheduledDepartureAt,
      adjusted: false,
    });
    expect(
      getEffectiveSegmentTimes(
        segment,
        snapshot({ estimatedDepartureAt: new Date("2026-10-22T22:00:00.000Z") }),
      ),
    ).toMatchObject({ departureAt: segment.scheduledDepartureAt, adjusted: false });
  });
});
