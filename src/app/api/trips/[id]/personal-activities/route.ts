import { NextRequest, NextResponse } from "next/server";
import { TripInputError } from "@server/tripService";
import { createPersonalActivity, listPersonalActivities } from "@server/personalActivityService";
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
    return NextResponse.json(await listPersonalActivities(await getTripId(context)));
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to load your activities.");
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tripId = await getTripId(context);
    const activity = await createPersonalActivity(tripId, await request.json());
    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to add the activity.");
  }
}
