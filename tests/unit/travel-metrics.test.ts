import {
  calculateTravelMetrics,
  type TravelMetricsSegment,
  type TravelMetricsTrip,
} from "@lib/travelMetrics";
import type { Airport } from "@server/airportService";

const now = new Date("2026-10-22T12:00:00.000Z");
const airports: Record<string, Airport> = {
  LHR: {
    code: "LHR",
    name: "Heathrow Airport",
    city: "London",
    countryCode: "GB",
    timeZone: "Europe/London",
    latitude: 51.47,
    longitude: -0.4543,
  },
  JFK: {
    code: "JFK",
    name: "John F. Kennedy International Airport",
    city: "New York",
    countryCode: "US",
    timeZone: "America/New_York",
    latitude: 40.6413,
    longitude: -73.7781,
  },
};

function segment(
  id: number,
  tripId: number,
  departureAirportCode: "LHR" | "JFK",
  arrivalAirportCode: "LHR" | "JFK",
  scheduledDepartureAt: string,
  scheduledArrivalAt: string,
  actualTimes?: { departure: string; arrival: string },
): TravelMetricsSegment {
  const updatedAt = new Date("2026-10-01T00:00:00.000Z");
  return {
    id,
    tripId,
    leg: "outbound",
    departureAirportCode,
    departureAirportName: airports[departureAirportCode].name,
    departureAirportCity: airports[departureAirportCode].city,
    departureCountryCode: airports[departureAirportCode].countryCode,
    arrivalAirportCode,
    arrivalAirportName: airports[arrivalAirportCode].name,
    arrivalAirportCity: airports[arrivalAirportCode].city,
    arrivalCountryCode: airports[arrivalAirportCode].countryCode,
    scheduledDepartureAt: new Date(scheduledDepartureAt),
    scheduledArrivalAt: new Date(scheduledArrivalAt),
    updatedAt,
    statusSnapshot: actualTimes
      ? {
          sourceSegmentUpdatedAt: updatedAt,
          status: "arrived",
          actualDepartureAt: new Date(actualTimes.departure),
          actualArrivalAt: new Date(actualTimes.arrival),
        }
      : null,
  };
}

function trip(id: number, flightSegments: TravelMetricsSegment[]): TravelMetricsTrip {
  return { id, name: `Trip ${id}`, flightSegments };
}

function calculate(trips: TravelMetricsTrip[], period: "month" | "six-months" | "year" = "month") {
  return calculateTravelMetrics(trips, period, now, (code) => airports[code] ?? null);
}

