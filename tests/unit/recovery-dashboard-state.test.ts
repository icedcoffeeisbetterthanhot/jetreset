import {
  getCalendarHourSlots,
  getDailyRecoveryState,
  getDefaultCalendarDay,
  getLocalHour,
  getPlanCalendarDays,
  selectDashboardTrip,
  toRecoveryPlanView,
  type RecoveryActivityView,
  type RecoveryPlanView,
} from "@lib/recoveryDashboard";

const timeZone = "America/New_York";

function activity(
  overrides: Partial<RecoveryActivityView> & Pick<RecoveryActivityView, "id">,
): RecoveryActivityView {
  return {
    activityKey: `key-${overrides.id}`,
    dayNumber: 1,
    type: "meal",
    title: "Lunch",
    guidance: "General guidance.",
    scheduledAt: "2026-06-01T16:30:00.000Z",
    timeZone,
    completedAt: null,
    ...overrides,
  };
}

const plan: RecoveryPlanView = {
  sourceTripUpdatedAt: "2026-05-30T12:00:00.000Z",
  destinationTimeZone: timeZone,
  journeyDurationMinutes: 480,
  direction: "west",
  timeZoneChangeMinutes: -300,
  estimatedTimeZonesCrossed: 5,
  recoveryDays: 2,
  targetBedtime: "22:00",
  targetWakeTime: "07:00",
  avoidCaffeine: false,
  preparationDaysAvailable: 1,
  assumptions: [],
  activities: [
    activity({
      id: 1,
      dayNumber: 0,
      type: "sleep",
      title: "Keep your usual sleep routine",
      scheduledAt: "2026-05-30T20:00:00.000Z",
      timeZone: "Europe/London",
    }),
    // Day 1 (1 June, New York): 12:30 lunch, 18:30 dinner, 22:00 bedtime.
    activity({ id: 2, scheduledAt: "2026-06-01T16:30:00.000Z" }),
    activity({ id: 3, title: "Evening meal", scheduledAt: "2026-06-01T22:30:00.000Z" }),
    activity({
      id: 4,
      type: "sleep",
      title: "Target bedtime",
      scheduledAt: "2026-06-02T02:00:00.000Z",
    }),
    // Day 2 (2 June, New York): 07:00 wake, 22:00 bedtime.
    activity({
      id: 5,
      dayNumber: 2,
      type: "sleep",
      title: "Target wake time",
      scheduledAt: "2026-06-02T11:00:00.000Z",
    }),
    activity({
      id: 6,
      dayNumber: 2,
      type: "sleep",
      title: "Target bedtime",
      scheduledAt: "2026-06-03T02:00:00.000Z",
    }),
  ],
};

const trip = {
  departureAt: new Date("2026-05-31T10:00:00.000Z"),
  arrivalAt: new Date("2026-06-01T14:00:00.000Z"),
  destinationTimeZone: timeZone,
};

describe("getDailyRecoveryState", () => {
  it("reports the recovery day, today's activities, and progress from stored completion", () => {
    const state = getDailyRecoveryState({
      ...trip,
      plan: {
        ...plan,
        activities: plan.activities.map((item) =>
          item.id === 2 ? { ...item, completedAt: "2026-06-01T16:40:00.000Z" } : item,
        ),
      },
      now: new Date("2026-06-01T18:00:00.000Z"),
    });

    expect(state.stage).toBe("recovery");
    expect(state.stageLabel).toBe("Recovery day 1 of 2");
    expect(state.dailyActivities.map((item) => item.id)).toEqual([2, 3, 4]);
    expect(state.completedCount).toBe(1);
    expect(state.progress).toBe(33);
    expect(state.nextActivity?.id).toBe(3);
    expect(state.nextBedtime?.id).toBe(4);
    expect(state.nextWakeTime?.id).toBe(5);
  });

  it("uses the destination-local calendar day rather than the UTC day", () => {
    // 01:00 UTC on 2 June is still 21:00 on 1 June in New York.
    const state = getDailyRecoveryState({
      ...trip,
      plan,
      now: new Date("2026-06-02T01:00:00.000Z"),
    });

    expect(state.recoveryDay).toBe(1);
    expect(state.dailyActivities.map((item) => item.id)).toEqual([2, 3, 4]);
  });

  it("shows only preparation activities for the origin-local day before departure", () => {
    const state = getDailyRecoveryState({
      ...trip,
      plan,
      now: new Date("2026-05-30T09:00:00.000Z"),
    });

    expect(state.stage).toBe("before-departure");
    expect(state.dailyActivities.map((item) => item.id)).toEqual([1]);
    expect(state.nextBedtime?.id).toBe(4);
  });

  it("has no daily activities in transit or after the plan period", () => {
    const inTransit = getDailyRecoveryState({
      ...trip,
      plan,
      now: new Date("2026-06-01T00:00:00.000Z"),
    });
    const complete = getDailyRecoveryState({
      ...trip,
      plan,
      now: new Date("2026-06-04T15:00:00.000Z"),
    });

    expect(inTransit.stage).toBe("in-transit");
    expect(inTransit.dailyActivities).toEqual([]);
    expect(complete.stage).toBe("complete");
    expect(complete.dailyActivities).toEqual([]);
    expect(complete.progress).toBe(0);
    expect(complete.nextBedtime).toBeUndefined();
  });

  it("skips completed and past targets when finding the next sleep times", () => {
    const state = getDailyRecoveryState({
      ...trip,
      plan: {
        ...plan,
        activities: plan.activities.map((item) =>
          item.id === 4 ? { ...item, completedAt: "2026-06-02T02:05:00.000Z" } : item,
        ),
      },
      now: new Date("2026-06-01T20:00:00.000Z"),
    });

    expect(state.nextBedtime?.id).toBe(6);
  });
});

