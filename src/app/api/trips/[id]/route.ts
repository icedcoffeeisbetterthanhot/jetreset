import { NextRequest, NextResponse } from "next/server";
import { deleteTrip, getTripById, TripInputError, updateTrip } from "@server/tripService";
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
    const trip = await getTripById(await getTripId(context));
    if (!trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }
    return NextResponse.json(trip);
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to load trip.");
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const trip = await updateTrip(await getTripId(context), await request.json());
    return NextResponse.json(trip);
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to update trip.");
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    await deleteTrip(await getTripId(context));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to delete trip.");
  }
}
