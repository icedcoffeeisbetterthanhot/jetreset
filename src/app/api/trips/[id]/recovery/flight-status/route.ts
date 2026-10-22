import { NextRequest, NextResponse } from "next/server";
import { TripInputError } from "@server/tripService";
import { applyFlightStatusToRecoveryPlan } from "@server/recoveryService";
import { tripApiErrorResponse } from "@server/tripApiError";
import { parseJourneyLeg } from "@lib/journeyLeg";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Applies verified flight-status changes to one leg's future recovery-plan guidance. */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const tripId = Number(id);
    if (!Number.isSafeInteger(tripId) || tripId < 1) {
      throw new TripInputError("Trip ID must be a positive integer.");
    }
    const leg = parseJourneyLeg(request.nextUrl.searchParams.get("leg"));
    if (!leg) throw new TripInputError("Leg must be outbound or return.");
    return NextResponse.json(await applyFlightStatusToRecoveryPlan(tripId, leg));
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to update the recovery plan from flight status.");
  }
}
