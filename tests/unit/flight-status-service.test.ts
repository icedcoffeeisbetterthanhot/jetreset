import {
  PROVIDER_CALLS_PER_HOUR,
  refreshTripFlightStatuses,
  resetProviderCallBudget,
  summarizeFlightStatus,
  type SegmentWithSnapshot,
} from "@server/flightStatusService";
import {
  FlightStatusProviderError,
  type FlightStatusProvider,
} from "@server/flightStatus/provider";
import { FlightStatusNotConfiguredError } from "@server/flightStatusErrors";

const mocks = vi.hoisted(() => ({
  tripFindUnique: vi.fn(),
  snapshotUpsert: vi.fn(),
}));

vi.mock("@server/db", () => ({
  prisma: {
    trip: { findUnique: mocks.tripFindUnique },
    flightStatusSnapshot: { upsert: mocks.snapshotUpsert },
  },
}));

const now = new Date("2026-10-22T08:00:00.000Z");
const updatedAt = new Date("2026-10-01T09:00:00.000Z");

function segment(overrides: Partial<SegmentWithSnapshot> = {}): SegmentWithSnapshot {
  return {
    id: 7,
    flightNumber: "BA 117",
    departureAirportCode: "LHR",
    arrivalAirportCode: "JFK",
    departureTimeZone: "Europe/London",
    arrivalTimeZone: "America/New_York",
    scheduledDepartureAt: new Date("2026-10-22T11:30:00.000Z"),
    scheduledArrivalAt: new Date("2026-10-22T19:30:00.000Z"),
    updatedAt,
    statusSnapshot: null,
    ...overrides,
  };
}

const delayedFlight = {
  status: "delayed" as const,
  providerScheduledDepartureAt: new Date("2026-10-22T11:30:00.000Z"),
  estimatedDepartureAt: new Date("2026-10-22T13:05:00.000Z"),
  actualDepartureAt: null,
  providerScheduledArrivalAt: new Date("2026-10-22T19:30:00.000Z"),
  estimatedArrivalAt: new Date("2026-10-22T20:50:00.000Z"),
  actualArrivalAt: null,
  providerUpdatedAt: new Date("2026-10-22T07:55:00.000Z"),
};

function storedSnapshot(fetchedAt: Date): NonNullable<SegmentWithSnapshot["statusSnapshot"]> {
  return {
    ...delayedFlight,
    sourceSegmentUpdatedAt: updatedAt,
    lookupResult: "found",
    provider: "aviationstack",
    fetchedAt,
  };
}

function mockProvider(
  lookup: FlightStatusProvider["lookup"] = vi
    .fn()
    .mockResolvedValue({ result: "found", flight: delayedFlight }),
) {
  return { name: "aviationstack", lookup: vi.fn(lookup) };
}

function tripWith(segments: SegmentWithSnapshot[], flightStatusSignature: string | null = null) {
  return { id: 5, flightSegments: segments, recoveryPlan: { flightStatusSignature } };
}

