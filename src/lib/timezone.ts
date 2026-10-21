import { z } from "zod";

// Simple IANA time zone validation using Intl support.
// We avoid speculative lists and rely on runtime capability.
const timeZoneSchema = z
  .string()
  .min(1, "Time zone is required")
  .refine((value) => {
    try {
      // Throws if timeZone is invalid
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Invalid time zone identifier");

export const TripDateTimeSchema = z.object({
  localDateTime: z
    .string()
    .min(1, "Date and time is required")
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Must be in YYYY-MM-DDTHH:MM format"),
  timeZone: timeZoneSchema,
});

export type TripDateTimeInput = z.infer<typeof TripDateTimeSchema>;

function createUtcDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date;
}

function getDateTimeParts(formatter: Intl.DateTimeFormat, date: Date): Record<string, string> {
  return Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
}

function getTimeZoneOffset(formatter: Intl.DateTimeFormat, timestamp: number): number {
  const parts = getDateTimeParts(formatter, new Date(timestamp));
  const localAsUtc = createUtcDate(
    Number(parts.year),
    Number(parts.month),
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  ).getTime();

  return localAsUtc - timestamp;
}

function formatLocalDateTime(formatter: Intl.DateTimeFormat, timestamp: number): string {
  const parts = getDateTimeParts(formatter, new Date(timestamp));
  return `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function toZonedInstant({ localDateTime, timeZone }: TripDateTimeInput): Date {
  const [datePart, timePart] = localDateTime.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const localDate = createUtcDate(year, month, day, hour, minute);

  if (
    localDate.getUTCFullYear() !== year ||
    localDate.getUTCMonth() !== month - 1 ||
    localDate.getUTCDate() !== day ||
    localDate.getUTCHours() !== hour ||
    localDate.getUTCMinutes() !== minute
  ) {
    throw new Error("The specified local date and time is invalid.");
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const localTimestamp = localDate.getTime();
  const offsets = new Set<number>();

  for (let hours = -48; hours <= 48; hours += 6) {
    offsets.add(getTimeZoneOffset(formatter, localTimestamp + hours * 60 * 60 * 1000));
  }

  const candidates = [...offsets]
    .map((offset) => localTimestamp - offset)
    .filter((timestamp) => formatLocalDateTime(formatter, timestamp) === localDateTime);

  if (candidates.length === 0) {
    throw new Error(
      "The specified local time does not exist in the selected time zone because of a daylight-saving time change. Choose a different time.",
    );
  }

  if (candidates.length > 1) {
    throw new Error(
      "The specified local time occurs twice in the selected time zone because of a daylight-saving time change. Choose a different time.",
    );
  }

  return new Date(candidates[0]);
}

export function computeDurationMinutes(departureAt: Date, arrivalAt: Date): number {
  const diffMs = arrivalAt.getTime() - departureAt.getTime();
  return Math.round(diffMs / 60000);
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) {
    return "0 minutes";
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) {
    return `${mins} minutes`;
  }
  if (mins === 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${hours}h ${mins}m`;
}
