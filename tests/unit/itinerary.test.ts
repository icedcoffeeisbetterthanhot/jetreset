import { calculateItinerary, getTimeZoneChangeMinutes } from "@lib/itinerary";

const flight = (
  id: number,
  departureAirportCode: string,
  departureTimeZone: string,
  scheduledDepartureAt: string,
  arrivalAirportCode: string,
  arrivalTimeZone: string,
  scheduledArrivalAt: string,
) => ({
  id,
  departureAirportCode,
  departureTimeZone,
  scheduledDepartureAt,
  arrivalAirportCode,
  arrivalTimeZone,
  scheduledArrivalAt,
});

describe("itinerary calculations", () => {
  it("sorts flight segments and calculates flight, elapsed, and layover time", () => {
    const summary = calculateItinerary([
      flight(
        2,
        "CDG",
        "Europe/Paris",
        "2026-06-01T12:30:00.000Z",
        "FRA",
        "Europe/Berlin",
        "2026-06-01T14:00:00.000Z",
      ),
      flight(
        1,
        "LHR",
        "Europe/London",
        "2026-06-01T09:00:00.000Z",
        "CDG",
        "Europe/Paris",
        "2026-06-01T11:00:00.000Z",
      ),
    ]);

    expect(summary.segments.map((segment) => segment.id)).toEqual([1, 2]);
    expect(summary.flightMinutes).toBe(210);
    expect(summary.elapsedMinutes).toBe(300);
    expect(summary.layoverMinutes).toBe(90);
    expect(summary.warnings).toEqual([]);
  });

  it("flags airport mismatches and overlapping connections", () => {
    const summary = calculateItinerary([
      flight(
        1,
        "LHR",
        "Europe/London",
        "2026-06-01T09:00:00.000Z",
        "CDG",
        "Europe/Paris",
        "2026-06-01T12:00:00.000Z",
      ),
      flight(
        2,
        "FRA",
        "Europe/Berlin",
        "2026-06-01T11:00:00.000Z",
        "JFK",
        "America/New_York",
        "2026-06-01T17:00:00.000Z",
      ),
    ]);

    expect(summary.warnings).toHaveLength(2);
    expect(summary.warnings.join(" ")).toContain("overlap");
    expect(summary.warnings.join(" ")).toContain("Connection mismatch");
  });

  it("calculates airport offset changes using the offsets on the flight dates", () => {
    const segment = flight(
      1,
      "LHR",
      "Europe/London",
      "2026-01-15T10:00:00.000Z",
      "JFK",
      "America/New_York",
      "2026-01-15T17:00:00.000Z",
    );

    expect(getTimeZoneChangeMinutes(segment)).toBe(-300);
  });
});
