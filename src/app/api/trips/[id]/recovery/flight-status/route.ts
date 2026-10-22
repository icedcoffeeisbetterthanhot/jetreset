import { NextRequest, NextResponse } from "next/server";
import { TripInputError } from "@server/tripService";
import { applyFlightStatusToRecoveryPlan } from "@server/recoveryService";
import { tripApiErrorResponse } from "@server/tripApiError";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Applies verified flight-status changes to future recovery-plan guidance. */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const tripId = Number(id);
    if (!Number.isSafeInteger(tripId) || tripId < 1) {
      throw new TripInputError("Trip ID must be a positive integer.");
    }
    return NextResponse.json(await applyFlightStatusToRecoveryPlan(tripId));
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to update the recovery plan from flight status.");
  }
}
