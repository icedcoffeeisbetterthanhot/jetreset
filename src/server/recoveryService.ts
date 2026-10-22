import { createHash } from "node:crypto";
import { z } from "zod";
import { generateRecoveryPlan } from "@lib/recoveryPlan";
import type { RecoveryPlanDraft } from "@lib/recoveryPlan";
import { prisma } from "@server/db";
import { TripInputError, TripNotFoundError } from "@server/tripService";
import { RecoveryActivityNotFoundError } from "@server/recoveryErrors";
import { FlightStatusPlanConflictError } from "@server/flightStatusErrors";
import {
  flightStatusSegmentSelect,
  summarizeFlightStatus,
  type FlightStatusSummary,
} from "@server/flightStatusService";

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

const MAX_NOTE_LENGTH = 1000;

/** Explains which verified flight-status changes a plan reflects. */
function adjustmentNote(summary: FlightStatusSummary, intro: string): string | null {
  if (!summary.signature) return null;
  const note = `${intro} ${summary.adjustments.join("; ")}.`;
  return note.length > MAX_NOTE_LENGTH ? `${note.slice(0, MAX_NOTE_LENGTH - 1)}…` : note;
}

function planFields(
  draft: RecoveryPlanDraft,
  sourceTripUpdatedAt: Date,
  sourceItineraryHash: string,
  flightStatus: { signature: string | null; note: string | null; adjustedAt: Date | null },
) {
  return {
    sourceTripUpdatedAt,
    sourceItineraryHash,
    routeDepartureAt: draft.routeDepartureAt,
    routeArrivalAt: draft.routeArrivalAt,
    flightStatusSignature: flightStatus.signature,
    adjustmentNote: flightStatus.note,
    adjustedAt: flightStatus.adjustedAt,
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
      flightSegments: {
        orderBy: [{ scheduledDepartureAt: "asc" }, { id: "asc" }],
        select: flightStatusSegmentSelect,
      },
    },
  });
  if (!trip) throw new TripNotFoundError();

  const sourceItineraryHash = getSourceItineraryHash(trip.updatedAt, trip.flightSegments);
  const flightStatus = summarizeFlightStatus(trip.flightSegments);
  return {
    plan: trip.recoveryPlan,
    isOutOfDate:
      trip.recoveryPlan !== null && trip.recoveryPlan.sourceItineraryHash !== sourceItineraryHash,
    flightStatusChangePending:
      trip.recoveryPlan !== null &&
      flightStatus.signature !== (trip.recoveryPlan.flightStatusSignature ?? null),
    flightStatusAlerts: flightStatus.blockingAlerts,
  };
}

/** Lists trips with the minimal plan context needed to choose a dashboard trip. */
export async function listDashboardTrips() {
  const trips = await prisma.trip.findMany({
    orderBy: { departureAt: "asc" },
    select: {
      id: true,
      name: true,
      origin: true,
      destination: true,
      originTimeZone: true,
      destinationTimeZone: true,
      departureAt: true,
      arrivalAt: true,
      recoveryPlan: {
        select: {
          activities: { select: { scheduledAt: true }, orderBy: { scheduledAt: "desc" }, take: 1 },
        },
      },
    },
  });

  return trips.map(({ recoveryPlan, ...trip }) => ({
    ...trip,
    hasPlan: recoveryPlan !== null,
    planEndsAt: recoveryPlan?.activities[0]?.scheduledAt ?? null,
  }));
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
    include: {
      flightSegments: {
        orderBy: [{ scheduledDepartureAt: "asc" }, { id: "asc" }],
        select: flightStatusSegmentSelect,
      },
    },
  });
  if (!trip) throw new TripNotFoundError();

  const sourceTripUpdatedAt = trip.updatedAt;
  const sourceItineraryHash = getSourceItineraryHash(trip.updatedAt, trip.flightSegments);
  const flightStatus = summarizeFlightStatus(trip.flightSegments);
  let draft: RecoveryPlanDraft;
  try {
    draft = generateRecoveryPlan({
      departureAt: trip.departureAt,
      arrivalAt: trip.arrivalAt,
      originTimeZone: trip.originTimeZone,
      destinationTimeZone: trip.destinationTimeZone,
      flights: flightStatus.effectiveFlights,
      preferences: parsedPreferences.data,
    });
  } catch (error) {
    throw new TripInputError(
      error instanceof Error ? error.message : "Unable to generate this recovery plan.",
    );
  }

  const fields = planFields(draft, sourceTripUpdatedAt, sourceItineraryHash, {
    signature: flightStatus.signature,
    note: adjustmentNote(flightStatus, "This plan uses verified flight-status times:"),
    adjustedAt: flightStatus.signature ? new Date() : null,
  });
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

