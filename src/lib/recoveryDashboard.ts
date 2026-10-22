import type { RecoveryActivityType } from "@lib/recoveryPlan";

export interface RecoveryActivityView {
  id: number;
  activityKey: string;
  dayNumber: number;
  type: RecoveryActivityType;
  title: string;
  guidance: string;
  scheduledAt: string;
  /** End of the activity window; absent for activities created before end times existed. */
  endsAt?: string | null;
  timeZone: string;
  completedAt: string | null;
}

export interface RecoveryPlanView {
  sourceTripUpdatedAt: string;
  destinationTimeZone: string;
  journeyDurationMinutes: number;
  direction: "east" | "west" | "none";
  timeZoneChangeMinutes: number;
  estimatedTimeZonesCrossed: number;
  recoveryDays: number;
  targetBedtime: string;
  targetWakeTime: string;
  avoidCaffeine: boolean;
  preparationDaysAvailable: number;
  assumptions: string[];
  /** Route endpoints the plan was built from (null for plans created before these were stored). */
  routeDepartureAt?: string | null;
  routeArrivalAt?: string | null;
  /** Explanation of applied flight-status changes, when any. */
  adjustmentNote?: string | null;
  adjustedAt?: string | null;
  activities: RecoveryActivityView[];
}

export interface StoredRecoveryPlan extends Omit<
  RecoveryPlanView,
  "sourceTripUpdatedAt" | "activities" | "routeDepartureAt" | "routeArrivalAt" | "adjustedAt"
> {
  sourceTripUpdatedAt: Date;
  routeDepartureAt?: Date | null;
  routeArrivalAt?: Date | null;
  adjustedAt?: Date | null;
  activities: Array<
    Omit<RecoveryActivityView, "scheduledAt" | "endsAt" | "completedAt"> & {
      scheduledAt: Date;
      endsAt?: Date | null;
      completedAt: Date | null;
    }
  >;
}

export const ACTIVITY_LABELS: Record<RecoveryActivityType, string> = {
  sleep: "Sleep",
  light: "Light",
  meal: "Meal",
  hydration: "Hydration",
  exercise: "Movement",
  caffeine: "Caffeine",
};

export type RecoveryStage = "before-departure" | "in-transit" | "recovery" | "complete";

export interface DailyRecoveryState {
  stage: RecoveryStage;
  stageLabel: string;
  /** Destination-local recovery day clamped to the plan length. */
  recoveryDay: number;
  /** Unclamped destination-local calendar day relative to arrival (day 1 = arrival day). */
  rawRecoveryDay: number;
  dailyActivities: RecoveryActivityView[];
  completedCount: number;
  progress: number;
  nextBedtime: RecoveryActivityView | undefined;
  nextWakeTime: RecoveryActivityView | undefined;
  nextActivity: RecoveryActivityView | undefined;
}

export function getLocalDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function calendarDaysBetween(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  const startDate = Date.UTC(startYear, startMonth - 1, startDay);
  const endDate = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((endDate - startDate) / 86_400_000);
}

function formatLocalClock(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(value));
}

/**
 * Formats an activity's local start and end, e.g. "13:30–14:00" or
 * "22:00–07:00 next day". Activities without a stored end show the start only.
 */
export function formatActivityTimeRange(
  activity: Pick<RecoveryActivityView, "scheduledAt" | "endsAt" | "timeZone">,
): string {
  const start = formatLocalClock(activity.scheduledAt, activity.timeZone);
  if (!activity.endsAt) return start;
  const dayOffset = calendarDaysBetween(
    getLocalDate(new Date(activity.scheduledAt), activity.timeZone),
    getLocalDate(new Date(activity.endsAt), activity.timeZone),
  );
  const suffix = dayOffset === 1 ? " next day" : dayOffset > 1 ? ` (+${dayOffset} days)` : "";
  return `${start}–${formatLocalClock(activity.endsAt, activity.timeZone)}${suffix}`;
}

export function offsetDescription(minutes: number): string {
  if (minutes === 0) return "No time-zone offset change";
  const hours = Math.floor(Math.abs(minutes) / 60);
  const remainingMinutes = Math.abs(minutes) % 60;
  const duration = `${hours ? `${hours}h` : ""}${hours && remainingMinutes ? " " : ""}${
    remainingMinutes ? `${remainingMinutes}m` : ""
  }`;
  return `${duration} ${minutes > 0 ? "ahead" : "behind"}`;
}

