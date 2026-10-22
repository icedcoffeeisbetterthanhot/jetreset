import { createHash } from "node:crypto";
import {
  getRecoveryPlan,
  applyFlightStatusToRecoveryPlan,
  generateOrRefreshRecoveryPlan,
  listDashboardTrips,
  setRecoveryActivityCompleted,
} from "@server/recoveryService";
import { TripInputError } from "@server/tripService";
import { FlightStatusPlanConflictError } from "@server/flightStatusErrors";

const mocks = vi.hoisted(() => ({
  tripFindUnique: vi.fn(),
  tripFindMany: vi.fn(),
  planUpsert: vi.fn(),
  planUpdate: vi.fn(),
  activityDeleteMany: vi.fn(),
  activityCreateMany: vi.fn(),
  activityUpdateMany: vi.fn(),
  activityFindUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@server/db", () => ({
  prisma: {
    trip: { findUnique: mocks.tripFindUnique, findMany: mocks.tripFindMany },
    recoveryPlan: { upsert: mocks.planUpsert },
    recoveryActivity: {
      deleteMany: mocks.activityDeleteMany,
      createMany: mocks.activityCreateMany,
      updateMany: mocks.activityUpdateMany,
      findUnique: mocks.activityFindUnique,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@server/authService", () => ({
  getRequestIdentity: vi.fn().mockResolvedValue({ kind: "guest", guestId: "a".repeat(64) }),
}));

const updatedAt = new Date("2026-04-20T12:00:00.000Z");
const sourceItineraryHash = createHash("sha256").update(updatedAt.toISOString()).digest("hex");
const trip = {
  id: 5,
  name: "London to New York",
  departureAt: new Date("2026-05-01T10:00:00.000Z"),
  arrivalAt: new Date("2026-05-01T17:00:00.000Z"),
  originTimeZone: "Europe/London",
  destinationTimeZone: "America/New_York",
  updatedAt,
  flightSegments: [],
};

describe("recovery service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          recoveryPlan: { upsert: mocks.planUpsert, update: mocks.planUpdate },
          recoveryActivity: {
            deleteMany: mocks.activityDeleteMany,
            createMany: mocks.activityCreateMany,
          },
        }),
    );
  });

  it("persists generated activities transactionally while preserving completed records", async () => {
    const plan = {
      id: 8,
      tripId: 5,
      sourceTripUpdatedAt: updatedAt,
      sourceItineraryHash,
      destinationTimeZone: "America/New_York",
      journeyDurationMinutes: 420,
      direction: "west",
      timeZoneChangeMinutes: -300,
      estimatedTimeZonesCrossed: 5,
      recoveryDays: 5,
      targetBedtime: "22:00",
      targetWakeTime: "07:00",
      avoidCaffeine: false,
      preparationDaysAvailable: 0,
      assumptions: ["General educational guidance."],
      generatedAt: updatedAt,
      updatedAt,
      activities: [],
    };
    mocks.tripFindUnique.mockResolvedValueOnce(trip).mockResolvedValueOnce({
      ...trip,
      recoveryPlans: [plan],
    });
    mocks.planUpsert.mockResolvedValue({ id: 8 });
    mocks.activityDeleteMany.mockResolvedValue({ count: 0 });
    mocks.activityCreateMany.mockResolvedValue({ count: 55 });

    const result = await generateOrRefreshRecoveryPlan(5, {
      targetBedtime: "22:00",
      targetWakeTime: "07:00",
      avoidCaffeine: false,
    });

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.tripFindUnique).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 5, userId: null, guestId: "a".repeat(64) },
      }),
    );
    expect(mocks.planUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tripId_leg: { tripId: 5, leg: "outbound" } },
        create: expect.objectContaining({ leg: "outbound" }),
      }),
    );
    expect(mocks.activityDeleteMany).toHaveBeenCalledWith({
      where: { planId: 8, completedAt: null },
    });
    expect(mocks.activityCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            planId: 8,
            type: "light",
            timeZone: "America/New_York",
          }),
        ]),
      }),
    );
    expect(result.plan).toEqual(plan);
    expect(result.isOutOfDate).toBe(false);
  });

  it("rejects invalid preferences before reading or changing the trip", async () => {
    await expect(
      generateOrRefreshRecoveryPlan(5, { targetBedtime: "02:00" }),
    ).rejects.toBeInstanceOf(TripInputError);
    expect(mocks.tripFindUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("marks a plan stale when its source flight itinerary changes", async () => {
    const changedTrip = {
      ...trip,
      flightSegments: [
        { id: 27, leg: "outbound", updatedAt: new Date("2026-04-21T12:00:00.000Z") },
      ],
      recoveryPlans: [{ sourceItineraryHash, activities: [] }],
    };
    mocks.tripFindUnique.mockResolvedValue(changedTrip);

    await expect(getRecoveryPlan(5)).resolves.toEqual({
      leg: "outbound",
      plan: changedTrip.recoveryPlans[0],
      hasLegFlights: true,
      isOutOfDate: true,
      flightStatusChangePending: false,
      flightStatusAlerts: [],
    });
  });

  it("marks a plan stale after a previously included flight is removed", async () => {
    const previousFlightHash = createHash("sha256")
      .update(`${updatedAt.toISOString()}|27:${new Date("2026-04-21T12:00:00.000Z").toISOString()}`)
      .digest("hex");
    const changedTrip = {
      ...trip,
      recoveryPlans: [{ sourceItineraryHash: previousFlightHash, activities: [] }],
    };
    mocks.tripFindUnique.mockResolvedValue(changedTrip);

    await expect(getRecoveryPlan(5)).resolves.toEqual({
      leg: "outbound",
      plan: changedTrip.recoveryPlans[0],
      hasLegFlights: false,
      isOutOfDate: true,
      flightStatusChangePending: false,
      flightStatusAlerts: [],
    });
  });

  it("scopes activity completion updates to the parent trip", async () => {
    mocks.activityUpdateMany.mockResolvedValue({ count: 1 });
    mocks.activityFindUnique.mockResolvedValue({ id: 11, completedAt: updatedAt });

    await setRecoveryActivityCompleted(5, 11, true);

    expect(mocks.activityUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 11,
        plan: {
          tripId: 5,
          trip: { userId: null, guestId: "a".repeat(64) },
        },
      },
      data: { completedAt: expect.any(Date) },
    });
  });

  it("rejects an activity that does not belong to the requested trip", async () => {
    mocks.activityUpdateMany.mockResolvedValue({ count: 0 });

    await expect(setRecoveryActivityCompleted(5, 99, true)).rejects.toThrow(
      "Recovery activity not found.",
    );
    expect(mocks.activityFindUnique).not.toHaveBeenCalled();
  });

  it("lists dashboard trips with plan presence and the last scheduled activity", async () => {
    const planEndsAt = new Date("2026-05-04T02:00:00.000Z");
    mocks.tripFindMany.mockResolvedValue([
      {
        ...trip,
        recoveryPlans: [
          {
            leg: "outbound",
            routeDepartureAt: null,
            activities: [{ scheduledAt: new Date("2026-05-03T02:00:00.000Z") }],
          },
          {
            leg: "return",
            routeDepartureAt: new Date("2026-05-09T22:00:00.000Z"),
            activities: [{ scheduledAt: planEndsAt }],
          },
        ],
      },
      { ...trip, id: 6, recoveryPlans: [] },
    ]);

    const trips = await listDashboardTrips();

    expect(mocks.tripFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: null, guestId: "a".repeat(64) },
        select: expect.objectContaining({
          recoveryPlans: {
            select: {
              leg: true,
              routeDepartureAt: true,
              activities: {
                select: { scheduledAt: true },
                orderBy: { scheduledAt: "desc" },
                take: 1,
              },
            },
          },
        }),
      }),
    );
    expect(trips[0]).toMatchObject({
      id: 5,
      hasPlan: true,
      planLegs: ["outbound", "return"],
      returnDepartureAt: new Date("2026-05-09T22:00:00.000Z"),
      planEndsAt,
    });
    expect(trips[0]).not.toHaveProperty("recoveryPlans");
    expect(trips[1]).toMatchObject({ id: 6, hasPlan: false, planLegs: [], planEndsAt: null });
  });
});

