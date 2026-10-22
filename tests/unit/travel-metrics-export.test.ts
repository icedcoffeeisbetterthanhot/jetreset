import { NextRequest } from "next/server";
import type { TravelMetricsReport } from "@lib/travelMetrics";
import { GET } from "../../src/app/api/travel-metrics/export/route";

const mocks = vi.hoisted(() => ({
  getTravelMetrics: vi.fn(),
}));

vi.mock("@server/travelMetricsService", () => ({
  getTravelMetrics: mocks.getTravelMetrics,
}));

const report: TravelMetricsReport = {
  period: "month",
  periodLabel: "October 2026",
  start: new Date("2026-10-01T00:00:00.000Z"),
  endExclusive: new Date("2026-11-01T00:00:00.000Z"),
  generatedAt: new Date("2026-10-22T12:00:00.000Z"),
  totals: {
    distanceKm: 5570,
    distanceFlights: 1,
    distanceMissingFlights: 0,
    airTimeMinutes: 245,
    flights: 1,
    verifiedFlights: 1,
    estimatedFlights: 0,
    airportTimeMinutes: 0,
    completedTrips: 1,
  },
  months: [
    {
      key: "2026-10",
      label: "Oct",
      flights: 1,
      distanceKm: 5570,
      distanceFlights: 1,
      distanceMissingFlights: 0,
      airTimeMinutes: 245,
    },
  ],
  flights: [
    {
      tripId: 1,
      tripName: '=HYPERLINK("https://example.invalid","trip")',
      leg: "outbound",
      departureAirportCode: "LHR",
      departureAirportName: "Heathrow Airport",
      departureAirportCity: "London",
      departureCountryCode: "GB",
      arrivalAirportCode: "JFK",
      arrivalAirportName: "John F. Kennedy International Airport",
      arrivalAirportCity: "New York",
      arrivalCountryCode: "US",
      departureAt: "2026-10-01T08:00:00.000Z",
      arrivalAt: "2026-10-01T12:05:00.000Z",
      timeBasis: "actual",
      airTimeMinutes: 245,
      distanceKm: 5570,
    },
  ],
  airports: [],
};

describe("travel metrics CSV export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTravelMetrics.mockResolvedValue(report);
  });

  it("returns a private downloadable report and neutralizes spreadsheet formulas", async () => {
    const response = await GET(
      new NextRequest("https://jetreset.example/api/travel-metrics/export?period=month"),
    );
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(csv).toContain(`"'=HYPERLINK(""https://example.invalid"",""trip"")"`);
    expect(mocks.getTravelMetrics).toHaveBeenCalledWith("month");
  });

  it("rejects unsupported reporting periods", async () => {
    const response = await GET(
      new NextRequest("https://jetreset.example/api/travel-metrics/export?period=all-time"),
    );

    expect(response.status).toBe(400);
    expect(mocks.getTravelMetrics).not.toHaveBeenCalled();
  });
});