function nextUncompleted(
  activities: RecoveryActivityView[],
  now: Date,
  predicate: (activity: RecoveryActivityView) => boolean,
): RecoveryActivityView | undefined {
  return activities.find(
    (activity) =>
      predicate(activity) &&
      activity.completedAt === null &&
      new Date(activity.scheduledAt).getTime() >= now.getTime(),
  );
}

/**
 * Derives the current trip stage and today's destination-local activities from
 * a persisted plan. Progress is calculated only from stored completion times.
 * Activities are expected in ascending scheduled order.
 */
export function getDailyRecoveryState(input: {
  departureAt: Date;
  arrivalAt: Date;
  destinationTimeZone: string;
  plan: RecoveryPlanView | null;
  now: Date;
}): DailyRecoveryState {
  const { destinationTimeZone, plan, now } = input;
  // Plans record the route times they were built from, including applied flight-status times.
  const departureAt = plan?.routeDepartureAt ? new Date(plan.routeDepartureAt) : input.departureAt;
  const arrivalAt = plan?.routeArrivalAt ? new Date(plan.routeArrivalAt) : input.arrivalAt;
  const today = getLocalDate(now, destinationTimeZone);
  const destinationArrivalDate = getLocalDate(arrivalAt, destinationTimeZone);
  const isBeforeDeparture = now.getTime() < departureAt.getTime();
  const isInTransit = !isBeforeDeparture && now.getTime() < arrivalAt.getTime();
  const rawRecoveryDay = calendarDaysBetween(destinationArrivalDate, today) + 1;
  const recoveryDay = plan
    ? Math.max(1, Math.min(plan.recoveryDays, rawRecoveryDay))
    : Math.max(1, rawRecoveryDay);
  const stage: RecoveryStage = isBeforeDeparture
    ? "before-departure"
    : isInTransit
      ? "in-transit"
      : rawRecoveryDay > (plan?.recoveryDays ?? 0)
        ? "complete"
        : "recovery";
  const stageLabel = {
    "before-departure": "Before departure",
    "in-transit": "In transit",
    complete: "Plan period complete",
    recovery: `Recovery day ${recoveryDay} of ${plan?.recoveryDays ?? "—"}`,
  }[stage];

  const activities = plan?.activities ?? [];
  const dailyActivities = activities.filter((activity) => {
    if (stage === "in-transit") return false;
    if (stage === "before-departure") {
      return (
        activity.dayNumber === 0 &&
        getLocalDate(new Date(activity.scheduledAt), activity.timeZone) ===
          getLocalDate(now, activity.timeZone)
      );
    }
    return (
      activity.dayNumber === recoveryDay &&
      getLocalDate(new Date(activity.scheduledAt), activity.timeZone) === today
    );
  });
  const completedCount = dailyActivities.filter((activity) => activity.completedAt !== null).length;

  return {
    stage,
    stageLabel,
    recoveryDay,
    rawRecoveryDay,
    dailyActivities,
    completedCount,
    progress: dailyActivities.length
      ? Math.round((completedCount / dailyActivities.length) * 100)
      : 0,
    nextBedtime: nextUncompleted(
      activities,
      now,
      (activity) => activity.title === "Target bedtime",
    ),
    nextWakeTime: nextUncompleted(
      activities,
      now,
      (activity) => activity.title === "Target wake time",
    ),
    nextActivity: nextUncompleted(dailyActivities, now, () => true),
  };
}

export interface PlanCalendarDay {
  dayNumber: number;
  /** Local calendar date (YYYY-MM-DD) in the day's time zone. */
  date: string;
  timeZone: string;
  activities: RecoveryActivityView[];
}

/** Groups plan activities into calendar days in ascending order (day 0 is preparation). */
export function getPlanCalendarDays(plan: RecoveryPlanView): PlanCalendarDay[] {
  const days = new Map<number, PlanCalendarDay>();
  for (const activity of plan.activities) {
    const existing = days.get(activity.dayNumber);
    if (existing) {
      existing.activities.push(activity);
    } else {
      days.set(activity.dayNumber, {
        dayNumber: activity.dayNumber,
        date: getLocalDate(new Date(activity.scheduledAt), activity.timeZone),
        timeZone: activity.timeZone,
        activities: [activity],
      });
    }
  }
  return [...days.values()]
    .sort((first, second) => first.dayNumber - second.dayNumber)
    .map((day) => ({
      ...day,
      activities: [...day.activities].sort(
        (first, second) =>
          new Date(first.scheduledAt).getTime() - new Date(second.scheduledAt).getTime(),
      ),
    }));
}