describe("applyFlightStatusToRecoveryPlan", () => {
  const segmentUpdatedAt = new Date("2026-04-21T08:00:00.000Z");
  const segmentHash = createHash("sha256")
    .update([updatedAt.toISOString(), `3:${segmentUpdatedAt.toISOString()}`].join("|"))
    .digest("hex");
  const now = new Date("2026-05-01T12:00:00.000Z");
  const flightSegment = {
    id: 3,
    leg: "outbound" as const,
    flightNumber: "BA117",
    departureAirportCode: "LHR",
    arrivalAirportCode: "JFK",
    departureTimeZone: "Europe/London",
    arrivalTimeZone: "America/New_York",
    scheduledDepartureAt: new Date("2026-05-01T10:00:00.000Z"),
    scheduledArrivalAt: new Date("2026-05-01T17:00:00.000Z"),
    updatedAt: segmentUpdatedAt,
  };
  const delayedSnapshot = {
    sourceSegmentUpdatedAt: segmentUpdatedAt,
    lookupResult: "found" as const,
    status: "departed" as const,
    provider: "aviationstack",
    providerScheduledDepartureAt: new Date("2026-05-01T10:00:00.000Z"),
    estimatedDepartureAt: null,
    actualDepartureAt: new Date("2026-05-01T11:30:00.000Z"),
    providerScheduledArrivalAt: new Date("2026-05-01T17:00:00.000Z"),
    estimatedArrivalAt: new Date("2026-05-01T18:30:00.000Z"),
    actualArrivalAt: null,
    providerUpdatedAt: now,
    fetchedAt: now,
  };
  const plan = {
    id: 8,
    tripId: 5,
    sourceTripUpdatedAt: updatedAt,
    sourceItineraryHash: segmentHash,
    flightStatusSignature: null,
    targetBedtime: "22:00",
    targetWakeTime: "07:00",
    avoidCaffeine: false,
    generatedAt: new Date("2026-04-25T12:00:00.000Z"),
    updatedAt,
  };

  function tripWith(snapshot: unknown, recoveryPlan: unknown = plan) {
    return {
      ...trip,
      recoveryPlans: recoveryPlan ? [recoveryPlan] : [],
      flightSegments: [{ ...flightSegment, statusSnapshot: snapshot }],
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          recoveryPlan: { update: mocks.planUpdate },
          recoveryActivity: {
            deleteMany: mocks.activityDeleteMany,
            createMany: mocks.activityCreateMany,
          },
        }),
    );
  });

  it("recalculates only future uncompleted guidance and explains the change", async () => {
    mocks.tripFindUnique.mockResolvedValueOnce(tripWith(delayedSnapshot)).mockResolvedValueOnce({
      ...tripWith(delayedSnapshot),
      recoveryPlans: [{ ...plan, activities: [] }],
    });

    await applyFlightStatusToRecoveryPlan(5, "outbound", now);

    expect(mocks.tripFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5, userId: null, guestId: "a".repeat(64) },
      }),
    );
    const update = mocks.planUpdate.mock.calls[0][0];
    expect(update.where).toEqual({ id: 8 });
    expect(update.data).toMatchObject({
      sourceItineraryHash: segmentHash,
      routeArrivalAt: new Date("2026-05-01T18:30:00.000Z"),
      flightStatusSignature: expect.stringMatching(/^[0-9a-f]{64}$/),
      adjustedAt: now,
    });
    expect(update.data.adjustmentNote).toContain("earlier and completed activities were kept");
    expect(update.data.adjustmentNote).toContain("Arrival 1 h 30 min later than planned");

    const deleteWhere = mocks.activityDeleteMany.mock.calls[0][0].where;
    expect(deleteWhere).toMatchObject({ planId: 8, completedAt: null, scheduledAt: { gte: now } });
    // The 14:00 New York caffeine guidance now falls before the delayed arrival and is removed.
    expect(deleteWhere.activityKey.notIn).not.toContain("1-caffeine-2026-05-01T1400");
    expect(deleteWhere.activityKey.notIn).toContain("1-sleep-2026-05-01T2200");

    const created = mocks.activityCreateMany.mock.calls[0][0];
    expect(created.skipDuplicates).toBe(true);
    expect(
      created.data.every((activity: { scheduledAt: Date }) => activity.scheduledAt >= now),
    ).toBe(true);
  });

  it("does not adjust the plan for a cancelled flight", async () => {
    mocks.tripFindUnique.mockResolvedValue(tripWith({ ...delayedSnapshot, status: "cancelled" }));

    await expect(applyFlightStatusToRecoveryPlan(5, "outbound", now)).rejects.toThrow(
      /Cancelled by the operator.*Update the itinerary/,
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires regeneration when the itinerary changed after the plan was made", async () => {
    mocks.tripFindUnique.mockResolvedValue(
      tripWith(delayedSnapshot, { ...plan, sourceItineraryHash: "stale" }),
    );

    await expect(applyFlightStatusToRecoveryPlan(5, "outbound", now)).rejects.toBeInstanceOf(
      FlightStatusPlanConflictError,
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("leaves the plan untouched when it already reflects the current status", async () => {
    mocks.tripFindUnique.mockResolvedValue(tripWith(null));

    await applyFlightStatusToRecoveryPlan(5, "outbound", now);

    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("recovery plans per journey leg", () => {
  const outboundFlight = {
    id: 3,
    leg: "outbound" as const,
    flightNumber: "BA117",
    departureAirportCode: "LHR",
    arrivalAirportCode: "JFK",
    departureTimeZone: "Europe/London",
    arrivalTimeZone: "America/New_York",
    scheduledDepartureAt: new Date("2026-05-01T10:00:00.000Z"),
    scheduledArrivalAt: new Date("2026-05-01T17:00:00.000Z"),
    updatedAt,
    statusSnapshot: null,
  };
  const returnFlight = {
    ...outboundFlight,
    id: 4,
    leg: "return" as const,
    flightNumber: "BA178",
    departureAirportCode: "JFK",
    arrivalAirportCode: "LHR",
    departureTimeZone: "America/New_York",
    arrivalTimeZone: "Europe/London",
    scheduledDepartureAt: new Date("2026-05-08T22:00:00.000Z"),
    scheduledArrivalAt: new Date("2026-05-09T05:00:00.000Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.planUpsert.mockResolvedValue({ id: 9 });
    mocks.transaction.mockImplementation(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          recoveryPlan: { upsert: mocks.planUpsert },
          recoveryActivity: {
            deleteMany: mocks.activityDeleteMany,
            createMany: mocks.activityCreateMany,
          },
        }),
    );
  });

  it("builds the back-home plan from return flights only, in home time", async () => {
    const tripWithFlights = { ...trip, flightSegments: [outboundFlight, returnFlight] };
    mocks.tripFindUnique
      .mockResolvedValueOnce(tripWithFlights)
      .mockResolvedValueOnce({ ...tripWithFlights, recoveryPlans: [] });

    await generateOrRefreshRecoveryPlan(5, { leg: "return" });

    const upsert = mocks.planUpsert.mock.calls[0][0];
    expect(upsert.where).toEqual({ tripId_leg: { tripId: 5, leg: "return" } });
    expect(upsert.create).toMatchObject({
      leg: "return",
      destinationTimeZone: "Europe/London",
      direction: "east",
      routeDepartureAt: returnFlight.scheduledDepartureAt,
      routeArrivalAt: returnFlight.scheduledArrivalAt,
      sourceItineraryHash: createHash("sha256")
        .update([updatedAt.toISOString(), `4:${updatedAt.toISOString()}`].join("|"))
        .digest("hex"),
    });
    const activities = mocks.activityCreateMany.mock.calls[0][0].data;
    expect(
      activities.every((activity: { timeZone: string }) => activity.timeZone === "Europe/London"),
    ).toBe(true);
  });

  it("ignores return flights when building the arrival plan", async () => {
    const tripWithFlights = { ...trip, flightSegments: [outboundFlight, returnFlight] };
    mocks.tripFindUnique
      .mockResolvedValueOnce(tripWithFlights)
      .mockResolvedValueOnce({ ...tripWithFlights, recoveryPlans: [] });

    await generateOrRefreshRecoveryPlan(5, {});

    expect(mocks.planUpsert.mock.calls[0][0].create).toMatchObject({
      leg: "outbound",
      destinationTimeZone: "America/New_York",
      direction: "west",
      routeArrivalAt: outboundFlight.scheduledArrivalAt,
    });
  });

  it("requires return flights for a back-home plan", async () => {
    mocks.tripFindUnique.mockResolvedValueOnce({ ...trip, flightSegments: [outboundFlight] });

    await expect(generateOrRefreshRecoveryPlan(5, { leg: "return" })).rejects.toThrow(
      "Add your return flights before creating a back-home recovery plan.",
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an unknown leg", async () => {
    await expect(generateOrRefreshRecoveryPlan(5, { leg: "sideways" })).rejects.toBeInstanceOf(
      TripInputError,
    );
  });
});
