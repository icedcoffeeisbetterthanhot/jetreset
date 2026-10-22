import { NextRequest, NextResponse } from "next/server";
import { TripInputError } from "@server/tripService";
import { getTripFlightStatuses, refreshTripFlightStatuses } from "@server/flightStatusService";
import { tripApiErrorResponse } from "@server/tripApiError";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getTripId(context: RouteContext): Promise<number> {
  const { id } = await context.params;
  const tripId = Number(id);
  if (!Number.isSafeInteger(tripId) || tripId < 1) {
    throw new TripInputError("Trip ID must be a positive integer.");
  }
  return tripId;
}

/** Returns stored flight statuses without contacting the provider. */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    return NextResponse.json(await getTripFlightStatuses(await getTripId(context)));
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to load flight status.");
  }
}

/** Checks eligible segments with the provider, reusing recently cached results. */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    return NextResponse.json(await refreshTripFlightStatuses(await getTripId(context)));
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to check flight status.");
  }
}
