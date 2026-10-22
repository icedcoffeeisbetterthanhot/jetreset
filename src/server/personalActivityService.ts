import { z } from "zod";
import { TripDateTimeSchema, toZonedInstant } from "@lib/timezone";
import { prisma } from "@server/db";
import { TripInputError, TripNotFoundError } from "@server/tripService";
import { PersonalActivityNotFoundError } from "@server/personalActivityErrors";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const personalActivitySchema = z.object({
  title: z.string().trim().min(1, "Add a title for the activity.").max(120),
  notes: z.string().trim().max(500).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
  startTime: z.string().regex(timePattern, "Start time must be HH:MM."),
  endTime: z.string().regex(timePattern, "End time must be HH:MM."),
  timeZone: TripDateTimeSchema.shape.timeZone,
});

function validateId(id: number, label: string): void {
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new TripInputError(`${label} must be a positive integer.`);
  }
}

/** Validates input and converts the local date and times to instants in the given zone. */
function buildPersonalActivityData(input: unknown) {
  const parsed = personalActivitySchema.safeParse(input);
  if (!parsed.success) {
    throw new TripInputError(parsed.error.errors.map((error) => error.message).join("; "));
  }
  const { title, notes, date, startTime, endTime, timeZone } = parsed.data;

  let startsAt: Date;
  let endsAt: Date;
  try {
    startsAt = toZonedInstant({ localDateTime: `${date}T${startTime}`, timeZone });
    endsAt = toZonedInstant({ localDateTime: `${date}T${endTime}`, timeZone });
  } catch (error) {
    throw new TripInputError(
      error instanceof Error ? error.message : "Unable to interpret the activity times.",
    );
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new TripInputError("The activity must end after it starts.");
  }

  return { title, notes: notes || null, startsAt, endsAt, timeZone };
}

async function assertTripExists(tripId: number): Promise<void> {
  if (!(await prisma.trip.findUnique({ where: { id: tripId }, select: { id: true } }))) {
    throw new TripNotFoundError();
  }
}

export async function listPersonalActivities(tripId: number) {
  validateId(tripId, "Trip ID");
  await assertTripExists(tripId);
  return prisma.personalActivity.findMany({
    where: { tripId },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });
}

export async function createPersonalActivity(tripId: number, input: unknown) {
  validateId(tripId, "Trip ID");
  const data = buildPersonalActivityData(input);
  await assertTripExists(tripId);
  return prisma.personalActivity.create({ data: { ...data, trip: { connect: { id: tripId } } } });
}

export async function updatePersonalActivity(tripId: number, activityId: number, input: unknown) {
  validateId(tripId, "Trip ID");
  validateId(activityId, "Activity ID");
  const data = buildPersonalActivityData(input);
  // Scope the update to the trip so an activity can't be changed through another trip.
  const result = await prisma.personalActivity.updateMany({
    where: { id: activityId, tripId },
    data,
  });
  if (result.count === 0) throw new PersonalActivityNotFoundError();
  return prisma.personalActivity.findUniqueOrThrow({ where: { id: activityId } });
}

export async function deletePersonalActivity(tripId: number, activityId: number) {
  validateId(tripId, "Trip ID");
  validateId(activityId, "Activity ID");
  const result = await prisma.personalActivity.deleteMany({ where: { id: activityId, tripId } });
  if (result.count === 0) throw new PersonalActivityNotFoundError();
}
