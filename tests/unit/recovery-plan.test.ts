import { generateRecoveryPlan } from "@lib/recoveryPlan";

const standardTrip = {
  departureAt: new Date("2026-05-01T10:00:00.000Z"),
  arrivalAt: new Date("2026-05-01T17:00:00.000Z"),
  originTimeZone: "Europe/London",
  destinationTimeZone: "America/New_York",
  referenceDate: new Date("2026-04-25T12:00:00.000Z"),
};

describe("recovery-plan engine", () => {
  it("deterministically builds destination-local guidance for a westbound trip", () => {
    const plan = generateRecoveryPlan(standardTrip);
    const repeatedPlan = generateRecoveryPlan(standardTrip);

    expect(plan.direction).toBe("west");
    expect(plan.timeZoneChangeMinutes).toBe(-300);
    expect(plan.estimatedTimeZonesCrossed).toBe(5);
    expect(plan.recoveryDays).toBe(5);
    expect(plan.preparationDaysAvailable).toBe(5);
    expect(plan.journeyDurationMinutes).toBe(420);
    expect(plan.activities).toEqual(repeatedPlan.activities);
    expect(plan.activities[0]).toMatchObject({
      dayNumber: 0,
      title: "Keep your usual sleep routine",
      timeZone: "Europe/London",
      scheduledAt: new Date("2026-04-30T20:00:00.000Z"),
    });
    expect(
      plan.activities.find((activity) => activity.title === "Target wake time")?.scheduledAt,
    ).toEqual(new Date("2026-05-02T11:00:00.000Z"));
    expect(plan.activities.some((activity) => activity.type === "light")).toBe(true);
    expect(plan.activities.some((activity) => activity.type === "hydration")).toBe(true);
    expect(plan.activities.some((activity) => activity.type === "exercise")).toBe(true);
    expect(plan.assumptions.join(" ")).toContain("not medical advice");
  });

  it("respects sleep preferences and avoids caffeine guidance when requested", () => {
    const plan = generateRecoveryPlan({
      ...standardTrip,
      preferences: {
        targetBedtime: "23:00",
        targetWakeTime: "08:00",
        avoidCaffeine: true,
      },
    });

    expect(plan.targetBedtime).toBe("23:00");
    expect(plan.targetWakeTime).toBe("08:00");
    expect(plan.avoidCaffeine).toBe(true);
    // New York is UTC-4 here: the caffeine-free window runs from 08:00 wake to 23:00 bedtime.
    expect(
      plan.activities.find((activity) => activity.title === "Caffeine-free day"),
    ).toMatchObject({
      type: "caffeine",
      scheduledAt: new Date("2026-05-02T12:00:00.000Z"),
      endsAt: new Date("2026-05-03T03:00:00.000Z"),
    });
    expect(
      plan.activities.find((activity) => activity.title === "Target bedtime")?.scheduledAt,
    ).toEqual(new Date("2026-05-02T03:00:00.000Z"));
  });

  it("gives every activity a start and a later end, with overnight sleep ending at the next wake", () => {
    const plan = generateRecoveryPlan(standardTrip);

    expect(
      plan.activities.every(
        (activity) => activity.endsAt.getTime() > activity.scheduledAt.getTime(),
      ),
    ).toBe(true);
    // Day 2 in New York (UTC-4): sleep 22:00 on 2 May until 07:00 on 3 May.
    expect(
      plan.activities.find(
        (activity) => activity.dayNumber === 2 && activity.title === "Target bedtime",
      ),
    ).toMatchObject({
      scheduledAt: new Date("2026-05-03T02:00:00.000Z"),
      endsAt: new Date("2026-05-03T11:00:00.000Z"),
    });
    expect(
      plan.activities.find(
        (activity) =>
          activity.dayNumber === 2 && activity.title === "Caffeine window, if you use it",
      ),
    ).toMatchObject({
      scheduledAt: new Date("2026-05-02T11:00:00.000Z"),
      endsAt: new Date("2026-05-02T18:00:00.000Z"),
    });
    expect(
      plan.activities.find((activity) => activity.dayNumber === 2 && activity.title === "Lunch"),
    ).toMatchObject({
      scheduledAt: new Date("2026-05-02T16:30:00.000Z"),
      endsAt: new Date("2026-05-02T17:15:00.000Z"),
    });
  });

  it("offers an optional short early-afternoon nap on the first two recovery days only", () => {
    const plan = generateRecoveryPlan(standardTrip);
    const naps = plan.activities.filter((activity) => activity.title === "Optional short nap");

    expect(naps.map((nap) => nap.dayNumber)).toEqual([1, 2]);
    expect(naps[0]).toMatchObject({
      type: "sleep",
      scheduledAt: new Date("2026-05-01T17:30:00.000Z"),
      endsAt: new Date("2026-05-01T18:00:00.000Z"),
    });
    expect(naps[0].guidance).toContain("20–30 minutes");
    expect(naps[0].guidance).toContain("Skip it if you feel fine");
  });

  it("ends the evening wind-down at an early bedtime", () => {
    const plan = generateRecoveryPlan({
      ...standardTrip,
      preferences: { targetBedtime: "19:00" },
    });
    const evening = plan.activities.find(
      (activity) => activity.dayNumber === 2 && activity.title === "Keep a calm, dimmer evening",
    );

    expect(evening).toMatchObject({
      scheduledAt: new Date("2026-05-02T22:00:00.000Z"),
      endsAt: new Date("2026-05-02T23:00:00.000Z"),
    });
  });

  it("uses chronologically ordered flight segments to calculate itinerary direction", () => {
    const plan = generateRecoveryPlan({
      ...standardTrip,
      flights: [
        {
          departureAt: new Date("2026-05-01T14:00:00.000Z"),
          arrivalAt: new Date("2026-05-01T17:00:00.000Z"),
          departureTimeZone: "Europe/Paris",
          arrivalTimeZone: "America/New_York",
        },
        {
          departureAt: new Date("2026-05-01T10:00:00.000Z"),
          arrivalAt: new Date("2026-05-01T12:00:00.000Z"),
          departureTimeZone: "Europe/London",
          arrivalTimeZone: "Europe/Paris",
        },
      ],
    });

    expect(plan.direction).toBe("west");
    expect(plan.destinationTimeZone).toBe("America/New_York");
  });

  it("does not schedule destination activities before a late-night arrival", () => {
    const plan = generateRecoveryPlan({
      ...standardTrip,
      arrivalAt: new Date("2026-05-02T03:00:00.000Z"),
    });

    expect(
      plan.activities
        .filter((activity) => activity.dayNumber === 1)
        .every(
          (activity) => activity.scheduledAt.getTime() >= Date.parse("2026-05-02T03:00:00.000Z"),
        ),
    ).toBe(true);
  });

  it("validates itinerary dates and user sleep-time preferences", () => {
    expect(() =>
      generateRecoveryPlan({
        ...standardTrip,
        arrivalAt: new Date("2026-05-01T09:00:00.000Z"),
      }),
    ).toThrow("valid trip departure");
    expect(() =>
      generateRecoveryPlan({
        ...standardTrip,
        preferences: { targetBedtime: "02:00" },
      }),
    ).toThrow("Target bedtime");
    expect(() =>
      generateRecoveryPlan({
        ...standardTrip,
        preferences: { targetWakeTime: "25:00" },
      }),
    ).toThrow("Target wake time");
  });
});
