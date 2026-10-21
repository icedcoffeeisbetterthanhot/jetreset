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
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
      "Must be in YYYY-MM-DDTHH:MM format",
    ),
  timeZone: timeZoneSchema,
});

export type TripDateTimeInput = z.infer<typeof TripDateTimeSchema>;

export function toZonedInstant({
  localDateTime,
  timeZone,
}: TripDateTimeInput): Date {
  // Parse local date/time components
  const [datePart, timePart] = localDateTime.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  // Construct a UTC date first
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));

  // Use Intl to detect DST anomalies by formatting back
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const parts = formatter.formatToParts(utcDate);
    const part = Object.fromEntries(parts.map((p) => [p.type, p.value]));

    const formattedLocal = `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}`;

    if (formattedLocal !== localDateTime) {
      throw new Error(
        "The specified local time is ambiguous or does not exist in the selected time zone.",
      );
    }

    return utcDate;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to interpret local time in the selected time zone.";
    throw new Error(message);
  }
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
