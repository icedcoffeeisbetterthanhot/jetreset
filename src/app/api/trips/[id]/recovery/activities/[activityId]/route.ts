import { NextRequest, NextResponse } from "next/server";
import {
  isRecoveryActivityCompletionInput,
  setRecoveryActivityCompleted,
} from "@server/recoveryService";
import { TripInputError } from "@server/tripService";
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const body: unknown = await request.json();
    if (!isRecoveryActivityCompletionInput(body)) {
      throw new TripInputError("Activity completion must be a boolean.");
    }
    const { tripId, activityId } = await getIds(context);
    const activity = await setRecoveryActivityCompleted(tripId, activityId, body.completed);
    return NextResponse.json(activity);
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to update recovery activity.");
  }
}
