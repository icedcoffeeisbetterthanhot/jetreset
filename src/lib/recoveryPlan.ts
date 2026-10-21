import { getTimeZoneOffsetMinutes, toZonedInstant, type TripDateTimeInput } from "@lib/timezone";

export const RECOVERY_ACTIVITY_TYPES = [
  "sleep",
  "light",
  "meal",
  "hydration",
  "exercise",
  "caffeine",
] as const;

export type RecoveryActivityType = (typeof RECOVERY_ACTIVITY_TYPES)[number];

export interface RecoveryFlightInput {
  departureAt: Date;
  arrivalAt: Date;
  departureTimeZone: string;
  arrivalTimeZone: string;
}

export interface RecoveryPlanInput {
  departureAt: Date;
  arrivalAt: Date;
  originTimeZone: string;
  destinationTimeZone: string;
  flights?: RecoveryFlightInput[];
  preferences?: {
    targetBedtime?: string;
    targetWakeTime?: string;
    avoidCaffeine?: boolean;
  };
  referenceDate?: Date;
}

export interface RecoveryActivityDraft {
  activityKey: string;
  dayNumber: number;
  type: RecoveryActivityType;
  title: string;
  guidance: string;
  scheduledAt: Date;
  timeZone: string;
}

export interface RecoveryPlanDraft {
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
  activities: RecoveryActivityDraft[];
}

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

function validateTime(value: string, label: string, start: number, end: number): string {
  const match = timePattern.exec(value);
  if (!match) throw new Error(`${label} must be a valid 24-hour time (HH:MM).`);
  const hour = Number(match[1]);
  if (hour < start || hour > end) {
    throw new Error(
      `${label} must be between ${start.toString().padStart(2, "0")}:00 and ${end}:59.`,
    );
  }
  return value;
}

function localDate(date: Date, timeZone: string): string {
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

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + days));
  return `${nextDay.getUTCFullYear().toString().padStart(4, "0")}-${(nextDay.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}-${nextDay.getUTCDate().toString().padStart(2, "0")}`;
}

function scheduleLocal(date: string, time: string, timeZone: string): Date {
  const input: TripDateTimeInput = {
    localDateTime: `${date}T${time}`,
    timeZone,
  };
  return toZonedInstant(input);
}

function addActivity(
  activities: RecoveryActivityDraft[],
  dayNumber: number,
  date: string,
  time: string,
  type: RecoveryActivityType,
  title: string,
  guidance: string,
  timeZone: string,
): void {
  activities.push({
    activityKey: `${dayNumber}-${type}-${date}T${time.replace(":", "")}`,
    dayNumber,
    type,
    title,
    guidance,
    scheduledAt: scheduleLocal(date, time, timeZone),
    timeZone,
  });
}

