import { createHash } from "node:crypto";
import { z } from "zod";
import { generateRecoveryPlan } from "@lib/recoveryPlan";
import type { RecoveryPlanDraft, RecoveryPlanInput } from "@lib/recoveryPlan";
import { journeyLegSchema, segmentsForLeg, type JourneyLeg } from "@lib/journeyLeg";
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
  leg: journeyLegSchema.optional(),
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

/** Fingerprint of the itinerary a plan was built from: trip edits and this leg's flights. */
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

/**
 * Route used to plan one leg. The outbound plan uses the trip's own times
 * unless outbound flights exist; the back-home plan needs return flights,
 * which run from the destination back to the origin.
 */
function routeForLeg(
  trip: { departureAt: Date; arrivalAt: Date; originTimeZone: string; destinationTimeZone: string },
  leg: JourneyLeg,
  flightStatus: FlightStatusSummary,
): Pick<
  RecoveryPlanInput,
  "departureAt" | "arrivalAt" | "originTimeZone" | "destinationTimeZone" | "flights"
> {
  const flights = flightStatus.effectiveFlights;
  if (leg === "outbound") {
    return {
      departureAt: trip.departureAt,
      arrivalAt: trip.arrivalAt,
      originTimeZone: trip.originTimeZone,
      destinationTimeZone: trip.destinationTimeZone,
      flights,
    };
  }
  const first = flights[0];
  const last = flights[flights.length - 1];
  if (!first || !last) {
    throw new TripInputError("Add your return flights before creating a back-home recovery plan.");
  }
  return {
    departureAt: first.departureAt,
    arrivalAt: last.arrivalAt,
    originTimeZone: first.departureTimeZone,
    destinationTimeZone: last.arrivalTimeZone,
    flights,
  };
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
    endsAt: activity.endsAt,
    timeZone: activity.timeZone,
  }));
}

const segmentQuery = {
  orderBy: [{ scheduledDepartureAt: "asc" as const }, { id: "asc" as const }],
  select: flightStatusSegmentSelect,
};

export async function getRecoveryPlan(tripId: number, leg: JourneyLeg = "outbound") {
  validateId(tripId, "Trip ID");
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      recoveryPlans: {
        where: { leg },
        include: { activities: { orderBy: { scheduledAt: "asc" } } },
      },
      flightSegments: segmentQuery,
    },
  });
  if (!trip) throw new TripNotFoundError();

  const plan = trip.recoveryPlans[0] ?? null;
  const legSegments = segmentsForLeg(trip.flightSegments, leg);
  const sourceItineraryHash = getSourceItineraryHash(trip.updatedAt, legSegments);
  const flightStatus = summarizeFlightStatus(legSegments);
  return {
    leg,
    plan,
    /** Whether this leg has flights (required for a back-home plan). */
    hasLegFlights: legSegments.length > 0,
    isOutOfDate: plan !== null && plan.sourceItineraryHash !== sourceItineraryHash,
    flightStatusChangePending:
      plan !== null && flightStatus.signature !== (plan.flightStatusSignature ?? null),
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
      recoveryPlans: {
        select: {
          leg: true,
          routeDepartureAt: true,
          activities: { select: { scheduledAt: true }, orderBy: { scheduledAt: "desc" }, take: 1 },
        },
      },
    },
  });

  return trips.map(({ recoveryPlans, ...trip }) => {
    const endTimes = recoveryPlans
      .map((plan) => plan.activities[0]?.scheduledAt.getTime())
      .filter((time): time is number => time !== undefined);
    return {
      ...trip,
      hasPlan: recoveryPlans.length > 0,
      planLegs: recoveryPlans.map((plan) => plan.leg),
      /** When the return journey starts, if a back-home plan exists. */
      returnDepartureAt:
        recoveryPlans.find((plan) => plan.leg === "return")?.routeDepartureAt ?? null,
      /** Last scheduled activity across all of the trip's plans. */
      planEndsAt: endTimes.length ? new Date(Math.max(...endTimes)) : null,
    };
  });
}

export async function generateOrRefreshRecoveryPlan(tripId: number, input: unknown) {
  validateId(tripId, "Trip ID");
  const parsedPreferences = recoveryPreferencesSchema.safeParse(input ?? {});
  if (!parsedPreferences.success) {
    throw new TripInputError(
      parsedPreferences.error.errors.map((error) => error.message).join("; "),
    );
  }
  const { leg = "outbound", ...preferences } = parsedPreferences.data;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { flightSegments: segmentQuery },
  });
  if (!trip) throw new TripNotFoundError();

  const legSegments = segmentsForLeg(trip.flightSegments, leg);
  const sourceTripUpdatedAt = trip.updatedAt;
  const sourceItineraryHash = getSourceItineraryHash(trip.updatedAt, legSegments);
  const flightStatus = summarizeFlightStatus(legSegments);
  let draft: RecoveryPlanDraft;
  try {
    draft = generateRecoveryPlan({ ...routeForLeg(trip, leg, flightStatus), preferences });
  } catch (error) {
    if (error instanceof TripInputError) throw error;
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
      where: { tripId_leg: { tripId, leg } },
      create: { ...fields, leg, trip: { connect: { id: tripId } } },
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

  return getRecoveryPlan(tripId, leg);
}

/**
 * Applies verified flight-status changes to one leg's plan. Activities
 * scheduled before `now` are never changed, completed activities are kept,
 * and only future uncompleted guidance that no longer matches is replaced.
 */
export async function applyFlightStatusToRecoveryPlan(
  tripId: number,
  leg: JourneyLeg = "outbound",
  now = new Date(),
) {
  validateId(tripId, "Trip ID");
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { recoveryPlans: { where: { leg } }, flightSegments: segmentQuery },
  });
  if (!trip) throw new TripNotFoundError();
  const plan = trip.recoveryPlans[0];
  if (!plan) throw new TripInputError("Generate a recovery plan before applying flight status.");
  const legSegments = segmentsForLeg(trip.flightSegments, leg);
  if (plan.sourceItineraryHash !== getSourceItineraryHash(trip.updatedAt, legSegments)) {
    throw new FlightStatusPlanConflictError(
      "The itinerary changed after this plan was generated. Regenerate the plan instead; it will include the current flight status.",
    );
  }

  const flightStatus = summarizeFlightStatus(legSegments);
  if (flightStatus.blockingAlerts.length) {
    throw new FlightStatusPlanConflictError(
      `${flightStatus.blockingAlerts.join("; ")}. Update the itinerary with your actual flights, then regenerate the plan.`,
    );
  }
  if (flightStatus.signature === plan.flightStatusSignature) return getRecoveryPlan(tripId, leg);

  let draft: RecoveryPlanDraft;
  try {
    draft = generateRecoveryPlan({
      ...routeForLeg(trip, leg, flightStatus),
      preferences: {
        targetBedtime: plan.targetBedtime,
        targetWakeTime: plan.targetWakeTime,
        avoidCaffeine: plan.avoidCaffeine,
      },
      // Keep the original preparation window so existing preparation guidance is stable.
      referenceDate: plan.generatedAt,
    });
  } catch (error) {
    if (error instanceof TripInputError) throw error;
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

  return getRecoveryPlan(tripId, leg);
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
