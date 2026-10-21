import { NextRequest, NextResponse } from "next/server";
import { TripInputError } from "@server/tripService";
import { createFlightSegment, listFlightSegments } from "@server/flightService";
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
    return NextResponse.json(await listFlightSegments(await getTripId(context)));
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to load flight segments.");
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const segment = await createFlightSegment(await getTripId(context), await request.json());
    return NextResponse.json(segment, { status: 201 });
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to save flight segment.");
  }
}