export function generateRecoveryPlan(input: RecoveryPlanInput): RecoveryPlanDraft {
  const { departureAt, arrivalAt, originTimeZone, destinationTimeZone } = input;
  if (
    !Number.isFinite(departureAt.getTime()) ||
    !Number.isFinite(arrivalAt.getTime()) ||
    arrivalAt.getTime() <= departureAt.getTime()
  ) {
    throw new Error("A valid trip departure and later arrival are required.");
  }

  const referenceDate = input.referenceDate ?? new Date();
  if (!Number.isFinite(referenceDate.getTime())) throw new Error("Reference date is invalid.");

  const targetBedtime = validateTime(
    input.preferences?.targetBedtime ?? "22:00",
    "Target bedtime",
    18,
    23,
  );
  const targetWakeTime = validateTime(
    input.preferences?.targetWakeTime ?? "07:00",
    "Target wake time",
    5,
    11,
  );
  const avoidCaffeine = input.preferences?.avoidCaffeine ?? false;

  const orderedFlights = [...(input.flights ?? [])].sort(
    (first, second) => first.departureAt.getTime() - second.departureAt.getTime(),
  );
  const firstFlight = orderedFlights[0];
  const lastFlight = orderedFlights[orderedFlights.length - 1];
  const routeDepartureAt = firstFlight?.departureAt ?? departureAt;
  const routeArrivalAt = lastFlight?.arrivalAt ?? arrivalAt;
  const routeOriginTimeZone = firstFlight?.departureTimeZone ?? originTimeZone;
  const routeDestinationTimeZone = lastFlight?.arrivalTimeZone ?? destinationTimeZone;
  const offsetChange =
    getTimeZoneOffsetMinutes(routeArrivalAt, routeDestinationTimeZone) -
    getTimeZoneOffsetMinutes(routeDepartureAt, routeOriginTimeZone);
  const estimatedTimeZonesCrossed = Math.round(Math.abs(offsetChange) / 60);
  const journeyDurationMinutes = Math.round(
    (routeArrivalAt.getTime() - routeDepartureAt.getTime()) / 60_000,
  );
  const direction = offsetChange > 0 ? "east" : offsetChange < 0 ? "west" : "none";
  const recoveryDays = Math.min(7, Math.max(3, Math.ceil(estimatedTimeZonesCrossed / 2) + 2));
  const preparationDaysAvailable = Math.max(
    0,
    Math.floor((departureAt.getTime() - referenceDate.getTime()) / 86_400_000),
  );
  const destinationDate = localDate(routeArrivalAt, routeDestinationTimeZone);
  const activities: RecoveryActivityDraft[] = [];

  if (preparationDaysAvailable >= 1) {
    const preparationDate = addCalendarDays(localDate(departureAt, originTimeZone), -1);
    addActivity(
      activities,
      0,
      preparationDate,
      "21:00",
      "sleep",
      "Keep your usual sleep routine",
      "Before departure, keeping your usual sleep and wake pattern is a simple preparation option. This plan does not prescribe a pre-trip sleep shift.",
      originTimeZone,
    );
  }

  for (let dayNumber = 1; dayNumber <= recoveryDays; dayNumber += 1) {
    const date = addCalendarDays(destinationDate, dayNumber - 1);
    addActivity(
      activities,
      dayNumber,
      date,
      targetWakeTime,
      "sleep",
      "Target wake time",
      "Use this as a flexible destination-local wake-time target. Adjust for your arrival, obligations, and how you feel.",
      routeDestinationTimeZone,
    );
    addActivity(
      activities,
      dayNumber,
      date,
      "08:30",
      "meal",
      "Breakfast",
      "If it suits your routine, have a meal around this destination-local time.",
      routeDestinationTimeZone,
    );
    addActivity(
      activities,
      dayNumber,
      date,
      "09:00",
      "light",
      "Get outdoor daylight when practical",
      "Daylight during the local morning can help anchor a regular day-night routine. This is general guidance, not a personalized circadian light prescription; reduce bright light if it is uncomfortable or conflicts with clinical advice.",
      routeDestinationTimeZone,
    );
    addActivity(
      activities,
      dayNumber,
      date,
      "11:00",
      "hydration",
      "Pause for water",
      "Consider drinking water with your usual routine. Individual hydration needs vary; no personal fluid target is calculated.",
      routeDestinationTimeZone,
    );
    addActivity(
      activities,
      dayNumber,
      date,
      "12:30",
      "meal",
      "Lunch",
      "A regular meal at destination-local lunchtime may help establish the local day.",
      routeDestinationTimeZone,
    );
    addActivity(
      activities,
      dayNumber,
      date,
      "14:00",
      "caffeine",
      avoidCaffeine ? "Caffeine-free afternoon" : "Keep caffeine early, if you use it",
      avoidCaffeine
        ? "You chose to avoid caffeine. This plan does not recommend starting or increasing caffeine."
        : "If you already use caffeine and it is appropriate for you, consider avoiding it after this early-afternoon point so it is less likely to interfere with sleep. This is not a dose recommendation; skip it if you have been advised to avoid caffeine.",
      routeDestinationTimeZone,
    );
    addActivity(
      activities,
      dayNumber,
      date,
      "15:30",
      "hydration",
      "Water break",
      "Consider a water break as convenient. Follow any fluid guidance from your healthcare professional.",
      routeDestinationTimeZone,
    );
    addActivity(
      activities,
      dayNumber,
      date,
      "16:30",
      "exercise",
      "Gentle movement",
      "If comfortable and practical, try light movement such as a short walk. Rest if tired and follow any personal medical advice.",
      routeDestinationTimeZone,
    );
    addActivity(
      activities,
      dayNumber,
      date,
      "18:30",
      "meal",
      "Evening meal",
      "A meal around the local evening can help reinforce a regular daily rhythm.",
      routeDestinationTimeZone,
    );
    addActivity(
      activities,
      dayNumber,
      date,
      "20:30",
      "light",
      "Keep a calm, dimmer evening",
      "As bedtime approaches, a calm evening with less bright light may support your wind-down routine. This is general guidance, not a personalized light-avoidance prescription.",
      routeDestinationTimeZone,
    );
    addActivity(
      activities,
      dayNumber,
      date,
      targetBedtime,
      "sleep",
      "Target bedtime",
      "Use this as a flexible destination-local bedtime target. Prioritize adequate rest and adjust to your needs.",
      routeDestinationTimeZone,
    );
  }

  const arrivalTimestamp = routeArrivalAt.getTime();
  const scheduledActivities = activities.filter(
    (activity) => activity.dayNumber !== 1 || activity.scheduledAt.getTime() >= arrivalTimestamp,
  );

  return {
    destinationTimeZone: routeDestinationTimeZone,
    journeyDurationMinutes,
    direction,
    timeZoneChangeMinutes: offsetChange,
    estimatedTimeZonesCrossed,
    recoveryDays,
    targetBedtime,
    targetWakeTime,
    avoidCaffeine,
    preparationDaysAvailable,
    assumptions: [
      "This is general educational planning, not medical advice or a clinical circadian model.",
      "The approximate time-zone change is based on the time-zone offsets at the scheduled trip endpoints; daylight-saving rules can affect the result.",
      "The suggested times are flexible destination-local anchors, not guaranteed sleep, light, meal, or recovery outcomes.",
      "Flight segments, when present, define the first departure and final arrival used for the itinerary summary.",
      "No personal health data, sleep measurement, sunlight forecast, or verified flight-status data is used.",
    ],
    activities: scheduledActivities,
  };
}
