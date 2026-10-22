import { NextRequest, NextResponse } from "next/server";
import { TripInputError } from "@server/tripService";
import { deletePersonalActivity, updatePersonalActivity } from "@server/personalActivityService";
import { tripApiErrorResponse } from "@server/tripApiError";

type RouteContext = {
  params: Promise<{ id: string; activityId: string }>;
};

async function getIds(context: RouteContext): Promise<{ tripId: number; activityId: number }> {
  const { id, activityId } = await context.params;
  const tripId = Number(id);
  const parsedActivityId = Number(activityId);
  if (!Number.isSafeInteger(tripId) || tripId < 1) {
    throw new TripInputError("Trip ID must be a positive integer.");
  }
  if (!Number.isSafeInteger(parsedActivityId) || parsedActivityId < 1) {
    throw new TripInputError("Activity ID must be a positive integer.");
  }
  return { tripId, activityId: parsedActivityId };
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { tripId, activityId } = await getIds(context);
    return NextResponse.json(
      await updatePersonalActivity(tripId, activityId, await request.json()),
    );
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to update the activity.");
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { tripId, activityId } = await getIds(context);
    await deletePersonalActivity(tripId, activityId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to delete the activity.");
  }
}
