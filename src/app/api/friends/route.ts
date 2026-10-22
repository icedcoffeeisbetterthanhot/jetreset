import { NextRequest, NextResponse } from "next/server";
import { listFriendRequests, sendFriendRequest } from "@server/communityService";
import { authApiErrorResponse, rejectCrossOrigin } from "@server/authApiError";

export async function GET() {
  try {
    return NextResponse.json({ requests: await listFriendRequests() });
  } catch (error) {
    return authApiErrorResponse(error, "Unable to load friend requests.");
  }
}

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  try {
    return NextResponse.json(await sendFriendRequest(await request.json()), { status: 201 });
  } catch (error) {
    return authApiErrorResponse(error, "Unable to send friend request.");
  }
}
