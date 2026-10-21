import { createHash } from "node:crypto";
import { z } from "zod";
import { generateRecoveryPlan } from "@lib/recoveryPlan";
import type { RecoveryPlanDraft } from "@lib/recoveryPlan";
import { prisma } from "@server/db";
import { TripInputError, TripNotFoundError } from "@server/tripService";
import { RecoveryActivityNotFoundError } from "@server/recoveryErrors";

const recoveryPreferencesSchema = z.object({
  targetBedtime: z
    .string()
    .regex(/^(1[89]|2[0-3]):[0-5]\d$/)
    .optional(),
  targetWakeTime: z
    .string()
    .regex(/^(0[5-9]|1[01]):[0-5]\d$/)
    .optional(),
  avoidCaffeine: z.boolean().optional(),
});

function validateId(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TripInputError(`${label} must be a positive integer.`);
  }
}

function getSourceItineraryHash(
  tripUpdatedAt: Date,
  flightSegments: Array<{ id: number; updatedAt: Date }>,
): string {
  const source = [
    tripUpdatedAt.toISOString(),
    ...flightSegments.map((segment) => `${segment.id}:${segment.updatedAt.toISOString()}`).sort(),
  ].join("|");
  return createHash("sha256").update(source).digest("hex");
}

function planFields(
  draft: RecoveryPlanDraft,
  sourceTripUpdatedAt: Date,
  sourceItineraryHash: string,
) {
  return {
    sourceTripUpdatedAt,
    sourceItineraryHash,
    destinationTimeZone: draft.destinationTimeZone,
    journeyDurationMinutes: draft.journeyDurationMinutes,
    direction: draft.direction,
    timeZoneChangeMinutes: draft.timeZoneChangeMinutes,
    estimatedTimeZonesCrossed: draft.estimatedTimeZonesCrossed,
    recoveryDays: draft.recoveryDays,
    targetBedtime: draft.targetBedtime,
    targetWakeTime: draft.targetWakeTime,
    avoidCaffeine: draft.avoidCaffeine,
    preparationDaysAvailable: draft.preparationDaysAvailable,
    assumptions: draft.assumptions,
  };
}

function activityRows(draft: RecoveryPlanDraft) {
  return draft.activities.map((activity) => ({
    activityKey: activity.activityKey,
    dayNumber: activity.dayNumber,
    type: activity.type,
    title: activity.title,
    guidance: activity.guidance,
    scheduledAt: activity.scheduledAt,
    timeZone: activity.timeZone,
  }));
}

export async function getRecoveryPlan(tripId: number) {
  validateId(tripId, "Trip ID");
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      recoveryPlan: { include: { activities: { orderBy: { scheduledAt: "asc" } } } },
      flightSegments: { select: { id: true, updatedAt: true } },
    },
  });
  if (!trip) throw new TripNotFoundError();

  const sourceItineraryHash = getSourceItineraryHash(trip.updatedAt, trip.flightSegments);
  return {
    plan: trip.recoveryPlan,
    isOutOfDate:
      trip.recoveryPlan !== null && trip.recoveryPlan.sourceItineraryHash !== sourceItineraryHash,
  };
}

export async function generateOrRefreshRecoveryPlan(tripId: number, input: unknown) {
  validateId(tripId, "Trip ID");
  const parsedPreferences = recoveryPreferencesSchema.safeParse(input ?? {});
  if (!parsedPreferences.success) {
    throw new TripInputError(
      parsedPreferences.error.errors.map((error) => error.message).join("; "),
    );
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { flightSegments: { orderBy: { scheduledDepartureAt: "asc" } } },
  });
  if (!trip) throw new TripNotFoundError();

  const sourceTripUpdatedAt = trip.updatedAt;
  const sourceItineraryHash = getSourceItineraryHash(trip.updatedAt, trip.flightSegments);
  let draft: RecoveryPlanDraft;
  try {
    draft = generateRecoveryPlan({
      departureAt: trip.departureAt,
      arrivalAt: trip.arrivalAt,
      originTimeZone: trip.originTimeZone,
      destinationTimeZone: trip.destinationTimeZone,
      flights: trip.flightSegments.map((segment) => ({
        departureAt: segment.scheduledDepartureAt,
        arrivalAt: segment.scheduledArrivalAt,
        departureTimeZone: segment.departureTimeZone,
        arrivalTimeZone: segment.arrivalTimeZone,
      })),
      preferences: parsedPreferences.data,
    });
  } catch (error) {
    throw new TripInputError(
      error instanceof Error ? error.message : "Unable to generate this recovery plan.",
    );
  }

  const fields = planFields(draft, sourceTripUpdatedAt, sourceItineraryHash);
  const activities = activityRows(draft);
  await prisma.$transaction(async (transaction) => {
    const plan = await transaction.recoveryPlan.upsert({
      where: { tripId },
      create: { ...fields, trip: { connect: { id: tripId } } },
      update: fields,
      select: { id: true },
    });

    await transaction.recoveryActivity.deleteMany({
      where: { planId: plan.id, completedAt: null },
    });
    await transaction.recoveryActivity.createMany({
      data: activities.map((activity) => ({ ...activity, planId: plan.id })),
      skipDuplicates: true,
    });
  });

  return getRecoveryPlan(tripId);
}

export async function setRecoveryActivityCompleted(
  tripId: number,
  activityId: number,
  completed: boolean,
) {
  validateId(tripId, "Trip ID");
  validateId(activityId, "Activity ID");

  const result = await prisma.recoveryActivity.updateMany({
    where: { id: activityId, plan: { tripId } },
    data: { completedAt: completed ? new Date() : null },
  });
  if (result.count === 0) throw new RecoveryActivityNotFoundError();

  return prisma.recoveryActivity.findUnique({ where: { id: activityId } });
}

export function isRecoveryActivityCompletionInput(value: unknown): value is { completed: boolean } {
  const parsed = z.object({ completed: z.boolean() }).safeParse(value);
  return parsed.success;
}
