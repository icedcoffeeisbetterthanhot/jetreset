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
  /** When the activity ends (the next morning for overnight sleep). */
  endsAt: Date;
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
  /** First departure and final arrival used for the plan (flight segments when present). */
  routeDepartureAt: Date;
  routeArrivalAt: Date;
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

/** Adds minutes to an "HH:MM" time within the same day (callers keep results before 24:00). */
function shiftTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, hours * 60 + mins + minutes));
  return `${Math.floor(total / 60)
    .toString()
    .padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}

function addActivity(
  activities: RecoveryActivityDraft[],
  activity: {
    dayNumber: number;
    date: string;
    start: string;
    /** End time; on the following local day when `endsNextDay` is set (e.g. overnight sleep). */
    end: string;
    endsNextDay?: boolean;
    type: RecoveryActivityType;
    title: string;
    guidance: string;
    timeZone: string;
  },
): void {
  const { dayNumber, date, start, end, endsNextDay, type, title, guidance, timeZone } = activity;
  activities.push({
    activityKey: `${dayNumber}-${type}-${date}T${start.replace(":", "")}`,
    dayNumber,
    type,
    title,
    guidance,
    scheduledAt: scheduleLocal(date, start, timeZone),
    endsAt: scheduleLocal(endsNextDay ? addCalendarDays(date, 1) : date, end, timeZone),
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
    addActivity(activities, {
      dayNumber: 0,
      date: preparationDate,
      start: "21:00",
      end: "21:30",
      type: "sleep",
      title: "Keep your usual sleep routine",
      guidance:
        "Before departure, keeping your usual sleep and wake pattern is a simple preparation option. This plan does not prescribe a pre-trip sleep shift.",
      timeZone: originTimeZone,
    });
  }

  // Short naps are offered only on the first days, when sleep debt is most likely.
  const NAP_DAYS = 2;
  // The evening wind-down ends at bedtime and starts no later than 20:30.
  const eveningStart = targetBedtime > "21:30" ? "20:30" : shiftTime(targetBedtime, -60);

  for (let dayNumber = 1; dayNumber <= recoveryDays; dayNumber += 1) {
    const date = addCalendarDays(destinationDate, dayNumber - 1);
    const day = { dayNumber, date, timeZone: routeDestinationTimeZone };
    addActivity(activities, {
      ...day,
      start: targetWakeTime,
      end: shiftTime(targetWakeTime, 30),
      type: "sleep",
      title: "Target wake time",
      guidance:
        "Use this as a flexible destination-local wake-time target. Adjust for your arrival, obligations, and how you feel.",
    });
    addActivity(activities, {
      ...day,
      start: "08:30",
      end: "09:00",
      type: "meal",
      title: "Breakfast",
      guidance: "If it suits your routine, have a meal around this destination-local time.",
    });
    addActivity(activities, {
      ...day,
      start: "09:00",
      end: "09:30",
      type: "light",
      title: "Get outdoor daylight when practical",
      guidance:
        "Daylight during the local morning can help anchor a regular day-night routine. This is general guidance, not a personalized circadian light prescription; reduce bright light if it is uncomfortable or conflicts with clinical advice.",
    });
    addActivity(activities, {
      ...day,
      start: "11:00",
      end: "11:10",
      type: "hydration",
      title: "Pause for water",
      guidance:
        "Consider drinking water with your usual routine. Individual hydration needs vary; no personal fluid target is calculated.",
    });
    addActivity(activities, {
      ...day,
      start: "12:30",
      end: "13:15",
      type: "meal",
      title: "Lunch",
      guidance: "A regular meal at destination-local lunchtime may help establish the local day.",
    });
    if (dayNumber <= NAP_DAYS) {
      addActivity(activities, {
        ...day,
        start: "13:30",
        end: "14:00",
        type: "sleep",
        title: "Optional short nap",
        guidance:
          "Only if you feel very tired: a short nap of about 20–30 minutes in the early afternoon may help you get through the day. Skip it if you feel fine, and avoid long or late-afternoon naps, which can make it harder to fall asleep at bedtime. Do not nap if you need to drive or stay alert.",
      });
    }
    addActivity(activities, {
      ...day,
      start: targetWakeTime,
      end: avoidCaffeine ? targetBedtime : "14:00",
      type: "caffeine",
      title: avoidCaffeine ? "Caffeine-free day" : "Caffeine window, if you use it",
      guidance: avoidCaffeine
        ? "You chose to avoid caffeine. This plan does not recommend starting or increasing caffeine."
        : "If you already use caffeine and it is appropriate for you, consider keeping it within this window so it is less likely to interfere with sleep. This is not a dose recommendation; skip it if you have been advised to avoid caffeine.",
    });
    addActivity(activities, {
      ...day,
      start: "15:30",
      end: "15:40",
      type: "hydration",
      title: "Water break",
      guidance:
        "Consider a water break as convenient. Follow any fluid guidance from your healthcare professional.",
    });
    addActivity(activities, {
      ...day,
      start: "16:30",
      end: "17:00",
      type: "exercise",
      title: "Gentle movement",
      guidance:
        "If comfortable and practical, try light movement such as a short walk. Rest if tired and follow any personal medical advice.",
    });
    addActivity(activities, {
      ...day,
      start: "18:30",
      end: "19:30",
      type: "meal",
      title: "Evening meal",
      guidance: "A meal around the local evening can help reinforce a regular daily rhythm.",
    });
    addActivity(activities, {
      ...day,
      start: eveningStart,
      end: targetBedtime,
      type: "light",
      title: "Keep a calm, dimmer evening",
      guidance:
        "As bedtime approaches, a calm evening with less bright light may support your wind-down routine. This is general guidance, not a personalized light-avoidance prescription.",
    });
    addActivity(activities, {
      ...day,
      start: targetBedtime,
      end: targetWakeTime,
      endsNextDay: true,
      type: "sleep",
      title: "Target bedtime",
      guidance:
        "Use this as a flexible destination-local bedtime target, sleeping until your wake-time target. Prioritize adequate rest and adjust to your needs.",
    });
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
    routeDepartureAt,
    routeArrivalAt,
    assumptions: [
      "This is general educational planning, not medical advice or a clinical circadian model.",
      "The approximate time-zone change is based on the time-zone offsets at the scheduled trip endpoints; daylight-saving rules can affect the result.",
      "The suggested times are flexible destination-local anchors, not guaranteed sleep, light, meal, or recovery outcomes.",
      "Flight segments, when present, define the first departure and final arrival used for the itinerary summary.",
      "No personal health data, sleep measurement, or sunlight forecast is used. Flight times reflect the saved schedule unless verified flight-status changes have been applied.",
    ],
    activities: scheduledActivities,
  };
}
