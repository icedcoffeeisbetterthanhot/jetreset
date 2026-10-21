import { createHash } from "node:crypto";
import {
  getRecoveryPlan,
  generateOrRefreshRecoveryPlan,
  setRecoveryActivityCompleted,
} from "@server/recoveryService";
import { TripInputError } from "@server/tripService";

const mocks = vi.hoisted(() => ({
  tripFindUnique: vi.fn(),
  planUpsert: vi.fn(),
  activityDeleteMany: vi.fn(),
  activityCreateMany: vi.fn(),
  activityUpdateMany: vi.fn(),
  activityFindUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@server/db", () => ({
  prisma: {
    trip: { findUnique: mocks.tripFindUnique },
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
          recoveryPlan: { upsert: mocks.planUpsert },
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
      recoveryPlan: plan,
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
    expect(mocks.planUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tripId: 5 } }),
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
      flightSegments: [{ id: 27, updatedAt: new Date("2026-04-21T12:00:00.000Z") }],
      recoveryPlan: {
        sourceItineraryHash,
        activities: [],
      },
    };
    mocks.tripFindUnique.mockResolvedValue(changedTrip);

    await expect(getRecoveryPlan(5)).resolves.toEqual({
      plan: changedTrip.recoveryPlan,
      isOutOfDate: true,
    });
  });

  it("marks a plan stale after a previously included flight is removed", async () => {
    const previousFlightHash = createHash("sha256")
      .update(`${updatedAt.toISOString()}|27:${new Date("2026-04-21T12:00:00.000Z").toISOString()}`)
      .digest("hex");
    const changedTrip = {
      ...trip,
      recoveryPlan: {
        sourceItineraryHash: previousFlightHash,
        activities: [],
      },
    };
    mocks.tripFindUnique.mockResolvedValue(changedTrip);

    await expect(getRecoveryPlan(5)).resolves.toEqual({
      plan: changedTrip.recoveryPlan,
      isOutOfDate: true,
    });
  });

  it("scopes activity completion updates to the parent trip", async () => {
    mocks.activityUpdateMany.mockResolvedValue({ count: 1 });
    mocks.activityFindUnique.mockResolvedValue({ id: 11, completedAt: updatedAt });

    await setRecoveryActivityCompleted(5, 11, true);

    expect(mocks.activityUpdateMany).toHaveBeenCalledWith({
      where: { id: 11, plan: { tripId: 5 } },
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
});