describe("selectDashboardTrip", () => {
  const now = new Date("2026-06-02T12:00:00.000Z");
  const past = {
    id: 1,
    departureAt: new Date("2026-04-01T10:00:00.000Z"),
    arrivalAt: new Date("2026-04-01T18:00:00.000Z"),
    planEndsAt: new Date("2026-04-04T02:00:00.000Z"),
  };
  const recovering = {
    id: 2,
    departureAt: new Date("2026-05-31T10:00:00.000Z"),
    arrivalAt: new Date("2026-06-01T14:00:00.000Z"),
    planEndsAt: new Date("2026-06-04T02:00:00.000Z"),
  };
  const upcoming = {
    id: 3,
    departureAt: new Date("2026-07-01T10:00:00.000Z"),
    arrivalAt: new Date("2026-07-01T18:00:00.000Z"),
    planEndsAt: null,
  };
  const later = { ...upcoming, id: 4, departureAt: new Date("2026-08-01T10:00:00.000Z") };

  it("prefers a trip within its recovery-plan period", () => {
    expect(selectDashboardTrip([past, upcoming, recovering], now)?.id).toBe(2);
  });

  it("falls back to the next upcoming trip, then the most recent past trip", () => {
    expect(selectDashboardTrip([past, later, upcoming], now)?.id).toBe(3);
    expect(selectDashboardTrip([past, { ...past, id: 5 }], now)?.id).toBe(1);
    expect(selectDashboardTrip([], now)).toBeUndefined();
  });

  it("treats a trip without a plan as active only while in transit", () => {
    const inTransit = { ...recovering, id: 6, planEndsAt: null };
    expect(
      selectDashboardTrip([inTransit, upcoming], new Date("2026-06-01T00:00:00.000Z"))?.id,
    ).toBe(6);
    expect(selectDashboardTrip([inTransit, upcoming], now)?.id).toBe(3);
  });
});

describe("toRecoveryPlanView", () => {
  it("serializes stored dates as ISO strings", () => {
    const view = toRecoveryPlanView({
      ...plan,
      sourceTripUpdatedAt: new Date("2026-05-30T12:00:00.000Z"),
      activities: [
        {
          ...plan.activities[1],
          scheduledAt: new Date("2026-06-01T16:30:00.000Z"),
          completedAt: new Date("2026-06-01T16:40:00.000Z"),
        },
        {
          ...plan.activities[2],
          scheduledAt: new Date("2026-06-01T22:30:00.000Z"),
          completedAt: null,
        },
      ],
    });

    expect(view.sourceTripUpdatedAt).toBe("2026-05-30T12:00:00.000Z");
    expect(view.activities[0]).toMatchObject({
      id: 2,
      scheduledAt: "2026-06-01T16:30:00.000Z",
      completedAt: "2026-06-01T16:40:00.000Z",
    });
    expect(view.activities[1].completedAt).toBeNull();
  });
});

describe("calendar helpers", () => {
  it("groups activities into ordered plan days in each day's time zone", () => {
    const days = getPlanCalendarDays(plan);

    expect(days.map((day) => [day.dayNumber, day.date, day.timeZone])).toEqual([
      [0, "2026-05-30", "Europe/London"],
      [1, "2026-06-01", timeZone],
      [2, "2026-06-02", timeZone],
    ]);
    expect(days[1].activities.map((item) => item.id)).toEqual([2, 3, 4]);
  });

  it("builds hourly slots spanning the day's first to last local activity hour", () => {
    const [, dayOne] = getPlanCalendarDays(plan);
    const slots = getCalendarHourSlots(dayOne);

    expect(slots[0]).toMatchObject({ hour: 12 });
    expect(slots[slots.length - 1]).toMatchObject({ hour: 22 });
    expect(slots).toHaveLength(11);
    expect(slots.find((slot) => slot.hour === 18)?.activities.map((item) => item.id)).toEqual([3]);
    expect(slots.find((slot) => slot.hour === 15)?.activities).toEqual([]);
  });

  it("defaults the calendar to the day matching the current stage", () => {
    const days = getPlanCalendarDays(plan);

    expect(getDefaultCalendarDay(days, { stage: "recovery", recoveryDay: 2 })).toBe(2);
    expect(getDefaultCalendarDay(days, { stage: "before-departure", recoveryDay: 1 })).toBe(0);
    expect(getDefaultCalendarDay(days, { stage: "in-transit", recoveryDay: 1 })).toBe(1);
    expect(getDefaultCalendarDay(days, { stage: "complete", recoveryDay: 2 })).toBe(2);
    expect(getDefaultCalendarDay([], { stage: "recovery", recoveryDay: 1 })).toBeUndefined();
  });

  it("reads local hours across daylight-saving and date boundaries", () => {
    expect(getLocalHour(new Date("2026-06-02T02:00:00.000Z"), timeZone)).toBe(22);
    expect(getLocalHour(new Date("2026-01-02T02:00:00.000Z"), timeZone)).toBe(21);
  });
});
