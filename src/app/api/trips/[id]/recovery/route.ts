import { NextRequest, NextResponse } from "next/server";
import { TripInputError } from "@server/tripService";
import { getRecoveryPlan, generateOrRefreshRecoveryPlan } from "@server/recoveryService";
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

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    return NextResponse.json(await getRecoveryPlan(await getTripId(context)));
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to load the recovery plan.");
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const result = await generateOrRefreshRecoveryPlan(
      await getTripId(context),
      await request.json(),
    );
    return NextResponse.json(result);
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to generate the recovery plan.");
  }
}
