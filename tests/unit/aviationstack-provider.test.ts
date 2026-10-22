import { createAviationstackProvider, parseProviderTime } from "@server/flightStatus/aviationstack";
import { FlightStatusProviderError } from "@server/flightStatus/provider";

const API_KEY = "0123456789abcdef0123456789abcdef";

// LHR is UTC+1 and JFK is UTC-4 on this date.
const request = {
  flightNumber: "BA117",
  departureDateLocal: "2026-10-22",
  departureAirportCode: "LHR",
  arrivalAirportCode: "JFK",
  scheduledDepartureAt: new Date("2026-10-22T11:30:00.000Z"),
  scheduledArrivalAt: new Date("2026-10-22T19:30:00.000Z"),
  departureTimeZone: "Europe/London",
  arrivalTimeZone: "America/New_York",
};

/** Shaped after the documented /v1/flights response. */
function flight(
  overrides: {
    flight_date?: string;
    flight_status?: string;
    departure?: Record<string, unknown>;
    arrival?: Record<string, unknown>;
  } = {},
) {
  return {
    flight_date: overrides.flight_date ?? "2026-10-22",
    flight_status: overrides.flight_status ?? "scheduled",
    departure: {
      airport: "Heathrow",
      timezone: "Europe/London",
      iata: "LHR",
      icao: "EGLL",
      delay: 95,
      scheduled: "2026-10-22T12:30:00+00:00",
      estimated: "2026-10-22T14:05:00+00:00",
      actual: null,
      estimated_runway: null,
      actual_runway: null,
      ...overrides.departure,
    },
    arrival: {
      airport: "John F Kennedy International",
      timezone: "America/New_York",
      iata: "JFK",
      icao: "KJFK",
      delay: null,
      scheduled: "2026-10-22T15:30:00+00:00",
      estimated: "2026-10-22T16:50:00+00:00",
      actual: null,
      ...overrides.arrival,
    },
    airline: { name: "British Airways", iata: "BA", icao: "BAW" },
    flight: { number: "117", iata: "BA117", icao: "BAW117", codeshared: null },
    aircraft: null,
    live: null,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function providerReturning(response: Response | Promise<never>) {
  const fetchImpl = vi.fn().mockReturnValue(Promise.resolve(response));
  return { provider: createAviationstackProvider({ apiKey: API_KEY, fetchImpl }), fetchImpl };
}

describe("Aviationstack provider", () => {
  it("requests the real-time flights endpoint over HTTPS with route filters", async () => {
    const { provider, fetchImpl } = providerReturning(jsonResponse(200, { data: [] }));

    await provider.lookup(request);

    const [url, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe("https://api.aviationstack.com/v1/flights");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      access_key: API_KEY,
      flight_iata: "BA117",
      dep_iata: "LHR",
      arr_iata: "JFK",
    });
    expect(init.redirect).toBe("error");
  });

  it("uses the ICAO parameter for three-letter airline designators", async () => {
    const { provider, fetchImpl } = providerReturning(jsonResponse(200, { data: [] }));

    await provider.lookup({ ...request, flightNumber: "BAW117" });

    const [url] = fetchImpl.mock.calls[0] as [URL];
    expect(url.searchParams.get("flight_icao")).toBe("BAW117");
    expect(url.searchParams.has("flight_iata")).toBe(false);
  });

  it("reads airport-local wall-clock times labelled +00:00 when they match the saved schedule", async () => {
    const { provider } = providerReturning(jsonResponse(200, { data: [flight()] }));

    expect(await provider.lookup(request)).toEqual({
      result: "found",
      flight: {
        status: "scheduled",
        providerScheduledDepartureAt: new Date("2026-10-22T11:30:00.000Z"),
        estimatedDepartureAt: new Date("2026-10-22T13:05:00.000Z"),
        actualDepartureAt: null,
        providerScheduledArrivalAt: new Date("2026-10-22T19:30:00.000Z"),
        estimatedArrivalAt: new Date("2026-10-22T20:50:00.000Z"),
        actualArrivalAt: null,
        providerUpdatedAt: null,
      },
    });
  });

  it("reads a schedule change equal to the airport's UTC offset as local time", async () => {
    // Moved one hour earlier: 11:30 London time, which is 10:30 UTC.
    const { provider } = providerReturning(
      jsonResponse(200, {
        data: [flight({ departure: { scheduled: "2026-10-22T11:30:00+00:00", estimated: null } })],
      }),
    );

    expect(await provider.lookup(request)).toMatchObject({
      flight: {
        providerScheduledDepartureAt: new Date("2026-10-22T10:30:00.000Z"),
        estimatedDepartureAt: null,
      },
    });
  });

  it("maps landed flights with actual times and picks the saved departure date", async () => {
    const previousDay = flight({
      flight_date: "2026-10-21",
      flight_status: "cancelled",
      departure: { scheduled: "2026-10-21T12:30:00+00:00", estimated: null },
    });
    const landed = flight({
      flight_status: "landed",
      departure: { actual: "2026-10-22T14:00:00+00:00" },
      arrival: { actual: "2026-10-22T16:45:00+00:00" },
    });
    const { provider } = providerReturning(jsonResponse(200, { data: [previousDay, landed] }));

    expect(await provider.lookup(request)).toMatchObject({
      flight: {
        status: "arrived",
        actualDepartureAt: new Date("2026-10-22T13:00:00.000Z"),
        actualArrivalAt: new Date("2026-10-22T20:45:00.000Z"),
      },
    });
  });

  it("reports no match for other routes, other dates, or flights without a schedule", async () => {
    const otherRoute = flight({ arrival: { iata: "LAX" } });
    const otherDate = flight({ departure: { scheduled: "2026-10-23T12:30:00+00:00" } });
    const noSchedule = flight({ departure: { scheduled: null } });
    const { provider } = providerReturning(
      jsonResponse(200, { data: [otherRoute, otherDate, noSchedule] }),
    );

    expect(await provider.lookup(request)).toEqual({ result: "not_found" });
  });

  it.each([
    [200, { error: { code: "usage_limit_reached", message: "limit" } }, "rate_limited", /monthly/],
    [401, { error: { code: "invalid_access_key", message: "bad" } }, "unauthorized", /credentials/],
    [403, { error: { code: "https_access_restricted" } }, "unauthorized", /not send the key/],
    [403, { error: { code: "function_access_restricted" } }, "rejected", /does not include/],
    [429, { error: { code: "rate_limit_reached" } }, "rate_limited", /rate limit/],
  ])("maps HTTP %i error bodies to typed errors", async (status, body, kind, message) => {
    const { provider } = providerReturning(jsonResponse(status, body));

    const error = await provider.lookup(request).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(FlightStatusProviderError);
    expect(error).toMatchObject({ kind });
    expect((error as Error).message).toMatch(message);
    expect((error as Error).message).not.toContain(API_KEY);
  });

  it("does not leak the key from network errors and rejects unexpected shapes", async () => {
    const offline = createAviationstackProvider({
      apiKey: API_KEY,
      fetchImpl: vi
        .fn()
        .mockRejectedValue(
          new TypeError(
            `fetch failed: https://api.aviationstack.com/v1/flights?access_key=${API_KEY}`,
          ),
        ),
    });
    const offlineError = await offline.lookup(request).catch((caught: unknown) => caught);
    expect(offlineError).toMatchObject({ kind: "unavailable" });
    expect((offlineError as Error).message).not.toContain(API_KEY);

    const { provider: invalid } = providerReturning(jsonResponse(200, { flights: [] }));
    await expect(invalid.lookup(request)).rejects.toMatchObject({ kind: "invalid_response" });

    const { provider: down } = providerReturning(new Response("<html>", { status: 503 }));
    await expect(down.lookup(request)).rejects.toMatchObject({ kind: "unavailable" });
  });
});

describe("parseProviderTime", () => {
  it("reads zero-offset timestamps as airport-local wall-clock time", () => {
    expect(parseProviderTime("2026-10-22T17:58:00+00:00", "Asia/Tokyo")).toEqual(
      new Date("2026-10-22T08:58:00.000Z"),
    );
    expect(parseProviderTime("2026-10-22T12:30:00Z", "Europe/London")).toEqual(
      new Date("2026-10-22T11:30:00.000Z"),
    );
  });

  it("trusts explicit non-zero offsets", () => {
    expect(parseProviderTime("2026-10-22T17:58:00+09:00", "Asia/Tokyo")).toEqual(
      new Date("2026-10-22T08:58:00.000Z"),
    );
  });

  it("rejects malformed values, unknown zones, and nonexistent local times", () => {
    expect(parseProviderTime("tomorrow", "Europe/London")).toBeNull();
    expect(parseProviderTime(null, "Europe/London")).toBeNull();
    expect(parseProviderTime("2026-10-22T12:30:00+00:00", "Not/AZone")).toBeNull();
    // 01:30 on 29 March 2026 does not exist in London (clocks go forward).
    expect(parseProviderTime("2026-03-29T01:30:00+00:00", "Europe/London")).toBeNull();
  });
});