/**
 * Applies verified flight-status changes to an existing plan. Activities
 * scheduled before `now` are never changed, completed activities are kept,
 * and only future uncompleted guidance that no longer matches is replaced.
 */
export async function applyFlightStatusToRecoveryPlan(tripId: number, now = new Date()) {
  validateId(tripId, "Trip ID");
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      recoveryPlan: true,
      flightSegments: {
        orderBy: [{ scheduledDepartureAt: "asc" }, { id: "asc" }],
        select: flightStatusSegmentSelect,
      },
    },
  });
  if (!trip) throw new TripNotFoundError();
  const plan = trip.recoveryPlan;
  if (!plan) throw new TripInputError("Generate a recovery plan before applying flight status.");
  if (plan.sourceItineraryHash !== getSourceItineraryHash(trip.updatedAt, trip.flightSegments)) {
    throw new FlightStatusPlanConflictError(
      "The itinerary changed after this plan was generated. Regenerate the plan instead; it will include the current flight status.",
    );
  }

  const flightStatus = summarizeFlightStatus(trip.flightSegments);
  if (flightStatus.blockingAlerts.length) {
    throw new FlightStatusPlanConflictError(
      `${flightStatus.blockingAlerts.join("; ")}. Update the itinerary with your actual flights, then regenerate the plan.`,
    );
  }
  if (flightStatus.signature === plan.flightStatusSignature) return getRecoveryPlan(tripId);

  let draft: RecoveryPlanDraft;
  try {
    draft = generateRecoveryPlan({
      departureAt: trip.departureAt,
      arrivalAt: trip.arrivalAt,
      originTimeZone: trip.originTimeZone,
      destinationTimeZone: trip.destinationTimeZone,
      flights: flightStatus.effectiveFlights,
      preferences: {
        targetBedtime: plan.targetBedtime,
        targetWakeTime: plan.targetWakeTime,
        avoidCaffeine: plan.avoidCaffeine,
      },
      // Keep the original preparation window so existing preparation guidance is stable.
      referenceDate: plan.generatedAt,
    });
  } catch (error) {
    throw new TripInputError(
      error instanceof Error ? error.message : "Unable to adjust this recovery plan.",
    );
  }

  const futureActivities = activityRows(draft).filter(
    (activity) => activity.scheduledAt.getTime() >= now.getTime(),
  );
  const fields = planFields(draft, plan.sourceTripUpdatedAt, plan.sourceItineraryHash, {
    signature: flightStatus.signature,
    note:
      adjustmentNote(
        flightStatus,
        "Future guidance was recalculated for verified flight-status changes; earlier and completed activities were kept:",
      ) ??
      "Future guidance was recalculated because the flights are back on their saved schedule; earlier and completed activities were kept.",
    adjustedAt: now,
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.recoveryPlan.update({ where: { id: plan.id }, data: fields });
    await transaction.recoveryActivity.deleteMany({
      where: {
        planId: plan.id,
        completedAt: null,
        scheduledAt: { gte: now },
        activityKey: { notIn: futureActivities.map((activity) => activity.activityKey) },
      },
    });
    await transaction.recoveryActivity.createMany({
      data: futureActivities.map((activity) => ({ ...activity, planId: plan.id })),
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