/** Chooses the calendar day matching the current stage, falling back to the first or last day. */
export function getDefaultCalendarDay(
  days: PlanCalendarDay[],
  state: Pick<DailyRecoveryState, "stage" | "recoveryDay">,
): number | undefined {
  if (days.length === 0) return undefined;
  const preferred =
    state.stage === "recovery"
      ? state.recoveryDay
      : state.stage === "complete"
        ? days[days.length - 1].dayNumber
        : state.stage === "before-departure"
          ? 0
          : 1;
  return (
    days.find((day) => day.dayNumber === preferred)?.dayNumber ??
    days.find((day) => day.dayNumber >= 1)?.dayNumber ??
    days[0].dayNumber
  );
}

/** Returns the 0–23 local hour of an instant in a time zone. */
export function getLocalHour(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number(hour);
}

export interface CalendarHourSlot {
  hour: number;
  activities: RecoveryActivityView[];
}

/** Builds one slot per local hour from the first to the last activity hour of a day. */
export function getCalendarHourSlots(day: PlanCalendarDay): CalendarHourSlot[] {
  if (day.activities.length === 0) return [];
  const hours = day.activities.map((activity) =>
    getLocalHour(new Date(activity.scheduledAt), activity.timeZone),
  );
  const first = Math.min(...hours);
  const last = Math.max(...hours);
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const hour = first + index;
    return {
      hour,
      activities: day.activities.filter((_, activityIndex) => hours[activityIndex] === hour),
    };
  });
}

export interface DashboardTripCandidate {
  id: number;
  departureAt: Date;
  arrivalAt: Date;
  /** Scheduled time of the plan's last activity, when a plan exists. */
  planEndsAt: Date | null;
}

/**
 * Picks the trip most relevant to `now`: a trip in transit or within its plan
 * period (most recent departure first), otherwise the next upcoming trip,
 * otherwise the most recently completed trip.
 */
export function selectDashboardTrip<T extends DashboardTripCandidate>(
  trips: T[],
  now: Date,
): T | undefined {
  const time = now.getTime();
  const active = trips
    .filter((trip) => {
      const endsAt = Math.max(trip.arrivalAt.getTime(), trip.planEndsAt?.getTime() ?? 0);
      return trip.departureAt.getTime() <= time && time <= endsAt;
    })
    .sort((first, second) => second.departureAt.getTime() - first.departureAt.getTime());
  if (active[0]) return active[0];

  const upcoming = trips
    .filter((trip) => trip.departureAt.getTime() > time)
    .sort((first, second) => first.departureAt.getTime() - second.departureAt.getTime());
  if (upcoming[0]) return upcoming[0];

  return [...trips].sort(
    (first, second) => second.arrivalAt.getTime() - first.arrivalAt.getTime(),
  )[0];
}

export function toRecoveryPlanView(plan: StoredRecoveryPlan): RecoveryPlanView {
  return {
    sourceTripUpdatedAt: plan.sourceTripUpdatedAt.toISOString(),
    destinationTimeZone: plan.destinationTimeZone,
    journeyDurationMinutes: plan.journeyDurationMinutes,
    direction: plan.direction,
    timeZoneChangeMinutes: plan.timeZoneChangeMinutes,
    estimatedTimeZonesCrossed: plan.estimatedTimeZonesCrossed,
    recoveryDays: plan.recoveryDays,
    targetBedtime: plan.targetBedtime,
    targetWakeTime: plan.targetWakeTime,
    avoidCaffeine: plan.avoidCaffeine,
    preparationDaysAvailable: plan.preparationDaysAvailable,
    assumptions: plan.assumptions,
    routeDepartureAt: plan.routeDepartureAt?.toISOString() ?? null,
    routeArrivalAt: plan.routeArrivalAt?.toISOString() ?? null,
    adjustmentNote: plan.adjustmentNote ?? null,
    adjustedAt: plan.adjustedAt?.toISOString() ?? null,
    activities: plan.activities.map((activity) => ({
      id: activity.id,
      activityKey: activity.activityKey,
      dayNumber: activity.dayNumber,
      type: activity.type,
      title: activity.title,
      guidance: activity.guidance,
      scheduledAt: activity.scheduledAt.toISOString(),
      endsAt: activity.endsAt?.toISOString() ?? null,
      completedAt: activity.completedAt?.toISOString() ?? null,
      timeZone: activity.timeZone,
    })),
  };
}