describe("travel metrics", () => {
  it("uses the current UTC month, trailing six months, and calendar year", () => {
    const monthly = calculate([], "month");
    const sixMonths = calculate([], "six-months");
    const yearly = calculate([], "year");

    expect(monthly.months.map((month) => month.key)).toEqual(["2026-10"]);
    expect(sixMonths.months.map((month) => month.key)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(yearly.months).toHaveLength(12);
    expect(yearly.months[0].key).toBe("2026-01");
    expect(yearly.months[11].key).toBe("2026-12");
    expect(yearly.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");

    const januarySixMonths = calculateTravelMetrics(
      [],
      "six-months",
      new Date("2026-01-22T12:00:00.000Z"),
      (code) => airports[code] ?? null,
    );
    expect(januarySixMonths.periodLabel).toBe("Aug 2025–Jan 2026");
    expect(januarySixMonths.months[0].key).toBe("2025-08");
  });

  it("uses completed persisted segments and distinguishes actual from scheduled estimates", () => {
    const scheduled = segment(
      1,
      1,
      "LHR",
      "JFK",
      "2026-10-01T08:00:00.000Z",
      "2026-10-01T12:00:00.000Z",
    );
    const actual = segment(
      2,
      2,
      "JFK",
      "LHR",
      "2026-10-02T08:00:00.000Z",
      "2026-10-02T12:00:00.000Z",
      { departure: "2026-10-02T08:05:00.000Z", arrival: "2026-10-02T12:10:00.000Z" },
    );
    const upcoming = segment(
      3,
      3,
      "LHR",
      "JFK",
      "2026-10-23T08:00:00.000Z",
      "2026-10-23T12:00:00.000Z",
    );

    const report = calculate([trip(1, [scheduled]), trip(2, [actual]), trip(3, [upcoming])]);

    expect(report.totals.flights).toBe(2);
    expect(report.totals.verifiedFlights).toBe(1);
    expect(report.totals.estimatedFlights).toBe(1);
    expect(report.totals.completedTrips).toBe(2);
    expect(report.flights.map((flight) => flight.timeBasis)).toEqual([
      "scheduled estimate",
      "actual",
    ]);
    expect(report.totals.distanceKm).toBeGreaterThan(11_000);
    expect(report.totals.distanceKm).toBeLessThan(11_200);
  });

  it("deduplicates identical segment records and merges overlapping air-time intervals", () => {
    const first = segment(
      1,
      1,
      "LHR",
      "JFK",
      "2026-10-01T08:00:00.000Z",
      "2026-10-01T10:00:00.000Z",
    );
    const duplicate = { ...first, id: 2 };
    const overlapping = segment(
      3,
      1,
      "JFK",
      "LHR",
      "2026-10-01T09:30:00.000Z",
      "2026-10-01T11:30:00.000Z",
    );

    const report = calculate([trip(1, [first, duplicate, overlapping])]);

    expect(report.totals.flights).toBe(2);
    expect(report.totals.airTimeMinutes).toBe(210);
    expect(report.months[0].airTimeMinutes).toBe(210);
  });

  it("counts airport time only between adjacent provider-confirmed flights at the same airport", () => {
    const outbound = segment(
      1,
      1,
      "LHR",
      "JFK",
      "2026-10-01T08:00:00.000Z",
      "2026-10-01T12:00:00.000Z",
      { departure: "2026-10-01T08:05:00.000Z", arrival: "2026-10-01T12:10:00.000Z" },
    );
    const connection = segment(
      2,
      1,
      "JFK",
      "LHR",
      "2026-10-01T14:10:00.000Z",
      "2026-10-01T18:10:00.000Z",
      { departure: "2026-10-01T14:10:00.000Z", arrival: "2026-10-01T18:20:00.000Z" },
    );

    expect(calculate([trip(1, [outbound, connection])]).totals.airportTimeMinutes).toBe(120);
    expect(
      calculate([trip(1, [{ ...outbound, statusSnapshot: null }, connection])]).totals
        .airportTimeMinutes,
    ).toBe(0);
  });

  it("excludes cancelled, invalid, and out-of-period flights from the report", () => {
    const cancelled = segment(
      1,
      1,
      "LHR",
      "JFK",
      "2026-10-01T08:00:00.000Z",
      "2026-10-01T12:00:00.000Z",
    );
    cancelled.statusSnapshot = {
      sourceSegmentUpdatedAt: cancelled.updatedAt,
      status: "cancelled",
      actualDepartureAt: null,
      actualArrivalAt: null,
    };
    const previousMonth = segment(
      2,
      2,
      "LHR",
      "JFK",
      "2026-09-30T08:00:00.000Z",
      "2026-09-30T12:00:00.000Z",
    );

    const report = calculate([trip(1, [cancelled]), trip(2, [previousMonth])]);

    expect(report.flights).toEqual([]);
    expect(report.totals).toMatchObject({
      distanceKm: 0,
      airTimeMinutes: 0,
      flights: 0,
      completedTrips: 0,
    });
  });

  it("keeps flights with unknown coordinates in history without claiming a zero distance", () => {
    const flight = segment(
      1,
      1,
      "LHR",
      "JFK",
      "2026-10-01T08:00:00.000Z",
      "2026-10-01T12:00:00.000Z",
    );
    const report = calculateTravelMetrics([trip(1, [flight])], "month", now, () => null);

    expect(report.totals.flights).toBe(1);
    expect(report.totals.distanceFlights).toBe(0);
    expect(report.totals.distanceMissingFlights).toBe(1);
    expect(report.flights[0].distanceKm).toBeNull();
    expect(report.airports).toEqual([]);
  });

  it("ignores stale provider actual times and falls back to scheduled estimates", () => {
    const stale = segment(
      1,
      1,
      "LHR",
      "JFK",
      "2026-10-01T08:00:00.000Z",
      "2026-10-01T12:00:00.000Z",
      { departure: "2026-10-01T09:00:00.000Z", arrival: "2026-10-01T13:00:00.000Z" },
    );
    stale.updatedAt = new Date("2026-10-02T00:00:00.000Z");

    const report = calculate([trip(1, [stale])]);

    expect(report.flights[0].timeBasis).toBe("scheduled estimate");
    expect(report.flights[0].departureAt).toBe("2026-10-01T08:00:00.000Z");
    expect(report.totals.verifiedFlights).toBe(0);
  });
});
