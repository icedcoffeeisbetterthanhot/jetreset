import { NextRequest, NextResponse } from "next/server";
import { respondToFriendRequest } from "@server/communityService";
import { authApiErrorResponse, rejectCrossOrigin } from "@server/authApiError";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  try {
    const { id } = await context.params;
    return NextResponse.json(await respondToFriendRequest(Number(id), await request.json()));
  } catch (error) {
    return authApiErrorResponse(error, "Unable to update friend request.");
  }
}
