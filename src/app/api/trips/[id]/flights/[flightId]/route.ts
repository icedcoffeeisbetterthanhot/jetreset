import { NextRequest, NextResponse } from "next/server";
import { deleteFlightSegment, updateFlightSegment } from "@server/flightService";
import { TripInputError } from "@server/tripService";
import { tripApiErrorResponse } from "@server/tripApiError";

type RouteContext = {
  params: Promise<{ id: string; flightId: string }>;
};

async function getIds(context: RouteContext): Promise<{ tripId: number; flightId: number }> {
  const { id, flightId } = await context.params;
  const tripId = Number(id);
  const parsedFlightId = Number(flightId);
  if (!Number.isSafeInteger(tripId) || tripId < 1) {
    throw new TripInputError("Trip ID must be a positive integer.");
  }
  if (!Number.isSafeInteger(parsedFlightId) || parsedFlightId < 1) {
    throw new TripInputError("Flight segment ID must be a positive integer.");
  }
  return { tripId, flightId: parsedFlightId };
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { tripId, flightId } = await getIds(context);
    const segment = await updateFlightSegment(tripId, flightId, await request.json());
    return NextResponse.json(segment);
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to update flight segment.");
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { tripId, flightId } = await getIds(context);
    await deleteFlightSegment(tripId, flightId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to delete flight segment.");
  }
}
