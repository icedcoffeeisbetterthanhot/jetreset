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
    expect(
      plan.activities.find((activity) => activity.title === "Caffeine-free afternoon"),
    ).toBeDefined();
    expect(
      plan.activities.find((activity) => activity.title === "Target bedtime")?.scheduledAt,
    ).toEqual(new Date("2026-05-02T03:00:00.000Z"));
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