describe("flight status service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetProviderCallBudget();
    mocks.snapshotUpsert.mockImplementation(async ({ create }) => ({
      ...create,
      segment: undefined,
    }));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("refuses to refresh when no provider is configured", async () => {
    await expect(refreshTripFlightStatuses(5, { provider: null, now })).rejects.toBeInstanceOf(
      FlightStatusNotConfiguredError,
    );
    expect(mocks.tripFindUnique).not.toHaveBeenCalled();
  });

  it("looks up eligible segments by local departure date and stores the verified status", async () => {
    mocks.tripFindUnique.mockResolvedValue(tripWith([segment()]));
    const provider = mockProvider();

    const view = await refreshTripFlightStatuses(5, { provider, now });

    expect(provider.lookup).toHaveBeenCalledWith({
      flightNumber: "BA117",
      departureDateLocal: "2026-10-22",
      departureAirportCode: "LHR",
      arrivalAirportCode: "JFK",
      scheduledDepartureAt: new Date("2026-10-22T11:30:00.000Z"),
      scheduledArrivalAt: new Date("2026-10-22T19:30:00.000Z"),
      departureTimeZone: "Europe/London",
      arrivalTimeZone: "America/New_York",
    });
    expect(mocks.snapshotUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { segmentId: 7 },
        update: expect.objectContaining({
          lookupResult: "found",
          status: "delayed",
          sourceSegmentUpdatedAt: updatedAt,
          fetchedAt: now,
          provider: "aviationstack",
        }),
      }),
    );
    expect(view.segments[0].changes).toEqual([
      "Departure 1 h 35 min later than planned (estimated Thu 22 Oct, 14:05)",
      "Arrival 1 h 20 min later than planned (estimated Thu 22 Oct, 16:50)",
    ]);
    expect(view.recoveryPlanUpdatePending).toBe(true);
  });

  it("reuses a recent status instead of calling the provider", async () => {
    mocks.tripFindUnique.mockResolvedValue(
      tripWith([segment({ statusSnapshot: storedSnapshot(new Date("2026-10-22T07:55:00.000Z")) })]),
    );
    const provider = mockProvider();

    await refreshTripFlightStatuses(5, { provider, now });

    expect(provider.lookup).not.toHaveBeenCalled();
  });

  it("refreshes a cached status once the segment has been edited", async () => {
    mocks.tripFindUnique.mockResolvedValue(
      tripWith([
        segment({
          updatedAt: new Date("2026-10-22T07:58:00.000Z"),
          statusSnapshot: storedSnapshot(new Date("2026-10-22T07:55:00.000Z")),
        }),
      ]),
    );
    const provider = mockProvider();

    await refreshTripFlightStatuses(5, { provider, now });

    expect(provider.lookup).toHaveBeenCalledTimes(1);
  });

  it("skips segments outside the check window or without a flight number", async () => {
    mocks.tripFindUnique.mockResolvedValue(
      tripWith([
        segment({ id: 1, flightNumber: null }),
        segment({
          id: 2,
          scheduledDepartureAt: new Date("2026-11-22T11:30:00.000Z"),
          scheduledArrivalAt: new Date("2026-11-22T19:30:00.000Z"),
        }),
      ]),
    );
    const provider = mockProvider();

    const view = await refreshTripFlightStatuses(5, { provider, now });

    expect(provider.lookup).not.toHaveBeenCalled();
    expect(view.segments.map((item) => item.eligibility)).toEqual([
      { eligible: false, reason: "no_flight_number" },
      { eligible: false, reason: "too_early" },
    ]);
  });

  it("records provider errors per segment and stops after a credential failure", async () => {
    mocks.tripFindUnique.mockResolvedValue(
      tripWith([segment({ id: 1 }), segment({ id: 2, flightNumber: "BA 118" })]),
    );
    const provider = mockProvider(
      vi
        .fn()
        .mockRejectedValue(
          new FlightStatusProviderError("unauthorized", "The provider rejected the credentials."),
        ),
    );

    const view = await refreshTripFlightStatuses(5, { provider, now });

    expect(provider.lookup).toHaveBeenCalledTimes(1);
    expect(view.segments.map((item) => item.error)).toEqual([
      "The provider rejected the credentials.",
      "The provider rejected the credentials.",
    ]);
    expect(mocks.snapshotUpsert).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      JSON.stringify({ event: "flight_status_lookup_failed", segmentId: 1, kind: "unauthorized" }),
    );
  });

  it("stores not-found lookups without inventing times", async () => {
    mocks.tripFindUnique.mockResolvedValue(tripWith([segment()]));

    const view = await refreshTripFlightStatuses(5, {
      provider: mockProvider(vi.fn().mockResolvedValue({ result: "not_found" })),
      now,
    });

    expect(mocks.snapshotUpsert.mock.calls[0][0].update).toMatchObject({
      lookupResult: "not_found",
      status: "unknown",
      estimatedDepartureAt: null,
      actualArrivalAt: null,
    });
    expect(view.segments[0].changes).toEqual([]);
    expect(view.recoveryPlanUpdatePending).toBe(false);
  });

  it("caps provider calls per hour", async () => {
    const segments = Array.from({ length: PROVIDER_CALLS_PER_HOUR + 1 }, (_, index) =>
      segment({ id: index + 1 }),
    );
    mocks.tripFindUnique.mockResolvedValue(tripWith(segments));
    const provider = mockProvider();

    const view = await refreshTripFlightStatuses(5, { provider, now });

    expect(provider.lookup).toHaveBeenCalledTimes(PROVIDER_CALLS_PER_HOUR);
    expect(view.segments[PROVIDER_CALLS_PER_HOUR].error).toBe(
      "Status check limit reached. Try again later.",
    );
  });
});

describe("summarizeFlightStatus", () => {
  it("uses saved times and no signature when flights are on schedule", () => {
    const summary = summarizeFlightStatus([segment()]);

    expect(summary.signature).toBeNull();
    expect(summary.effectiveFlights[0].arrivalAt).toEqual(new Date("2026-10-22T19:30:00.000Z"));
  });

  it("separates applicable adjustments from blocking alerts", () => {
    const delayed = summarizeFlightStatus([segment({ statusSnapshot: storedSnapshot(now) })]);
    const cancelled = summarizeFlightStatus([
      segment({ statusSnapshot: { ...storedSnapshot(now), status: "cancelled" } }),
    ]);

    expect(delayed.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(delayed.effectiveFlights[0].arrivalAt).toEqual(new Date("2026-10-22T20:50:00.000Z"));
    expect(delayed.adjustments).toHaveLength(2);
    expect(cancelled.signature).toBeNull();
    expect(cancelled.blockingAlerts).toEqual(["BA 117 LHR→JFK: Cancelled by the operator"]);
  });
});
